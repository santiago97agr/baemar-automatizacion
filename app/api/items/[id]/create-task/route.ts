import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";
import { NotionSync } from "@/lib/sync/notion-sync";

const priorityValues = ["Normal", "Alta", "Urgente"] as const;

const schema = z.object({
  title: z.string().min(1).optional(),
  area: z.string().optional(),
  priority: z.enum(priorityValues).optional(),
  description: z.string().optional(),
  summary: z.string().optional(),
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
    if (!communication.clientId) {
      return NextResponse.json({ error: "La comunicación no tiene cliente asignado" }, { status: 400 });
    }

    const task = await prisma.task.create({
      data: {
        clientId: communication.clientId,
        title: data.title || communication.title || communication.subject,
        area: data.area || communication.type,
        priority: data.priority || (communication.priority as (typeof priorityValues)[number]) || "Normal",
        description: data.description || communication.description,
        summary: data.summary || communication.summary,
        origin: communication.channel,
        status: "Pendiente",
      },
    });

    const updated = await prisma.communication.update({
      where: { id },
      data: { taskId: task.id },
      include: { task: true },
    });

    await prisma.attachment.updateMany({
      where: { communicationId: id },
      data: { taskId: task.id },
    });

    try {
      await notionSync.syncFromDecision(
        { prisma },
        {
          communication: updated,
          task: { id: task.id, clientId: task.clientId },
          isNewTask: true,
          isNewClient: false,
        }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Notion sync error";
      await prisma.errorLog.create({ data: { source: "sync", message: msg, communicationId: id } });
    }

    return NextResponse.json({ communication: updated, task });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
