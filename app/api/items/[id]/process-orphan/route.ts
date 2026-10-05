import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";
import { uploadAttachmentToDropbox } from "@/lib/integrations/dropbox";
import { NotionSync } from "@/lib/sync/notion-sync";
import { finalizeReview } from "@/lib/processing/finalize-review";
import { SENTINEL_CLIENT_NAME } from "@/lib/sentinel-client";

const notionSync = new NotionSync();

const schema = z.object({
  reason: z.string().max(500).optional(),
});

async function getOrCreateSentinel(): Promise<{ id: string }> {
  const existing = await prisma.client.findFirst({
    where: { name: SENTINEL_CLIENT_NAME, notionPageId: null },
  });
  if (existing) return { id: existing.id };
  return prisma.client.create({
    data: {
      name: SENTINEL_CLIENT_NAME,
      aliases: "[]",
      areas: "[]",
      status: "Activo",
      assignee: null,
      email: null,
      taxId: null,
      notionPageId: null,
    },
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const data = schema.parse(body);

    const communication = await prisma.communication.findUnique({ where: { id } });
    if (!communication) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Si ya tiene un cliente asignado que no es el sentinela, rechazamos.
    if (communication.clientId) {
      const existing = await prisma.client.findUnique({ where: { id: communication.clientId } });
      if (existing && existing.name !== SENTINEL_CLIENT_NAME) {
        return NextResponse.json(
          { error: "La comunicación ya tiene un cliente asignado" },
          { status: 400 }
        );
      }
    }

    const sentinel = await getOrCreateSentinel();

    await prisma.communication.update({
      where: { id },
      data: {
        clientId: sentinel.id,
        needsReview: false,
        reviewStatus: "reviewed",
        reviewReason: `Procesado sin cliente identificado: ${data.reason?.trim() || "manual"}`,
      },
    });

    await prisma.attachment.updateMany({
      where: { communicationId: id },
      data: { clientId: sentinel.id },
    });

    const finalizeResult = await finalizeReview(
      { prisma, uploadAttachment: uploadAttachmentToDropbox, syncNotion: notionSync },
      id
    );

    const updated = await prisma.communication.findUnique({
      where: { id },
      include: { task: true, client: true },
    });

    return NextResponse.json({
      communication: updated,
      task: finalizeResult.task,
      isNewTask: finalizeResult.isNewTask,
      errors: finalizeResult.errors,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Process orphan error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}