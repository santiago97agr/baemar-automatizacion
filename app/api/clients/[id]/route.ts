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

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  taxId: z.string().optional(),
  areas: z.array(z.string()).optional(),
  status: z.enum(["Activo", "Baja"]).optional(),
  assignee: z.string().optional(),
  contacts: z.array(contactSchema).optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isValidBasicAuth(request)) return basicAuthResponse();

  const { id } = await params;

  try {
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        contacts: { orderBy: { isPrimary: "desc" } },
        tasks: { orderBy: { createdAt: "desc" }, take: 50 },
        communications: { orderBy: { receivedAt: "desc" }, take: 50, include: { task: true } },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ client });
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

    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.taxId !== undefined) updateData.taxId = data.taxId;
    if (data.areas !== undefined) updateData.areas = JSON.stringify(data.areas);
    if (data.status !== undefined) updateData.status = data.status;
    if (data.assignee !== undefined) updateData.assignee = data.assignee;

    await prisma.client.update({
      where: { id },
      data: updateData,
    });

    if (data.contacts) {
      await prisma.contact.deleteMany({ where: { clientId: id } });
      await prisma.contact.createMany({
        data: data.contacts.map((c) => ({
          clientId: id,
          channel: c.channel,
          address: c.channel === "Email" ? c.address.toLowerCase().trim() : c.address.trim(),
          name: c.name,
          isPrimary: c.isPrimary ?? false,
        })),
      });
    }

    const refreshed = await prisma.client.findUnique({
      where: { id },
      include: { contacts: true },
    });

    return NextResponse.json({ client: refreshed });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
