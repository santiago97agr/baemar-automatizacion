import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";

const createSchema = z.object({
  source: z.enum(["n8n", "ia", "notion", "processing", "erp"]),
  message: z.string().min(1),
  activityId: z.string().optional(),
  messageId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");
  const resolved = searchParams.get("resolved");

  try {
    const errors = await prisma.errorLog.findMany({
      where: {
        ...(source ? { source } : {}),
        ...(resolved !== null ? { resolved: resolved === "true" } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { activity: { select: { id: true, title: true, subject: true, messageId: true } } },
    });

    return NextResponse.json({ errors });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const internalToken = request.headers.get("x-internal-token");
  const expected = "Basic " + Buffer.from(`${process.env.AUTH_USER}:${process.env.AUTH_PASSWORD}`).toString("base64");
  if (authHeader !== expected && internalToken !== process.env.INTERNAL_API_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    let activityId = data.activityId;
    if (!activityId && data.messageId) {
      const activity = await prisma.aiActivity.findUnique({
        where: { messageId: data.messageId },
        select: { id: true },
      });
      if (activity) activityId = activity.id;
    }

    const errorLog = await prisma.errorLog.create({
      data: {
        source: data.source,
        message: data.message,
        activityId,
      },
    });

    return NextResponse.json({ errorLog }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Error saving error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
