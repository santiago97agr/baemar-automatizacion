import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import {
  signSession,
  verifySession,
  getSessionUser,
  buildSessionCookie,
  buildClearSessionCookie,
  isValidBasicAuth,
  isValidInternalToken,
  __unsafeSignForTest,
} from "@/lib/auth";
import { clearCachedSecretForTests } from "@/lib/session-secret";

const TEST_SECRET = "a".repeat(32);

describe("Session cookie auth", () => {
  before(() => {
    process.env.AUTH_SECRET = TEST_SECRET;
    clearCachedSecretForTests();
  });

  beforeEach(() => {
    process.env.AUTH_SECRET = TEST_SECRET;
    clearCachedSecretForTests();
  });

  after(() => {
    delete process.env.AUTH_SECRET;
    clearCachedSecretForTests();
  });

  it("firma y verifica una sesión válida", () => {
    const token = signSession("admin");
    const session = verifySession(token);
    assert.ok(session);
    assert.equal(session.user, "admin");
    assert.ok(session.expAt > Date.now());
  });

  it("rechaza una firma alterada", () => {
    const token = signSession("admin");
    const tampered = token.replace(/^[^.]+/, "tampered");
    assert.equal(verifySession(tampered), null);
  });

  it("rechaza una sesión expirada", () => {
    const expired = __unsafeSignForTest("admin", TEST_SECRET, Date.now() - 1000);
    assert.equal(verifySession(expired), null);
  });

  it("extrae el usuario de una cookie correcta", () => {
    const token = signSession("admin");
    const req = new Request("http://localhost/", {
      headers: { cookie: `baemar_session=${encodeURIComponent(token)}` },
    });
    assert.equal(getSessionUser(req), "admin");
  });

  it("devuelve null si falta la cookie", () => {
    const req = new Request("http://localhost/");
    assert.equal(getSessionUser(req), null);
  });

  it("la cookie de sesión tiene los atributos de seguridad esperados", () => {
    const cookie = buildSessionCookie("admin");
    assert.ok(cookie.includes("HttpOnly"));
    assert.ok(cookie.includes("SameSite=Lax"));
    assert.ok(cookie.includes("Path=/"));
    assert.ok(cookie.includes("Max-Age="));
    assert.ok(!cookie.includes("Secure"), "En desarrollo no debe incluir Secure");
  });

  it("la cookie de sesión incluye Secure en producción", () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const cookie = buildSessionCookie("admin");
      assert.ok(cookie.includes("Secure"));
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it("la cookie de logout limpia la sesión", () => {
    const cookie = buildClearSessionCookie();
    assert.ok(cookie.includes("Max-Age=0"));
  });

  it("valida Basic Auth por constant-time", () => {
    process.env.AUTH_USER = "admin";
    process.env.AUTH_PASSWORD = "secret";
    const encoded = Buffer.from("admin:secret").toString("base64");
    const req = new Request("http://localhost/", {
      headers: { authorization: `Basic ${encoded}` },
    });
    assert.ok(isValidBasicAuth(req));
  });

  it("rechaza credenciales incorrectas", () => {
    process.env.AUTH_USER = "admin";
    process.env.AUTH_PASSWORD = "secret";
    const encoded = Buffer.from("admin:wrong").toString("base64");
    const req = new Request("http://localhost/", {
      headers: { authorization: `Basic ${encoded}` },
    });
    assert.equal(isValidBasicAuth(req), false);
  });

  it("valida internal token", () => {
    process.env.INTERNAL_API_TOKEN = "tokensecreto";
    const req = new Request("http://localhost/", {
      headers: { "x-internal-token": "tokensecreto" },
    });
    assert.ok(isValidInternalToken(req));
  });
});
