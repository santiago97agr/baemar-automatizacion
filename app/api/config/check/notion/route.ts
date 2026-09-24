import { NextResponse, NextRequest } from "next/server";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";
import { notion } from "@/lib/notion";

export async function POST(request: NextRequest) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  try {
    const token = process.env.NOTION_TOKEN;

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "NOTION_TOKEN no configurado" },
        { status: 400 }
      );
    }

    const me = await notion.users.me({});

    return NextResponse.json({
      ok: true,
      bot: me.name || "Notion",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
