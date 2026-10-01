import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";

const statusValues = ["Pendiente", "En curso", "Esperando cliente", "Esperando tercero", "Terminada"] as const;
const priorityValues = ["Normal", "Alta", "Urgente"] as const;
const originValues = ["Email", "WhatsApp", "Teléfono", "Presencial", "Interno"] as const;

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  area: z.string().optional(),
  priority: z.enum(priorityValues).optional(),
  status: z.enum(statusValues).optional(),
  description: z.string().optional(),
  summary: z.string().optional(),
  dueDate: z.string().datetime().optional().or(z.date().optional()).nullable(),
  economicValue: z.number().optional().nullable(),
  assignee: z.string().optional().nullable(),
  origin: z.enum(originValues).optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  const { id } = await params;

  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        client: true,
        communications: { orderBy: { receivedAt: "desc" }, include: { files: true } },
        attachments: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  const { id } = await params;

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.area !== undefined) updateData.area = data.area;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === "Terminada" && existing.status !== "Terminada") {
        updateData.closedAt = new Date();
      }
      if (data.status !== "Terminada" && existing.status === "Terminada") {
        updateData.closedAt = null;
      }
    }
    if (data.description !== undefined) updateData.description = data.description;
    if (data.summary !== undefined) updateData.summary = data.summary;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.economicValue !== undefined) updateData.economicValue = data.economicValue;
    if (data.assignee !== undefined) updateData.assignee = data.assignee;
    if (data.origin !== undefined) updateData.origin = data.origin;

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: { client: true },
    });

    return NextResponse.json({ task });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
