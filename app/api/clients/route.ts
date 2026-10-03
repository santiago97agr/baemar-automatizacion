import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";
import { searchClientByName, syncAllClients } from "@/lib/sync/notion-clients";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ clients: [] });
  }

  try {
    const clients = await searchClientByName(prisma, q.trim(), 20);
    return NextResponse.json({ clients });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Notion search error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  try {
    const { count } = await syncAllClients(prisma);
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
