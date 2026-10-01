import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";
import { uploadAttachmentToDropbox } from "@/lib/integrations/dropbox";
import { uploadPendingAttachments } from "@/lib/processing/attachments";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  const { id } = await params;

  try {
    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: { communication: true },
    });
    if (!attachment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await uploadPendingAttachments(
      { prisma, uploadAttachment: uploadAttachmentToDropbox },
      attachment.communication,
      attachment.communication.relevance
    );

    const updated = await prisma.attachment.findUnique({ where: { id } });
    return NextResponse.json({ attachment: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
