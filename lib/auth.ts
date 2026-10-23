import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";
import { getSessionSecret } from "@/lib/session-secret";

const COOKIE_NAME = "baemar_session";
const SESSION_DAYS = 30;
const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 60 * 60;

function base64urlEncode(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64url");
}

function base64urlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  const len = Math.max(aBuf.length, bBuf.length);
  const aPad = Buffer.alloc(len, 0);
  const bPad = Buffer.alloc(len, 0);
  aBuf.copy(aPad);
  bBuf.copy(bPad);
  return timingSafeEqual(aPad, bPad) && a.length === b.length;
}

function sign(value: string): string {
  const secret = getSessionSecret();
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function signSession(user: string): string {
  const expAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = base64urlEncode(JSON.stringify({ user, expAt }));
  const sig = sign(payload);
  return `${sig}.${payload}`;
}

export function verifySession(cookie: string): { user: string; expAt: number } | null {
  const parts = cookie.split(".");
  if (parts.length !== 2) return null;
  const [sig, payload] = parts;
  if (!safeCompare(sig, sign(payload))) return null;
  try {
    const { user, expAt } = JSON.parse(base64urlDecode(payload));
    if (typeof user !== "string" || typeof expAt !== "number") return null;
    if (Date.now() > expAt) return null;
    return { user, expAt };
  } catch {
    return null;
  }
}

export function getSessionUser(request: NextRequest | Request): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  const session = verifySession(decodeURIComponent(match[1]));
  return session?.user ?? null;
}

export function buildSessionCookie(user: string): string {
  const value = signSession(user);
  const isProduction = process.env.NODE_ENV === "production";
  const secureFlag = isProduction ? "; Secure" : "";
  return `${COOKIE_NAME}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}${secureFlag}`;
}

export function buildClearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

export function isValidBasicAuth(request: NextRequest | Request): boolean {
  const auth = request.headers.get("authorization");
  if (!auth) return false;

  const user = process.env.AUTH_USER ?? "";
  const password = process.env.AUTH_PASSWORD ?? "";
  const expected = "Basic " + Buffer.from(`${user}:${password}`).toString("base64");
  return safeCompare(auth, expected);
}

export function basicAuthResponse(): Response {
  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="App"' },
  });
}

export function isValidInternalToken(request: NextRequest | Request): boolean {
  const token = request.headers.get("x-internal-token") ?? "";
  const expected = process.env.INTERNAL_API_TOKEN ?? "";
  return safeCompare(token, expected);
}

// Utilidad para tests: generar un token válido con un secreto arbitrario.
export function __unsafeSignForTest(user: string, secret: string, expAt?: number): string {
  const payload = base64urlEncode(JSON.stringify({ user, expAt: expAt ?? Date.now() + 3600_000 }));
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${sig}.${payload}`;
}
