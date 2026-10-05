import type { PrismaClient, Communication, Task } from "@prisma/client";
import { normalizeArea } from "@/lib/ai";
import type { IdentifyResult } from "./identify-client";
import type { ClassifiedResult } from "./types";

export type DecideResult = {
  communication: Communication;
  task?: Task;
  isNewTask: boolean;
  isNewClient: boolean;
};

export type DecideDeps = {
  prisma: PrismaClient;
};

const TASK_LINK_WINDOW_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type LinkValidation =
  | { ok: true; task: Task }
  | { ok: false; reason: string };

async function validateTaskLinkage(
  prisma: PrismaClient,
  clientId: string,
  matchedTaskId: string,
  classificationArea: string | null | undefined
): Promise<LinkValidation> {
  const task = await prisma.task.findFirst({
    where: { id: matchedTaskId, clientId },
  });
  if (!task) {
    return { ok: false, reason: "La tarea vinculada no existe entre las tareas abiertas del cliente" };
  }

  const normalizedTaskArea = normalizeArea(task.area);
  const normalizedClassArea = normalizeArea(classificationArea);
  if (normalizedTaskArea && normalizedClassArea && normalizedTaskArea !== normalizedClassArea) {
    return {
      ok: false,
      reason: `Área distinta: la tarea es ${normalizedTaskArea} y el correo parece ${normalizedClassArea}`,
    };
  }

  const lastCommunication = await prisma.communication.findFirst({
    where: { taskId: task.id },
    orderBy: { createdAt: "desc" },
  });
  if (lastCommunication) {
    const daysSince = (Date.now() - lastCommunication.createdAt.getTime()) / MS_PER_DAY;
    if (daysSince > TASK_LINK_WINDOW_DAYS) {
      return {
        ok: false,
        reason: `La última comunicación de la tarea fue hace ${Math.round(daysSince)} días (máximo ${TASK_LINK_WINDOW_DAYS})`,
      };
    }
  }

  return { ok: true, task };
}

export async function decide(
  deps: DecideDeps,
  input: {
    communicationId: string;
    subject: string;
    channel: string;
    from: string;
  },
  identifyResult: IdentifyResult,
  classification: ClassifiedResult
): Promise<DecideResult> {
  const { prisma } = deps;

  let clientId: string | undefined;
  if (!identifyResult.ambiguous && identifyResult.clientId) {
    clientId = identifyResult.clientId;
  }

  // Revisión humana: guardar propuesta pero sin efectos sobre cliente/tarea.
  if (classification.needsReview) {
    const communication = await prisma.communication.update({
      where: { id: input.communicationId },
      data: {
        clientId: clientId ?? null,
        relevance: classification.relevance,
        title: classification.title || input.subject,
        type: classification.area || "General",
        priority: classification.priority || "Normal",
        description: classification.description || "",
        summary: classification.summary || "",
        needsReview: true,
        reviewReason: classification.reviewReason || null,
        reviewStatus: "pending",
        processingStatus: "done",
        aiRaw: JSON.stringify(classification),
      },
    });
    return { communication, isNewTask: false, isNewClient: false };
  }

  const baseUpdate = {
    clientId: clientId ?? null,
    relevance: classification.relevance,
    title: classification.title || input.subject,
    type: classification.area || "General",
    priority: classification.priority || "Normal",
    description: classification.description || "",
    summary: classification.summary || "",
    needsReview: false,
    reviewReason: null,
    reviewStatus: "not_required" as const,
    processingStatus: "classified" as const,
    aiRaw: JSON.stringify(classification),
  };

  // Correo irrelevante: solo registro.
  if (classification.relevance === "irrelevant") {
    const communication = await prisma.communication.update({
      where: { id: input.communicationId },
      data: baseUpdate,
    });
    return { communication, isNewTask: false, isNewClient: false };
  }

  // Correo informativo: vincular a tarea existente si la IA lo propone con evidencia; si no, solo registro.
  if (classification.relevance === "info") {
    let taskId: string | null = null;
    if (clientId && classification.matchedTaskId) {
      const validation = await validateTaskLinkage(
        prisma,
        clientId,
        classification.matchedTaskId,
        classification.area
      );
      if (validation.ok) taskId = validation.task.id;
    }
    const communication = await prisma.communication.update({
      where: { id: input.communicationId },
      data: { ...baseUpdate, taskId },
    });
    return { communication, isNewTask: false, isNewClient: false };
  }

  // Guardas duras: no se crean tareas sin cliente identificado ni se vinculan tareas inexistentes.
  if (classification.relevance === "action" && (!clientId || identifyResult.ambiguous)) {
    const communication = await prisma.communication.update({
      where: { id: input.communicationId },
      data: {
        ...baseUpdate,
        needsReview: true,
        reviewReason: identifyResult.ambiguous ? "Cliente ambiguo" : "Cliente no identificado",
        reviewStatus: "pending",
      },
    });
    return { communication, isNewTask: false, isNewClient: false };
  }

  if (clientId && classification.matchedTaskId) {
    const exists = await prisma.task.findFirst({
      where: { id: classification.matchedTaskId, clientId },
    });
    if (!exists) {
      const communication = await prisma.communication.update({
        where: { id: input.communicationId },
        data: {
          ...baseUpdate,
          needsReview: true,
          reviewReason: "La tarea vinculada no existe entre las tareas abiertas del cliente",
          reviewStatus: "pending",
        },
      });
      return { communication, isNewTask: false, isNewClient: false };
    }
  }

  // relevance === "action" con cliente válido
  let task: Task | null = null;
  let isNewTask = false;

  if (clientId && classification.matchedTaskId && !classification.isNewTask) {
    const validation = await validateTaskLinkage(
      prisma,
      clientId,
      classification.matchedTaskId,
      classification.area
    );
    if (validation.ok) task = validation.task;
  }

  if (!task && clientId) {
    task = await prisma.task.create({
      data: {
        clientId,
        title: classification.title || input.subject,
        area: classification.area || null,
        priority: classification.priority || "Normal",
        description: classification.description || "",
        summary: classification.summary || "",
        status: "Pendiente",
        origin: input.channel,
        syncStatus: "pending",
      },
    });
    isNewTask = true;
  }

  const communication = await prisma.communication.update({
    where: { id: input.communicationId },
    data: {
      ...baseUpdate,
      clientId: clientId ?? null,
      taskId: task?.id ?? null,
    },
  });

  return { communication, task: task ?? undefined, isNewTask, isNewClient: false };
}
