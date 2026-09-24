import { NextResponse, NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isValidInternalToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!isValidInternalToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const activityId = searchParams.get("activityId");
  const messageId = searchParams.get("messageId");

  if (!activityId && !messageId) {
    return NextResponse.json({ context: [] });
  }

  const where: Prisma.FeedbackWhereInput = {};
  if (activityId) where.activityId = activityId;
  if (messageId) where.emailMessageId = messageId;

  const feedback = await prisma.feedback.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ context: feedback });
}
