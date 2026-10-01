import { z } from "zod";
import type { PrismaClient, Communication } from "@prisma/client";
import { randomUUID } from "crypto";
import type { ClassifyFn } from "./classify";
import { identifyClientByEmail } from "./identify-client";
import { decide } from "./decide";
import { createAttachmentRecords, uploadPendingAttachments, type UploadAttachmentFn } from "./attachments";
import type { ProcessingInput, PipelineResult, ClassifiedResult } from "./types";

export type SyncNotionFn = {
  syncFromDecision(deps: { prisma: PrismaClient }, decision: {
    communication: Communication;
    task?: { id: string; clientId: string };
    isNewTask: boolean;
    isNewClient: boolean;
  }): Promise<void>;
};

export type PipelineDeps = {
  prisma: PrismaClient;
  classify: ClassifyFn;
  uploadAttachment?: UploadAttachmentFn;
  syncNotion?: SyncNotionFn;
  now?: () => Date;
};

const attachmentSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().optional(),
  size: z.number().optional(),
  contentBase64: z.string().optional(),
  sourceUrl: z.string().optional(),
  sha256: z.string().optional(),
});

const inputSchema = z.object({
  messageId: z.string().min(1).optional().default(() => randomUUID()),
  channel: z.enum(["Email", "WhatsApp"]).optional().default("Email"),
  direction: z.enum(["Entrante", "Saliente"]).optional().default("Entrante"),
  subject: z.string().optional().default("(sin asunto)"),
  from: z.string().min(1),
  to: z.string().optional(),
  body: z.string().optional().default(""),
  receivedAt: z.union([z.string().datetime(), z.date()]).optional().default(() => new Date().toISOString()),
  externalRef: z.string().optional(),
  attachments: z.union([
    z.array(attachmentSchema),
    z.string().transform((value) => {
      try {
        const parsed = JSON.parse(value);
        return z.array(attachmentSchema).parse(parsed);
      } catch {
        return [];
      }
    }),
  ]).default([]),
});

export function normalizeInput(raw: unknown): ProcessingInput {
  const parsed = inputSchema.parse(raw);
  return {
    ...parsed,
    receivedAt: parsed.receivedAt instanceof Date ? parsed.receivedAt : new Date(parsed.receivedAt),
  };
}

export async function processCommunication(deps: PipelineDeps, rawInput: unknown): Promise<PipelineResult> {
  const input = normalizeInput(rawInput);
  const { prisma, classify, uploadAttachment, syncNotion } = deps;

  // 1. Dedupe / lock.
  let communication: Communication;
  try {
    const existing = await prisma.communication.findUnique({ where: { messageId: input.messageId } });
    if (existing) {
      if (existing.processingStatus !== "error") {
        return buildResult(existing, []);
      }
      communication = await prisma.communication.update({
        where: { id: existing.id },
        data: { processingStatus: "processing", status: "ok", errorMessage: null },
      });
    } else {
      communication = await prisma.communication.create({
        data: {
          messageId: input.messageId,
          channel: input.channel,
          direction: input.direction,
          subject: input.subject,
          from: input.from,
          to: input.to,
          body: input.body,
          receivedAt: input.receivedAt,
          externalRef: input.externalRef,
          attachments: JSON.stringify(input.attachments),
          processingStatus: "processing",
        },
      });
    }
  } catch (err) {
    const existing = await prisma.communication.findUnique({ where: { messageId: input.messageId } });
    if (existing) return buildResult(existing, []);
    throw err;
  }

  const errors: string[] = [];

  try {
    // 2. Identify client.
    const identifyResult = await identifyClientByEmail(prisma, input.from);

    // 3. Classify.
    const classification = await classify(
      { subject: input.subject, from: input.from, body: input.body },
      identifyResult,
      prisma
    );

    // 4. Decide.
    const decision = await decide(
      { prisma },
      { communicationId: communication.id, subject: input.subject, channel: input.channel, from: input.from },
      identifyResult,
      classification as ClassifiedResult
    );

    // 5. Attachments.
    await createAttachmentRecords({ prisma, uploadAttachment }, communication.id, input.attachments);
    await uploadPendingAttachments({ prisma, uploadAttachment }, decision.communication, classification.relevance);

    // 6. Sync Notion.
    if (syncNotion && !decision.communication.needsReview) {
      try {
        await syncNotion.syncFromDecision(
          { prisma },
          {
            communication: decision.communication,
            task: decision.task ? { id: decision.task.id, clientId: decision.task.clientId } : undefined,
            isNewTask: decision.isNewTask,
            isNewClient: decision.isNewClient,
          }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Notion sync error";
        errors.push(msg);
        await logError(prisma, { source: "sync", message: msg, communicationId: communication.id });
      }
    }

    // 7. Finalize.
    const final = await prisma.communication.update({
      where: { id: communication.id },
      data: { processingStatus: "done" },
    });

    return buildResult(final, errors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Processing error";
    await prisma.communication.update({
      where: { id: communication.id },
      data: { processingStatus: "error", status: "error", errorMessage: msg },
    });
    await logError(prisma, { source: "processing", message: msg, communicationId: communication.id });
    return { ...buildResult(communication, [msg]), errors: [msg] };
  }
}

function buildResult(communication: Communication, errors: string[]): PipelineResult {
  return {
    communicationId: communication.id,
    clientId: communication.clientId ?? undefined,
    taskId: communication.taskId ?? undefined,
    relevance: communication.relevance ?? undefined,
    needsReview: communication.needsReview,
    isNewTask: false,
    isNewClient: false,
    errors,
  };
}

async function logError(
  prisma: PrismaClient,
  data: { source: string; message: string; communicationId?: string }
): Promise<void> {
  await prisma.errorLog.create({ data });
}
