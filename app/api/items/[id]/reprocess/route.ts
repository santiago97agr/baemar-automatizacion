import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";
import { classifyEmail } from "@/lib/processing/classify";
import { decide } from "@/lib/processing/decide";
import { identifyClientByEmail } from "@/lib/processing/identify-client";
import { uploadAttachmentToDropbox } from "@/lib/integrations/dropbox";
import { uploadPendingAttachments } from "@/lib/processing/attachments";
import { mergeWithCorrections } from "@/lib/processing/reprocess-merge";
import { NotionSync } from "@/lib/sync/notion-sync";

const overrideSchema = z.object({
  title: z.string().optional(),
  area: z.string().optional(),
  priority: z.enum(["Normal", "Alta", "Urgente"]).optional(),
  description: z.string().optional(),
  summary: z.string().optional(),
});

const notionSync = new NotionSync();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  const { id } = await params;

  try {
    const communication = await prisma.communication.findUnique({ where: { id } });
    if (!communication) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const overrides = overrideSchema.parse(body);

    const identifyResult = communication.clientId
      ? { clientId: communication.clientId, ambiguous: false as const }
      : await identifyClientByEmail(prisma, communication.from);

    const classification = await classifyEmail(
      { subject: communication.subject, from: communication.from, body: communication.body },
      identifyResult,
      prisma
    );

    // Respetar correcciones manuales salvo que el usuario envíe un override explícito.
    const merged = mergeWithCorrections(classification, communication, overrides);

    const decision = await decide(
      { prisma },
      { communicationId: id, subject: communication.subject, channel: communication.channel, from: communication.from },
      identifyResult,
      merged
    );

    // Sincronizar adjuntos y Notion tras el reproceso.
    await uploadPendingAttachments(
      { prisma, uploadAttachment: uploadAttachmentToDropbox },
      decision.communication,
      merged.relevance
    );

    if (!decision.communication.needsReview) {
      try {
        await notionSync.syncFromDecision(
          { prisma },
          {
            communication: decision.communication,
            task: decision.task ? { id: decision.task.id, clientId: decision.task.clientId } : undefined,
            isNewTask: decision.isNewTask,
            isNewClient: false,
          }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Notion sync error";
        await prisma.errorLog.create({ data: { source: "sync", message: msg, communicationId: id } });
      }
    }

    const updated = await prisma.communication.update({
      where: { id },
      data: { processingStatus: "done" },
      include: { targets: true, feedback: { orderBy: { createdAt: "desc" } } },
    });

    return NextResponse.json({ activity: updated, needsReview: updated.needsReview });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Reprocess error";
    await prisma.communication.update({
      where: { id },
      data: { status: "error", errorMessage: message },
    });
    await prisma.errorLog.create({
      data: { source: "ia", message, communicationId: id },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

