import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidBasicAuth, basicAuthResponse } from "@/lib/auth";

const contactSchema = z.object({
  channel: z.enum(["Email", "Teléfono", "WhatsApp"]),
  address: z.string().min(1),
  name: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

const createSchema = z.object({
  name: z.string().min(1),
  taxId: z.string().optional(),
  areas: z.array(z.string()).optional(),
  status: z.enum(["Activo", "Baja"]).optional(),
  assignee: z.string().optional(),
  contacts: z.array(contactSchema).optional(),
});

export async function GET(request: NextRequest) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  try {
    const clients = await prisma.client.findMany({
      where: status ? { status } : {},
      orderBy: { name: "asc" },
      include: {
        _count: { select: { tasks: true, communications: true } },
        contacts: { orderBy: { isPrimary: "desc" } },
      },
    });
    return NextResponse.json({ clients });
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

    const contacts = (data.contacts ?? []).map((c) => ({
      ...c,
      address: c.channel === "Email" ? c.address.toLowerCase().trim() : c.address.trim(),
    }));

    const client = await prisma.client.create({
      data: {
        name: data.name,
        taxId: data.taxId,
        areas: JSON.stringify(data.areas ?? []),
        status: data.status ?? "Activo",
        assignee: data.assignee,
        contacts: { create: contacts },
      },
      include: { contacts: true },
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
