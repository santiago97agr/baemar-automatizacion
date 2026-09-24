import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  const { id } = await params;

  try {
    const errorLog = await prisma.errorLog.update({
      where: { id },
      data: { resolved: true, resolvedAt: new Date() },
    });

    return NextResponse.json({ errorLog });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
