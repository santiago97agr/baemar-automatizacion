import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";
import { uploadAttachmentToDropbox } from "@/lib/integrations/dropbox";
import { NotionSync } from "@/lib/sync/notion-sync";
import { finalizeReview } from "@/lib/processing/finalize-review";

const notionSync = new NotionSync();

const createSchema = z.object({
  communicationId: z.string().min(1),
  emailMessageId: z.string().optional(),
  type: z.enum(["correction", "comment"]),
  text: z.string().min(1),
});

export async function GET(request: NextRequest) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "true";

  try {
    const feedback = await prisma.feedback.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { createdAt: "desc" },
      include: { communication: { select: { id: true, title: true, subject: true } } },
    });

    return NextResponse.json({ feedback });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    const activity = await prisma.communication.findUnique({
      where: { id: data.communicationId },
    });

    if (!activity) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const feedback = await prisma.feedback.create({
      data: {
        communicationId: data.communicationId,
        emailMessageId: data.emailMessageId || null,
        type: data.type,
        text: data.text,
      },
    });

    await prisma.communication.update({
      where: { id: data.communicationId },
      data: { reviewStatus: "reviewed", needsReview: false },
    });

    if (activity.reviewStatus === "pending") {
      await finalizeReview(
        { prisma, uploadAttachment: uploadAttachmentToDropbox, syncNotion: notionSync },
        data.communicationId
      );
    }

    return NextResponse.json({ feedback }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Error saving feedback";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
