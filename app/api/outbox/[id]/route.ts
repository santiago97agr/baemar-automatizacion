import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidInternalToken } from "@/lib/auth";

const schema = z.object({
  status: z.enum(["ok", "error", "pending"]),
  targetId: z.string().optional(),
  targetUrl: z.string().optional(),
  errorMessage: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isValidInternalToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const data = schema.parse(body);

    const target = await prisma.activityTarget.update({
      where: { id },
      data: {
        status: data.status,
        targetId: data.targetId,
        targetUrl: data.targetUrl,
        errorMessage: data.errorMessage,
      },
    });

    return NextResponse.json({ target });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Update error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
