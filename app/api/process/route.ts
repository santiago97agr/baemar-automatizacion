import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { ActivityTarget } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isValidInternalToken } from "@/lib/auth";
import { callAI, buildPrompt, aiResponseSchema } from "@/lib/ai";
import { getActiveCategories } from "@/lib/categories";
import { pushActivityToIntegrations } from "@/lib/integrations/push";

const attachmentSchema = z.object({
  filename: z.string(),
  contentType: z.string().optional(),
  size: z.number().optional(),
});

const inputSchema = z.object({
  messageId: z.string().min(1),
  subject: z.string().default("(sin asunto)"),
  from: z.string().default("(desconocido)"),
  body: z.string().default(""),
  attachments: z.array(attachmentSchema).default([]),
});

export async function POST(request: NextRequest) {
  if (!isValidInternalToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
    const data = inputSchema.parse(body);

    const categories = await getActiveCategories();
    const context = await prisma.feedback.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const prompt = buildPrompt(data, context, categories);
    const aiText = await callAI(prompt);

    const cleaned = aiText.replace(/```json|```/g, "").trim();
    const rawParsed = JSON.parse(cleaned);
    const parsed = aiResponseSchema.parse(rawParsed);

    const needsReview = parsed.needsReview ?? false;
    const reviewStatus = needsReview ? "pending" : "not_required";

    const activity = await prisma.aiActivity.create({
      data: {
        messageId: data.messageId,
        subject: data.subject,
        from: data.from,
        body: data.body,
        attachments: data.attachments.length ? JSON.stringify(data.attachments) : null,
        title: parsed.title || data.subject,
        type: parsed.type || "General",
        priority: parsed.priority || "Media",
        description: parsed.description || "",
        summary: parsed.summary || "",
        aiRaw: cleaned,
        needsReview,
        reviewReason: parsed.reviewReason || null,
        reviewStatus,
        status: "ok",
      },
    });

    let targets: ActivityTarget[] = [];
    if (!needsReview) {
      targets = await pushActivityToIntegrations(activity);
    }

    return NextResponse.json({
      success: true,
      activityId: activity.id,
      needsReview,
      targets,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }

    const message = err instanceof Error ? err.message : "Processing error";
    const messageId = typeof body.messageId === "string" ? body.messageId : undefined;

    if (messageId) {
      await prisma.aiActivity.upsert({
        where: { messageId },
        update: { status: "error", errorMessage: message },
        create: {
          messageId,
          subject: typeof body.subject === "string" ? body.subject : "(sin asunto)",
          from: typeof body.from === "string" ? body.from : "(desconocido)",
          body: typeof body.body === "string" ? body.body : "",
          title: "(error)",
          type: "error",
          priority: "Media",
          status: "error",
          errorMessage: message,
        },
      });

      const activity = await prisma.aiActivity.findUnique({ where: { messageId } });
      if (activity) {
        await prisma.errorLog.create({
          data: { source: "processing", message, activityId: activity.id },
        });
      }
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
