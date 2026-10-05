import { z } from "zod";

export const priorityValues = ["Normal", "Alta", "Urgente"] as const;
export const areaValues = [
  "Fiscal",
  "Laboral",
  "Contable",
  "Jurídico-Mercantil",
  "Administración",
] as const;

export const aiResponseSchema = z.object({
  title: z.string().optional(),
  type: z.enum(areaValues).optional(),
  priority: z.enum(priorityValues).optional(),
  description: z.string().optional(),
  summary: z.string().optional(),
  needsReview: z.boolean().optional(),
  reviewReason: z.string().optional(),
});

export type AiResponse = z.infer<typeof aiResponseSchema>;

export const classifiedResponseSchema = z.object({
  relevance: z.enum(["irrelevant", "info", "action"]),
  area: z.string().nullish(),
  priority: z.enum(priorityValues).nullish(),
  title: z.string().nullish(),
  description: z.string().nullish(),
  summary: z.string().nullish(),
  clientName: z.string().nullish(),
  matchedTaskId: z.string().nullish(),
  isNewTask: z.boolean().nullish(),
  needsReview: z.boolean().nullish(),
  reviewReason: z.string().nullish(),
});

export type ClassifiedResponse = z.infer<typeof classifiedResponseSchema>;

const areaSynonyms: Record<string, string> = {
  "rrhh": "Laboral",
  "recursos humanos": "Laboral",
  "laboral": "Laboral",
  "trabajo": "Laboral",
  "tributaria": "Fiscal",
  "fiscal": "Fiscal",
  "impuestos": "Fiscal",
  "tributario": "Fiscal",
  "contabilidad": "Contable",
  "contable": "Contable",
  "contables": "Contable",
  "legal": "Jurídico-Mercantil",
  "mercantil": "Jurídico-Mercantil",
  "juridico": "Jurídico-Mercantil",
  "jurídico": "Jurídico-Mercantil",
  "societario": "Jurídico-Mercantil",
  "jurídico-mercantil": "Jurídico-Mercantil",
  "juridico-mercantil": "Jurídico-Mercantil",
  "administracion": "Administración",
  "administración": "Administración",
  "administrativa": "Administración",
};

export function normalizeArea(area: string | null | undefined): string | undefined {
  if (!area) return undefined;
  const key = area.trim().toLowerCase();
  if (!key) return undefined;
  const mapped = areaSynonyms[key];
  if (mapped) return mapped;
  const capitalized = area.trim().charAt(0).toUpperCase() + area.trim().slice(1);
  if (areaValues.includes(capitalized as (typeof areaValues)[number])) {
    return capitalized;
  }
  return undefined;
}

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

export type OpenTaskHint = {
  id: string;
  title: string;
  area: string | null;
  status: string;
  summary: string;
};

export type ClientHint = {
  id: string;
  name: string;
  emails: string[];
  areas?: string[];
};

export function buildPrompt(
  email: { subject: string; from: string; body: string },
  context: { type: string; text: string }[],
  categories: string[],
  clients: ClientHint[],
  matchedClient?: { id: string; name: string; openTasks: OpenTaskHint[] }
): string {
  const contextText = context.length
    ? `Contexto previo de correcciones/comentarios del usuario:\n${context
        .map((c) => `- ${c.type}: ${c.text}`)
        .join("\n")}\n\nTen esto en cuenta para ajustar la clasificación.`
    : "No hay contexto previo.";

  const categoriesText = categories.length
    ? `Clasifica en UNA de estas áreas: ${categories.join(", ")}.`
    : "Elige el área más adecuada.";

  const clientsText =
    clients.length === 0
      ? "No hay clientes dados de alta."
      : `Clientes dados de alta (nombre + emails):\n${clients
          .map((c) => `- ${c.name}: ${c.emails.join(", ")}`)
          .join("\n")}`;

  const matchedClientText = matchedClient
    ? `Cliente identificado automáticamente por el remitente: ${matchedClient.name} (${matchedClient.id}).\nTareas abiertas de este cliente (solo puedes vincular a una de estas):\n${matchedClient.openTasks
        .map((t) => `- id=${t.id} | ${t.title} | área=${t.area ?? "sin área"} | estado=${t.status} | resumen=${t.summary}`)
        .join("\n")}`
    : "No se ha identificado cliente automáticamente.";

  return `Eres un asistente de una gestoría. Recibes una comunicación entrante y debes clasificarla con precisión sin inventar datos.

${contextText}

${categoriesText}

${clientsText}

${matchedClientText}

Comunicación:
- Asunto: ${email.subject}
- Remitente: ${email.from}
- Cuerpo:
${email.body}

Devuelve ÚNICAMENTE un objeto JSON válido con estas claves:
- relevance: "irrelevant" si no tiene interés para el despacho, "info" si es informativa pero no requiere actuación, "action" si requiere una actuación del despacho
- area: una de las áreas listadas arriba (opcional)
- priority: "Normal", "Alta" o "Urgente" (solo si relevance=action)
- title: título corto de la posible tarea (solo si relevance=action)
- description: descripción de la acción a realizar (solo si relevance=action)
- summary: resumen breve de la comunicación para el histórico
- clientName: nombre del cliente que propones, si lo identificas con claridad
- matchedTaskId: id de una de las tareas abiertas listadas arriba si crees que la comunicación aporta información o modifica esa tarea; si no, omítelo
- isNewTask: true si crees que hay que crear una tarea nueva; false u omitido si se vincula a una existente
- needsReview: true si hay dudas sobre el cliente, la tarea o la importancia; false si estás seguro
- reviewReason: breve explicación (solo si needsReview es true)

Normas:
- No inventes clientes, tareas, plazos, importes ni responsables.
- Si no identificas al cliente o hay varios candidatos, devuelve needsReview=true.
- No fusiones dos tareas distintas solo porque el asunto sea similar.
- Un email que solo confirma, agradece o informa sin pedir nada se considera "info".
- Vincula a una tarea abierta (matchedTaskId) SOLO cuando el contenido aporte información, modifique o continúe esa tarea de forma CLARA y EXPLÍCITA.
- Crea una tarea nueva (isNewTask=true) cuando:
  · el asunto o contenido trata un tema distinto a las tareas abiertas listadas;
  · el correo no hace referencia explícita a ninguna de las tareas abiertas;
  · la tarea abierta más reciente pertenece a un área diferente a la del correo;
  · haya la más mínima duda. En caso de duda, SIEMPRE preferir crear una tarea nueva antes que vincular incorrectamente.
- No asumas que dos correos del mismo cliente son parte del mismo asunto solo porque comparten remitente.

No añadas explicaciones ni markdown, solo JSON.`;
}
