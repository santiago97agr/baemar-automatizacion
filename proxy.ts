import { NextResponse, NextRequest } from "next/server";
import { getSessionUser, isValidBasicAuth } from "@/lib/auth";

const INTERNAL_PATHS = ["/api/context", "/api/webhook", "/api/process", "/api/errors"];
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"];
const BASIC_AUTH_FALLBACK = process.env.AUTH_FALLBACK === "basic";

function isInternalPath(pathname: string): boolean {
  return INTERNAL_PATHS.some((p) => pathname.startsWith(p));
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isStaticAsset(pathname: string): boolean {
  // Archivos estáticos de public/ no deberían pasar por auth.
  return /\.(?:png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|ttf|eot|otf|webp|webmanifest|json)(?:\?.*)?$/i.test(
    pathname
  );
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (
    isInternalPath(pathname) ||
    isPublicPath(pathname) ||
    isStaticAsset(pathname)
  ) {
    return NextResponse.next();
  }

  // Autenticación principal: cookie firmada baemar_session.
  if (getSessionUser(request)) {
    return NextResponse.next();
  }

  // Fallback opcional para integraciones: Basic Auth.
  if (BASIC_AUTH_FALLBACK && isValidBasicAuth(request)) {
    return NextResponse.next();
  }

  // API no autenticada: 401 JSON.
  if (isApiRoute(pathname)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rutas HTML no autenticadas: redirigir al login, conservando la ruta destino.
  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") {
    loginUrl.searchParams.set("from", pathname);
  }
  return NextResponse.redirect(loginUrl, { status: 302 });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|_next/data|favicon.ico|baemar-logo\\.png).*)",],
};
