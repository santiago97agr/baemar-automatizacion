/* eslint-disable @typescript-eslint/no-explicit-any */
import { notion } from "@/lib/notion";
import type { PrismaClient, Client, Task, Communication } from "@prisma/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export class NotionSync {
  async syncFromDecision(
    { prisma }: { prisma: PrismaClient },
    decision: {
      communication: Communication;
      task?: { id: string; clientId: string };
      isNewTask: boolean;
      isNewClient: boolean;
    }
  ): Promise<void> {
    const clientsDbId = process.env.NOTION_CLIENTS_DB_ID;
    const tasksDbId = process.env.NOTION_TASKS_DB_ID;
    const communicationsDbId = process.env.NOTION_COMMUNICATIONS_DB_ID || process.env.NOTION_HISTORY_DB_ID;

    if (!clientsDbId || !tasksDbId || !communicationsDbId) {
      throw new Error(
        "Faltan NOTION_CLIENTS_DB_ID, NOTION_TASKS_DB_ID o NOTION_COMMUNICATIONS_DB_ID (o NOTION_HISTORY_DB_ID como fallback)"
      );
    }

    const communication = await prisma.communication.findUnique({
      where: { id: decision.communication.id },
      include: { client: true, task: true },
    });
    if (!communication) throw new Error("Comunicación no encontrada");

    let clientPageId: string | undefined;
    if (communication.client && communication.clientId) {
      clientPageId = await this.ensureClient(communication.client, clientsDbId, prisma);
    }

    let taskPageId: string | undefined;
    if (communication.task && communication.taskId && clientPageId) {
      taskPageId = await this.ensureTask(communication.task, clientPageId, tasksDbId, prisma);
    }

    const commPageId = await this.ensureCommunication(
      communication,
      clientPageId,
      taskPageId,
      communicationsDbId,
      prisma
    );

    await this.recordTarget(prisma, communication.id, commPageId, "ok");
  }

  private async ensureClient(client: Client, dbId: string, prisma: PrismaClient): Promise<string> {
    if (client.notionPageId) {
      try {
        await notion.pages.update({
          page_id: client.notionPageId,
          properties: clientProperties(client),
        });
        return client.notionPageId;
      } catch {
        // Si la página no existe, continuamos para recrearla.
      }
    }

    const emails = await prisma.contact.findMany({
      where: { clientId: client.id, channel: "Email" },
      orderBy: { isPrimary: "desc" },
    });
    const phones = await prisma.contact.findMany({
      where: { clientId: client.id, channel: { in: ["Teléfono", "WhatsApp"] } },
      orderBy: { isPrimary: "desc" },
    });

    const page = (await notion.pages.create({
      parent: { database_id: dbId },
      properties: clientProperties(client, emails, phones),
    })) as PageObjectResponse;

    await prisma.client.update({ where: { id: client.id }, data: { notionPageId: page.id } });
    return page.id;
  }

  private async ensureTask(task: Task, clientPageId: string, dbId: string, prisma: PrismaClient): Promise<string> {
    if (task.notionPageId) {
      try {
        await notion.pages.update({
          page_id: task.notionPageId,
          properties: taskProperties(task, clientPageId),
        });
        return task.notionPageId;
      } catch {
        // recrear si falla
      }
    }

    const page = (await notion.pages.create({
      parent: { database_id: dbId },
      properties: taskProperties(task, clientPageId),
    })) as PageObjectResponse;

    await prisma.task.update({ where: { id: task.id }, data: { notionPageId: page.id, syncStatus: "ok" } });
    return page.id;
  }

  private async ensureCommunication(
    communication: Communication,
    clientPageId: string | undefined,
    taskPageId: string | undefined,
    dbId: string,
    prisma: PrismaClient
  ): Promise<string> {
    if (communication.notionPageId) {
      try {
        await notion.pages.update({
          page_id: communication.notionPageId,
          properties: communicationProperties(communication, clientPageId, taskPageId),
        });
        return communication.notionPageId;
      } catch {
        // recrear si falla
      }
    }

    const page = (await notion.pages.create({
      parent: { database_id: dbId },
      properties: communicationProperties(communication, clientPageId, taskPageId),
    })) as PageObjectResponse;

    await prisma.communication.update({ where: { id: communication.id }, data: { notionPageId: page.id } });
    return page.id;
  }

  private async recordTarget(
    prisma: PrismaClient,
    communicationId: string,
    pageId: string,
    status: "ok" | "error",
    errorMessage?: string
  ): Promise<void> {
    const existing = await prisma.activityTarget.findFirst({
      where: { communicationId, targetType: "notion" },
    });

    const url = `https://www.notion.so/${pageId.replace(/-/g, "")}`;
    if (existing) {
      await prisma.activityTarget.update({
        where: { id: existing.id },
        data: { status, targetId: pageId, targetUrl: url, errorMessage: errorMessage ?? null },
      });
    } else {
      await prisma.activityTarget.create({
        data: {
          communicationId,
          targetType: "notion",
          targetId: pageId,
          targetUrl: url,
          status,
          errorMessage: errorMessage ?? null,
        },
      });
    }
  }
}

