import { NextResponse, NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  const { searchParams } = new URL(request.url);
  const reviewStatus = searchParams.get("reviewStatus");
  const status = searchParams.get("status");
  const type = searchParams.get("type");

  const where: Prisma.AiActivityWhereInput = {};
  if (reviewStatus) where.reviewStatus = reviewStatus;
  if (status) where.status = status;
  if (type) where.type = type;

  try {
    const activities = await prisma.aiActivity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { targets: true, feedback: { take: 1, orderBy: { createdAt: "desc" } } },
    });

    return NextResponse.json({ items: activities });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
