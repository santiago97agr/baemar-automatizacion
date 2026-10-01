import type { PrismaClient } from "@prisma/client";
import {
  callAI,
  classifiedResponseSchema,
  type ClassifiedResponse,
  type ClientHint,
  type OpenTaskHint,
  buildPrompt,
} from "@/lib/ai";
import { getActiveCategories } from "@/lib/categories";
import type { IdentifyResult } from "./identify-client";

export type ClassifyFn = (
  input: {
    subject: string;
    from: string;
    body: string;
  },
  identifyResult: IdentifyResult,
  prisma: PrismaClient
) => Promise<ClassifiedResponse>;

export const classifyEmail: ClassifyFn = async (input, identifyResult, prisma) => {
  const [categories, clientsRaw, feedback] = await Promise.all([
    getActiveCategories(),
    prisma.client.findMany({
      where: { status: { not: "Baja" } },
      include: { contacts: { where: { channel: "Email" } } },
    }),
    prisma.feedback.findMany({ where: { active: true }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const clients: ClientHint[] = clientsRaw.map((c) => ({
    id: c.id,
    name: c.name,
    emails: c.contacts.map((contact) => contact.address),
    areas: parseJsonArray(c.areas),
  }));

  let matchedClient: { id: string; name: string; openTasks: OpenTaskHint[] } | undefined;
  if (identifyResult.clientId) {
    const client = clientsRaw.find((c) => c.id === identifyResult.clientId);
    if (client) {
      const openTasks = await prisma.task.findMany({
        where: { clientId: client.id, status: { not: "Terminada" } },
        orderBy: { createdAt: "desc" },
      });
      matchedClient = {
        id: client.id,
        name: client.name,
        openTasks: openTasks.map((t) => ({
          id: t.id,
          title: t.title,
          area: t.area,
          status: t.status,
          summary: t.summary,
        })),
      };
    }
  }

  const prompt = buildPrompt(input, feedback, categories, clients, matchedClient);
  const aiText = await callAI(prompt);
  const cleaned = aiText.replace(/```json|```/g, "").trim();
  const raw = JSON.parse(cleaned);
  const parsed = classifiedResponseSchema.parse(raw);

  return applyGuards(parsed, identifyResult, matchedClient);
};

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function applyGuards(
  parsed: ClassifiedResponse,
  identifyResult: IdentifyResult,
  matchedClient?: { id: string; name: string; openTasks: OpenTaskHint[] }
): ClassifiedResponse {
  const result = { ...parsed };

  // Si hay ambigüedad de cliente o no se identificó y la IA propone acción, forzar revisión.
  if (result.relevance === "action" && (identifyResult.ambiguous || !identifyResult.clientId)) {
    result.needsReview = true;
    result.reviewReason = result.reviewReason
      ? `${result.reviewReason}; cliente no identificado o ambiguo`
      : "Cliente no identificado o ambiguo";
  }

  // matchedTaskId solo es válido si pertenece a las tareas abiertas dadas a la IA.
  if (result.matchedTaskId) {
    const validTaskIds = new Set(matchedClient?.openTasks.map((t) => t.id) ?? []);
    if (!validTaskIds.has(result.matchedTaskId)) {
      result.needsReview = true;
      result.reviewReason = result.reviewReason
        ? `${result.reviewReason}; tarea vinculada no encontrada entre las abiertas del cliente`
        : "La tarea vinculada no se encuentra entre las tareas abiertas del cliente";
      result.matchedTaskId = undefined;
    }
  }

  // Si la IA pide revisión, descartar propuestas forzadas.
  if (result.needsReview) {
    result.isNewTask = false;
  }

  return result;
}
