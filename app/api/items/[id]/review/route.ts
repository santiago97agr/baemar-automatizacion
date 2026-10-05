import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";
import { uploadAttachmentToDropbox } from "@/lib/integrations/dropbox";
import { NotionSync } from "@/lib/sync/notion-sync";
import { finalizeReview } from "@/lib/processing/finalize-review";

const notionSync = new NotionSync();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  const { id } = await params;

  try {
    let activity = await prisma.communication.findUnique({
      where: { id },
      include: { targets: true },
    });

    if (!activity) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (activity.reviewStatus === "reviewed") {
      return NextResponse.json({ activity });
    }

    activity = await prisma.communication.update({
      where: { id },
      data: { reviewStatus: "reviewed", needsReview: false },
      include: { targets: true },
    });

    await finalizeReview(
      { prisma, uploadAttachment: uploadAttachmentToDropbox, syncNotion: notionSync },
      id
    );

    activity = await prisma.communication.findUnique({
      where: { id },
      include: { targets: true },
    });

    return NextResponse.json({ activity });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Review error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
