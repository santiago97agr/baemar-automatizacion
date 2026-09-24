import { NextResponse, NextRequest } from "next/server";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";
import { callAI } from "@/lib/ai";

export async function POST(request: NextRequest) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  try {
    const apiKey = process.env.AI_API_KEY;
    const provider = process.env.AI_PROVIDER || "openai";

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "AI_API_KEY no configurada" },
        { status: 400 }
      );
    }

    const response = await callAI(
      "Responde únicamente la palabra 'ok' para confirmar que la conexión funciona."
    );

    if (!response || !response.trim()) {
      return NextResponse.json(
        { ok: false, error: "La respuesta de la IA está vacía" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      provider,
      model: process.env.AI_MODEL || (provider === "openai" ? "gpt-4o-mini" : "claude-3-5-sonnet-20240620"),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
