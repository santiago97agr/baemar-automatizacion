import { NextResponse, NextRequest } from "next/server";

const INTERNAL_PATHS = ["/api/context", "/api/webhook"];

function isInternalPath(pathname: string): boolean {
  return INTERNAL_PATHS.some((p) => pathname.startsWith(p));
}

function isValidAuth(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  if (!auth) return false;
  const user = process.env.AUTH_USER || "";
  const password = process.env.AUTH_PASSWORD || "";
  const expected = "Basic " + Buffer.from(`${user}:${password}`).toString("base64");
  return auth === expected;
}

export function proxy(request: NextRequest) {
  if (isInternalPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (!isValidAuth(request)) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": "Basic realm=\"App\"" },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
