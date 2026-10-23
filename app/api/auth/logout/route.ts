import { NextResponse } from "next/server";
import { buildClearSessionCookie } from "@/lib/auth";

export async function POST() {
  return NextResponse.json(
    { ok: true },
    {
      status: 200,
      headers: {
        "Set-Cookie": buildClearSessionCookie(),
        "Cache-Control": "no-store",
      },
    }
  );
}
