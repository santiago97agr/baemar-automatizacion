import { NextResponse, NextRequest } from "next/server";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";
import { checkDropboxConnection } from "@/lib/integrations/dropbox";

export async function POST(request: NextRequest) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  const result = await checkDropboxConnection();

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.error?.includes("configurado") ? 400 : 502 }
    );
  }

  return NextResponse.json(result);
}
