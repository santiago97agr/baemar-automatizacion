import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";
import { pushActivityToIntegrations } from "@/lib/integrations/push";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  const { id } = await params;

  try {
    let activity = await prisma.aiActivity.findUnique({
      where: { id },
      include: { targets: true },
    });

    if (!activity) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (activity.reviewStatus === "reviewed") {
      return NextResponse.json({ activity });
    }

    activity = await prisma.aiActivity.update({
      where: { id },
      data: { reviewStatus: "reviewed", needsReview: false },
      include: { targets: true },
    });

    const existingTargets = activity.targets.filter((t) => t.status !== "error").length;
    if (existingTargets === 0) {
      await pushActivityToIntegrations(activity);
      activity = await prisma.aiActivity.findUnique({
        where: { id },
        include: { targets: true },
      });
    }

    return NextResponse.json({ activity });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Review error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
