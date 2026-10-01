import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";
import { pushActivityToIntegrations } from "@/lib/integrations/push";
import { NotionSync } from "@/lib/sync/notion-sync";

const schema = z.object({
  title: z.string().min(1),
  type: z.string().min(1),
  priority: z.enum(["Normal", "Alta", "Urgente"]),
  description: z.string().default(""),
  summary: z.string().default(""),
  feedbackText: z.string().optional(),
});

const notionSync = new NotionSync();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  const { id } = await params;

  try {
    const body = await request.json();
    const data = schema.parse(body);

    const activity = await prisma.communication.findUnique({ where: { id } });
    if (!activity) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.communication.update({
      where: { id },
      data: {
        title: data.title,
        type: data.type,
        priority: data.priority,
        description: data.description,
        summary: data.summary,
        reviewStatus: "reviewed",
        needsReview: false,
        correctedAt: new Date(),
      },
    });

    if (data.feedbackText?.trim()) {
      await prisma.feedback.create({
        data: {
          communicationId: id,
          emailMessageId: activity.messageId,
          type: "correction",
          text: data.feedbackText,
        },
      });
    }

    const activityWithTargets = await prisma.communication.findUnique({
      where: { id },
      include: { targets: true },
    });

    if (!activityWithTargets) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const existingOk = activityWithTargets.targets.filter((t) => t.status === "ok").length;
    if (existingOk === 0) {
      await pushActivityToIntegrations(activityWithTargets);
      try {
        await notionSync.syncFromDecision(
          { prisma },
          {
            communication: activityWithTargets,
            task: activityWithTargets.taskId ? { id: activityWithTargets.taskId, clientId: activityWithTargets.clientId || "" } : undefined,
            isNewTask: false,
            isNewClient: false,
          }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Notion sync error";
        await prisma.errorLog.create({ data: { source: "sync", message: msg, communicationId: id } });
      }
    }

    const fullActivity = await prisma.communication.findUnique({
      where: { id },
      include: { targets: true, feedback: { orderBy: { createdAt: "desc" } } },
    });

    return NextResponse.json({ activity: fullActivity });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Correction error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
