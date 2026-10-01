import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidInternalToken } from "@/lib/auth";
import { processCommunication } from "@/lib/processing/pipeline";
import { classifyEmail } from "@/lib/processing/classify";
import { uploadAttachmentToDropbox } from "@/lib/integrations/dropbox";
import { NotionSync } from "@/lib/sync/notion-sync";

const notionSync = new NotionSync();

export async function POST(request: NextRequest) {
  if (!isValidInternalToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await processCommunication(
      {
        prisma,
        classify: classifyEmail,
        uploadAttachment: uploadAttachmentToDropbox,
        syncNotion: notionSync,
      },
      body
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Processing error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
