import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { ActivityTarget } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";
import { callAI, buildPrompt, aiResponseSchema } from "@/lib/ai";
import { getActiveCategories } from "@/lib/categories";
import { pushActivityToIntegrations } from "@/lib/integrations/push";

const schema = z.object({
  title: z.string().optional(),
  type: z.string().optional(),
  priority: z.enum(["Alta", "Media", "Baja"]).optional(),
  description: z.string().optional(),
  summary: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  const { id } = await params;

  try {
    const activity = await prisma.aiActivity.findUnique({ where: { id } });
    if (!activity) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const overrides = schema.parse(body);

    const categories = await getActiveCategories();
    const context = await prisma.feedback.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const prompt = buildPrompt(
      { subject: activity.subject, from: activity.from, body: activity.body },
      context,
      categories
    );
    const aiText = await callAI(prompt);

    const cleaned = aiText.replace(/```json|```/g, "").trim();
    const rawParsed = JSON.parse(cleaned);
    const parsed = aiResponseSchema.parse(rawParsed);

    const needsReview = parsed.needsReview ?? false;

    const updated = await prisma.aiActivity.update({
      where: { id },
      data: {
        title: overrides.title ?? parsed.title ?? activity.title,
        type: overrides.type ?? parsed.type ?? activity.type,
        priority: overrides.priority ?? parsed.priority ?? activity.priority,
        description: overrides.description ?? parsed.description ?? activity.description,
        summary: overrides.summary ?? parsed.summary ?? activity.summary,
        aiRaw: cleaned,
        needsReview,
        reviewReason: parsed.reviewReason || null,
        reviewStatus: needsReview ? "pending" : "reviewed",
        status: "ok",
        errorMessage: null,
      },
      include: { targets: true },
    });

    await prisma.activityTarget.deleteMany({ where: { activityId: id } });

    let targets: ActivityTarget[] = [];
    if (!needsReview) {
      targets = await pushActivityToIntegrations(updated);
    }

    return NextResponse.json({ activity: updated, targets, needsReview });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Reprocess error";
    await prisma.aiActivity.update({
      where: { id },
      data: { status: "error", errorMessage: message },
    });
    await prisma.errorLog.create({
      data: { source: "ia", message, activityId: id },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
