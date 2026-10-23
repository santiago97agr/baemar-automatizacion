import { NextRequest, NextResponse } from "next/server";
import {
  buildSessionCookie,
  isValidBasicAuth,
  safeCompare,
} from "@/lib/auth";
import {
  isLoginBlocked,
  recordFailedLogin,
  clearLoginAttempts,
  getRemainingBlockSeconds,
} from "@/lib/auth-rate";
import { logAuthFailure } from "@/lib/logging";

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function isValidCredentials(user: string, password: string): boolean {
  const expectedUser = process.env.AUTH_USER ?? "";
  const expectedPassword = process.env.AUTH_PASSWORD ?? "";
  return safeCompare(user, expectedUser) && safeCompare(password, expectedPassword);
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  if (isLoginBlocked(ip)) {
    return NextResponse.json(
      { error: "Demasiados intentos. Vuelve a intentarlo más tarde." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(getRemainingBlockSeconds(ip)),
        },
      }
    );
  }

  let body: { user?: string; password?: string; from?: string };
  try {
    body = await request.json();
  } catch {
    recordFailedLogin(ip);
    return NextResponse.json(
      { error: "Credenciales incorrectas" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { user = "", password = "" } = body;

  if (!isValidCredentials(user, password)) {
    recordFailedLogin(ip);
    void logAuthFailure(ip, "/api/auth/login");
    return NextResponse.json(
      { error: "Credenciales incorrectas" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  clearLoginAttempts(ip);

  const redirectTo =
    typeof body.from === "string" && body.from.startsWith("/") && !body.from.startsWith("//")
      ? body.from
      : "/";

  return NextResponse.json(
    { ok: true, redirect: redirectTo },
    {
      status: 200,
      headers: {
        "Set-Cookie": buildSessionCookie(user),
        "Cache-Control": "no-store",
      },
    }
  );
}

// Fallback: si alguien hace GET con Basic Auth válido, le damos cookie también.
export async function GET(request: NextRequest) {
  if (!isValidBasicAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = process.env.AUTH_USER ?? "admin";
  return NextResponse.json(
    { ok: true },
    {
      status: 200,
      headers: { "Set-Cookie": buildSessionCookie(user), "Cache-Control": "no-store" },
    }
  );
}
