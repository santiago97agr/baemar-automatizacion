import type { PrismaClient, Communication, Task } from "@prisma/client";
import { uploadPendingAttachments, type UploadAttachmentFn } from "./attachments";
import type { SyncNotionFn } from "./pipeline";

export type FinalizeReviewDeps = {
  prisma: PrismaClient;
  uploadAttachment?: UploadAttachmentFn;
  syncNotion?: SyncNotionFn;
};

export type FinalizeReviewResult = {
  communication: Communication;
  task?: Task;
  isNewTask: boolean;
  errors: string[];
};

export async function finalizeReview(
  deps: FinalizeReviewDeps,
  communicationId: string
): Promise<FinalizeReviewResult> {
  const { prisma, uploadAttachment, syncNotion } = deps;
  const errors: string[] = [];

  let communication = await prisma.communication.findUnique({
    where: { id: communicationId },
    include: { client: true, task: true, targets: true },
  });
  if (!communication) {
    throw new Error("Comunicación no encontrada");
  }

  let task: Task | undefined = communication.task ?? undefined;
  let isNewTask = false;

  if (!task && communication.taskId) {
    task = (await prisma.task.findUnique({ where: { id: communication.taskId } })) ?? undefined;
  }

  if (
    !task &&
    communication.relevance === "action" &&
    communication.clientId
  ) {
    task = await prisma.task.create({
      data: {
        clientId: communication.clientId,
        title: communication.title || communication.subject,
        area: communication.type && communication.type !== "General" ? communication.type : null,
        priority: communication.priority || "Normal",
        description: communication.description || "",
        summary: communication.summary || "",
        status: "Pendiente",
        origin: communication.channel,
        syncStatus: "pending",
      },
    });
    isNewTask = true;
    communication = await prisma.communication.update({
      where: { id: communication.id },
      data: { taskId: task.id },
      include: { client: true, task: true, targets: true },
    });
  }

  await uploadPendingAttachments(
    { prisma, uploadAttachment },
    communication,
    communication.relevance
  );

  const okTarget = communication.targets.some((t) => t.status === "ok");
  if (syncNotion && !okTarget) {
    try {
      await syncNotion.syncFromDecision(
        { prisma },
        {
          communication,
          task: task ? { id: task.id, clientId: task.clientId } : undefined,
          isNewTask,
          isNewClient: false,
        }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Notion sync error";
      errors.push(msg);
      await prisma.errorLog.create({
        data: { source: "sync", message: msg, communicationId },
      });
    }
  }

  const final = await prisma.communication.update({
    where: { id: communicationId },
    data: { processingStatus: "done", status: "ok", errorMessage: null },
  });

  return { communication: final, task, isNewTask, errors };
}