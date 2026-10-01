import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";

const statusValues = ["Pendiente", "En curso", "Esperando cliente", "Esperando tercero", "Terminada"] as const;
const priorityValues = ["Normal", "Alta", "Urgente"] as const;
const originValues = ["Email", "WhatsApp", "Teléfono", "Presencial", "Interno"] as const;

const createSchema = z.object({
  clientId: z.string().min(1),
  title: z.string().min(1),
  area: z.string().optional(),
  priority: z.enum(priorityValues).optional(),
  status: z.enum(statusValues).optional(),
  description: z.string().optional(),
  summary: z.string().optional(),
  dueDate: z.string().datetime().optional().or(z.date().optional()),
  economicValue: z.number().optional(),
  assignee: z.string().optional(),
  origin: z.enum(originValues).optional(),
});

export async function GET(request: NextRequest) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const clientId = searchParams.get("clientId");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (clientId) where.clientId = clientId;

  try {
    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { client: true, _count: { select: { communications: true } } },
    });
    return NextResponse.json({ tasks });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    const client = await prisma.client.findUnique({ where: { id: data.clientId } });
    if (!client) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const task = await prisma.task.create({
      data: {
        clientId: data.clientId,
        title: data.title,
        area: data.area,
        priority: data.priority ?? "Normal",
        status: data.status ?? "Pendiente",
        description: data.description ?? "",
        summary: data.summary ?? "",
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        economicValue: data.economicValue ?? null,
        assignee: data.assignee ?? null,
        origin: data.origin ?? "Interno",
      },
      include: { client: true },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