function clientProperties(
  client: Client,
  emails?: { address: string }[],
  phones?: { address: string; channel: string }[]
): Record<string, any> {
  const areas = parseJsonArray(client.areas);
  return {
    Nombre: title(client.name),
    "NIF/CIF": richText(client.taxId ?? ""),
    Estado: select(client.status),
    Áreas: multiSelect(areas),
    Emails: richText(emails?.map((e) => e.address).join(", ") ?? ""),
    Teléfonos: richText(phones?.map((p) => `${p.channel}: ${p.address}`).join(", ") ?? ""),
    Responsable: richText(client.assignee ?? ""),
    "External ID": richText(client.id),
  };
}

function taskProperties(task: Task, clientPageId: string): Record<string, any> {
  const props: Record<string, any> = {
    Nombre: title(task.title),
    Cliente: relation(clientPageId),
    Área: select(task.area ?? ""),
    Responsable: richText(task.assignee ?? ""),
    Estado: select(task.status),
    Prioridad: select(task.priority),
    "Fecha de entrada": date(task.entryDate),
    Origen: select(task.origin),
    "Resumen IA": richText(task.summary),
    "Valoración económica": task.economicValue != null ? { number: task.economicValue } : { number: null },
    "External ID": richText(task.id),
  };
  if (task.dueDate) {
    props["Vencimiento"] = date(task.dueDate);
  }
  return props;
}

function communicationProperties(
  communication: Communication,
  clientPageId?: string,
  taskPageId?: string
): Record<string, any> {
  const props: Record<string, any> = {
    Asunto: title(communication.subject),
    Fecha: date(communication.receivedAt),
    Canal: select(communication.channel),
    Dirección: select(communication.direction),
    Remitente: richText(communication.from),
    Destinatario: richText(communication.to ?? ""),
    "Resumen IA": richText(communication.summary),
    Referencia: richText([communication.messageId, communication.externalRef].filter(Boolean).join(" | ")),
    "Requiere actuación": { checkbox: communication.relevance === "action" },
    "External ID": richText(communication.id),
  };
  if (clientPageId) {
    props.Cliente = relation(clientPageId);
  }
  if (taskPageId) {
    props.Tarea = relation(taskPageId);
  }
  return props;
}

function title(text: string) {
  return { title: [{ text: { content: text } }] };
}

function richText(text: string) {
  if (!text) return { rich_text: [] };
  return { rich_text: [{ text: { content: text } }] };
}

function select(name: string) {
  if (!name) return { select: null };
  return { select: { name } };
}

function multiSelect(names: string[]) {
  if (names.length === 0) return { multi_select: [] };
  return { multi_select: names.map((name) => ({ name })) };
}

function relation(pageId: string) {
  return { relation: [{ id: pageId }] };
}

function date(value: Date) {
  return { date: { start: value.toISOString() } };
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
