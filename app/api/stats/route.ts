import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  try {
    const [
      processed,
      pendingReview,
      reviewed,
      errors,
      notionErrors,
      n8nErrors,
      iaErrors,
      lastRuns,
    ] = await Promise.all([
      prisma.aiActivity.count(),
      prisma.aiActivity.count({ where: { reviewStatus: "pending" } }),
      prisma.aiActivity.count({ where: { reviewStatus: "reviewed" } }),
      prisma.aiActivity.count({ where: { status: "error" } }),
      prisma.errorLog.count({ where: { source: "notion", resolved: false } }),
      prisma.errorLog.count({ where: { source: "n8n", resolved: false } }),
      prisma.errorLog.count({ where: { source: "ia", resolved: false } }),
      prisma.aiActivity.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { targets: true },
      }),
    ]);

    return NextResponse.json({
      processed,
      pendingReview,
      reviewed,
      errors,
      notionErrors,
      n8nErrors,
      iaErrors,
      lastRuns,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
