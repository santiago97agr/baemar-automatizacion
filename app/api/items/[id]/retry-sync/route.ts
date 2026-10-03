import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";
import { NotionSync } from "@/lib/sync/notion-sync";
import { refreshClientFromNotion } from "@/lib/sync/notion-clients";

const notionSync = new NotionSync();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  const { id } = await params;

  try {
    const communication = await prisma.communication.findUnique({
      where: { id },
      include: { task: true },
    });
    if (!communication) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await notionSync.syncFromDecision(
      { prisma },
      {
        communication,
        task: communication.task ? { id: communication.task.id, clientId: communication.task.clientId } : undefined,
        isNewTask: false,
        isNewClient: false,
      }
    );

    // Refrescar espejo del cliente tras sincronizar.
    if (communication.clientId) {
      const client = await prisma.client.findUnique({ where: { id: communication.clientId } });
      if (client?.notionPageId) {
        await refreshClientFromNotion(prisma, client.notionPageId);
      }
    }

    const updated = await prisma.communication.update({
      where: { id },
      data: { processingStatus: "done" },
      include: { targets: true },
    });

    return NextResponse.json({ communication: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync error";
    await prisma.errorLog.create({ data: { source: "sync", message, communicationId: id } });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
