import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";
import { NotionSync } from "@/lib/sync/notion-sync";

const schema = z.object({
  clientId: z.string().min(1),
  taskId: z.string().optional(),
});

const notionSync = new NotionSync();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  const { id } = await params;

  try {
    const body = await request.json();
    const data = schema.parse(body);

    const communication = await prisma.communication.findUnique({ where: { id } });
    if (!communication) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const client = await prisma.client.findUnique({ where: { id: data.clientId } });
    if (!client) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    let taskId: string | null = null;
    if (data.taskId) {
      const task = await prisma.task.findFirst({ where: { id: data.taskId, clientId: data.clientId } });
      if (!task) {
        return NextResponse.json({ error: "Tarea no encontrada para este cliente" }, { status: 404 });
      }
      taskId = task.id;
    }

    const updated = await prisma.communication.update({
      where: { id },
      data: { clientId: data.clientId, taskId },
      include: { task: true },
    });

    await prisma.attachment.updateMany({
      where: { communicationId: id },
      data: { clientId: data.clientId, taskId },
    });

    try {
      await notionSync.syncFromDecision(
        { prisma },
        {
          communication: updated,
          task: updated.task ? { id: updated.task.id, clientId: updated.task.clientId } : undefined,
          isNewTask: false,
          isNewClient: false,
        }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Notion sync error";
      await prisma.errorLog.create({ data: { source: "sync", message: msg, communicationId: id } });
    }

    return NextResponse.json({ communication: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
