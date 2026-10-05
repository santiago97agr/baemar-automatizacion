import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";
import { notion } from "@/lib/notion";
import { searchClientByName, syncAllClients } from "@/lib/sync/notion-clients";

export const dynamic = "force-dynamic";

export async function validateClientsDb(): Promise<{ ok: true } | { ok: false; error: string }> {
  const databaseId = process.env.NOTION_CLIENTS_DB_ID;
  if (!databaseId) {
    return { ok: false, error: "NOTION_CLIENTS_DB_ID no configurado" };
  }
  if (!/^[a-f0-9]{32}$/i.test(databaseId.replace(/-/g, ""))) {
    return {
      ok: false,
      error: `NOTION_CLIENTS_DB_ID inválido: '${databaseId}'. Debe ser un UUID de 32 caracteres hexadecimales.`,
    };
  }
  try {
    await notion.databases.retrieve({ database_id: databaseId });
    return { ok: true };
  } catch (err) {
    const anyErr = err as { code?: string; message?: string; requestId?: string };
    const requestId = anyErr?.requestId ? ` [requestId=${anyErr.requestId}]` : "";
    return {
      ok: false,
      error: `NOTION_CLIENTS_DB_ID no es accesible. Verifica que es el ID de la base de datos de clientes y que la integración tiene acceso. Detalle: ${anyErr?.code ?? "error"}: ${anyErr?.message ?? String(err)}${requestId}`,
    };
  }
}

export async function GET(request: NextRequest) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ clients: [] });
  }

  const validation = await validateClientsDb();
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 502 });
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
