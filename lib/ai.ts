import { z } from "zod";

export const aiResponseSchema = z.object({
  title: z.string().optional(),
  type: z.string().optional(),
  priority: z.enum(["Alta", "Media", "Baja"]).optional(),
  description: z.string().optional(),
  summary: z.string().optional(),
  needsReview: z.boolean().optional(),
  reviewReason: z.string().optional(),
});

export type AiResponse = z.infer<typeof aiResponseSchema>;

export async function callAI(prompt: string): Promise<string> {
  const provider = process.env.AI_PROVIDER || "openai";
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || (provider === "openai" ? "gpt-4o-mini" : "claude-3-5-sonnet-20240620");

  if (!apiKey) throw new Error("AI_API_KEY not set");

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Anthropic error");
    return data.content?.[0]?.text || "";
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "OpenAI error");
  return data.choices?.[0]?.message?.content || "";
}

export function buildPrompt(
  email: { subject: string; from: string; body: string },
  context: { type: string; text: string }[],
  categories: string[]
): string {
  const contextText = context.length
    ? `Contexto previo de correcciones/comentarios del usuario:\n${context
        .map((c) => `- ${c.type}: ${c.text}`)
        .join("\n")}\n\nTen esto en cuenta para ajustar la clasificación.`
    : "No hay contexto previo.";

  const categoriesText = categories.length
    ? `Clasifica la tarea en UNA de estas categorías: ${categories.join(", ")}.`
    : "Elige una categoría apropiada para la gestoría.";

  return `Eres un asistente de una gestoría. Interpreta el siguiente correo y extrae una tarea clara para el equipo.

${contextText}

${categoriesText}

Asunto: ${email.subject}
Remitente: ${email.from}
Cuerpo:
${email.body}

Devuelve ÚNICAMENTE un objeto JSON válido con estas claves:
- title: título corto de la tarea
- type: tipo/categoría de la tarea
- priority: "Alta", "Media" o "Baja"
- description: descripción de la acción a realizar
- summary: resumen breve del correo para el histórico
- needsReview: true si necesitas que un humano revise antes de actuar (datos insuficientes, ambigüedad, importancia alta), false si estás seguro
- reviewReason: breve explicación de por qué necesita revisión (solo si needsReview es true)

No añadas explicaciones ni markdown, solo JSON.`;
}
