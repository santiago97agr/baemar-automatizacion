import { NextResponse, NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isValidInternalToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!isValidInternalToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetType = searchParams.get("type");
  const status = searchParams.get("status") || "pending";

  const where: Prisma.ActivityTargetWhereInput = { status };
  if (targetType) where.targetType = targetType;

  const targets = await prisma.activityTarget.findMany({
    where,
    include: { activity: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ targets });
}
