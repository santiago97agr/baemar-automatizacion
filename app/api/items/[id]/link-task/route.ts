import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";
import { NotionSync } from "@/lib/sync/notion-sync";

const schema = z.object({ taskId: z.string().min(1) });

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

    const task = await prisma.task.findUnique({ where: { id: data.taskId } });
    if (!task) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }
    if (communication.clientId && task.clientId !== communication.clientId) {
      return NextResponse.json({ error: "La tarea no pertenece al cliente de la comunicación" }, { status: 400 });
    }

    const updated = await prisma.communication.update({
      where: { id },
      data: { taskId: task.id, clientId: communication.clientId || task.clientId },
      include: { task: true },
    });

    await prisma.attachment.updateMany({
      where: { communicationId: id },
      data: { clientId: updated.clientId },
    });

    try {
      await notionSync.syncFromDecision(
        { prisma },
        {
          communication: updated,
          task: { id: task.id, clientId: task.clientId },
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
