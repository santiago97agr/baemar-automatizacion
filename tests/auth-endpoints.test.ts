import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { GET as loginGet, POST as loginPost } from "@/app/api/auth/login/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { __unsafeSignForTest } from "@/lib/auth";
import { clearCachedSecretForTests } from "@/lib/session-secret";
import { getTestPrisma, cleanDatabase } from "./helpers";

let prisma: PrismaClient;

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(new URL(path, "http://localhost"), init);
}

function makeNextRequest(path: string, init?: RequestInit): import("next/server").NextRequest {
  const req = new Request(new URL(path, "http://localhost"), init);
  return Object.assign(req, {
    nextUrl: new URL(path, "http://localhost"),
    ip: "127.0.0.1",
  }) as import("next/server").NextRequest;
}

type RouteHandler = (request: Request) => Promise<Response>;

function cookieHeaderFromResponse(res: Response): string | null {
  return res.headers.get("set-cookie");
}

describe("Auth endpoints", () => {
  before(async () => {
    prisma = await getTestPrisma();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    process.env.AUTH_USER = "admin";
    process.env.AUTH_PASSWORD = "secret";
    process.env.AUTH_SECRET = "a".repeat(32);
    process.env.NODE_ENV = "test";
    clearCachedSecretForTests();
  });

  after(async () => {
    await prisma.$disconnect();
    delete process.env.AUTH_USER;
    delete process.env.AUTH_PASSWORD;
    delete process.env.AUTH_SECRET;
    delete process.env.NODE_ENV;
  });

  it("POST /api/auth/login con credenciales correctas crea cookie y devuelve redirect", async () => {
    const req = makeRequest("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: "admin", password: "secret", from: "/tareas" }),
    });
    const res = await (loginPost as RouteHandler)(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.redirect, "/tareas");
    const cookie = cookieHeaderFromResponse(res);
    assert.ok(cookie);
    assert.ok(cookie?.includes("baemar_session"));
    assert.ok(cookie?.includes("HttpOnly"));
  });

  it("POST /api/auth/login con credenciales incorrectas devuelve 401", async () => {
    const req = makeRequest("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: "admin", password: "wrong" }),
    });
    const res = await (loginPost as RouteHandler)(req);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.error, "Credenciales incorrectas");
  });

  it("POST /api/auth/login bloquea tras 5 intentos fallidos", async () => {
    for (let i = 0; i < 5; i += 1) {
      const req = makeRequest("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: "admin", password: "wrong" }),
      });
      await (loginPost as RouteHandler)(req);
    }
    const req = makeRequest("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: "admin", password: "wrong" }),
    });
    const res = await (loginPost as RouteHandler)(req);
    assert.equal(res.status, 429);
  });

  it("POST /api/auth/logout limpia la cookie", async () => {
    const res = await logoutPost();
    assert.equal(res.status, 200);
    const cookie = cookieHeaderFromResponse(res);
    assert.ok(cookie?.includes("Max-Age=0"));
  });

  it("GET /api/auth/login con Basic Auth válido crea cookie", async () => {
    const encoded = Buffer.from("admin:secret").toString("base64");
    const req = makeRequest("/api/auth/login", {
      headers: { authorization: `Basic ${encoded}` },
    });
    const res = await (loginGet as RouteHandler)(req);
    assert.equal(res.status, 200);
    const cookie = cookieHeaderFromResponse(res);
    assert.ok(cookie?.includes("baemar_session"));
  });
});

describe("Proxy cookie auth", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "a".repeat(32);
    process.env.AUTH_FALLBACK = "";
    clearCachedSecretForTests();
  });

  it("redirige a /login si no hay sesión", async () => {
    const { proxy } = await import("@/proxy");
    const req = makeNextRequest("/tareas");
    const res = proxy(req);
    assert.equal(res.status, 302);
    const location = res.headers.get("location");
    assert.ok(location?.includes("/login"));
    assert.ok(location?.includes("from=%2Ftareas"));
  });

  it("permite el acceso con cookie válida", async () => {
    const { proxy } = await import("@/proxy");
    const token = __unsafeSignForTest("admin", process.env.AUTH_SECRET ?? "");
    const req = makeNextRequest("/tareas", {
      headers: { cookie: `baemar_session=${token}` },
    });
    const res = proxy(req);
    assert.equal(res.status, 200);
  });
});
