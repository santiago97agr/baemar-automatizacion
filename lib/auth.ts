import { NextRequest } from "next/server";

export function isValidBasicAuth(request: NextRequest | Request): boolean {
  const auth = request.headers.get("authorization");
  if (!auth) return false;

  const expected = "Basic " + Buffer.from(`${process.env.AUTH_USER}:${process.env.AUTH_PASSWORD}`).toString("base64");
  return auth === expected;
}

export function basicAuthResponse(): Response {
  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": "Basic realm=\"App\"" },
  });
}

export function isValidInternalToken(request: NextRequest | Request): boolean {
  return request.headers.get("x-internal-token") === process.env.INTERNAL_API_TOKEN;
}
