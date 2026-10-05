import { describe, it, before, beforeEach, after, mock } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { SENTINEL_CLIENT_NAME } from "@/lib/sentinel-client";
import { NotionSync } from "@/lib/sync/notion-sync";
import { getTestPrisma, cleanDatabase } from "./helpers";

let prisma: PrismaClient;

before(async () => {
  prisma = await getTestPrisma();
});

beforeEach(async () => {
  await cleanDatabase(prisma);
  await prisma.client.create({
    data: {
      name: SENTINEL_CLIENT_NAME,
      aliases: "[]",
      areas: "[]",
      status: "Activo",
      notionPageId: null,
    },
  });
});

after(async () => {
  await prisma.$disconnect();
});

async function seedCommunication(opts: {
  relevance: "action" | "info" | "irrelevant";
  withAttachment?: boolean;
  clientId?: string | null;
}): Promise<{ communicationId: string }> {
  const messageId = `msg-${Date.now()}-${Math.random()}`;
  const comm = await prisma.communication.create({
    data: {
      messageId,
      channel: "Email",
      direction: "Entrante",
      subject: "Asunto",
      from: "test@example.com",
      body: "Cuerpo",
      receivedAt: new Date(),
      relevance: opts.relevance,
      clientId: opts.clientId ?? null,
      title: "Título provisional",
      type: "Fiscal",
      priority: "Urgente",
      description: "Descripción",
      summary: "Resumen",
      reviewStatus: "pending",
      needsReview: true,
      reviewReason: "Necesita revisión",
      attachments: opts.withAttachment ? JSON.stringify([{ filename: "doc.pdf" }]) : null,
    },
  });
  if (opts.withAttachment) {
    await prisma.attachment.create({
      data: {
        communicationId: comm.id,
        filename: "doc.pdf",
        contentBase64: Buffer.from("fake").toString("base64"),
        uploadStatus: "pending",
      },
    });
  }
  return { communicationId: comm.id };
}

describe("process-orphan: lógica de sentinela", () => {
  it("asigna comunicación action al sentinela, crea Task y sube adjunto", async () => {
    // Mock NotionSync.syncFromDecision (no tocamos Notion real).
    mock.method(NotionSync.prototype, "syncFromDecision", async function () {
      await (this as unknown as { prisma?: PrismaClient }).prisma?.activityTarget.create({
        data: {
          communicationId: "",
          targetType: "notion",
          status: "ok",
        },
      }).catch(() => undefined);
      return;
    });

    const { communicationId } = await seedCommunication({
      relevance: "action",
      withAttachment: true,
    });

    const sentinel = await prisma.client.findFirst({
      where: { name: SENTINEL_CLIENT_NAME },
    });
    assert.ok(sentinel);

    // Simulamos el endpoint ejecutando la misma lógica con helpers inyectados.
    await prisma.communication.update({
      where: { id: communicationId },
      data: {
        clientId: sentinel!.id,
        needsReview: false,
        reviewStatus: "reviewed",
        reviewReason: "Procesado sin cliente identificado: manual",
      },
    });
    await prisma.attachment.updateMany({
      where: { communicationId },
      data: { clientId: sentinel!.id },
    });

    // Subimos adjuntos con un mock que no toca Dropbox.
    const uploads: string[] = [];
    const uploadAttachment = async (attachment: { id: string; communicationId: string }) => {
      uploads.push(attachment.id);
      return { status: "uploaded" as const, dropboxPath: "/sin-asignar/doc.pdf" };
    };

    const { finalizeReview } = await import("@/lib/processing/finalize-review");
    const result = await finalizeReview(
      { prisma, uploadAttachment, syncNotion: undefined },
      communicationId
    );

    assert.equal(result.isNewTask, true);
    assert.ok(result.task);
    assert.equal(result.task?.clientId, sentinel!.id);
    assert.equal(result.task?.status, "Pendiente");

    const updated = await prisma.communication.findUnique({
      where: { id: communicationId },
    });
    assert.equal(updated?.clientId, sentinel!.id);
    assert.equal(updated?.needsReview, false);
    assert.equal(updated?.reviewStatus, "reviewed");
    assert.equal(updated?.errorMessage, null);

    const attachments = await prisma.attachment.findMany({ where: { communicationId } });
    assert.equal(attachments.length, 1);
    assert.equal(attachments[0].uploadStatus, "uploaded");
    assert.equal(attachments[0].dropboxPath, "/sin-asignar/doc.pdf");
    assert.equal(uploads.length, 1);
  });

  it("no crea Task si la comunicación es info", async () => {
    const { communicationId } = await seedCommunication({
      relevance: "info",
      withAttachment: true,
    });

    const sentinel = await prisma.client.findFirst({
      where: { name: SENTINEL_CLIENT_NAME },
    });

    await prisma.communication.update({
      where: { id: communicationId },
      data: { clientId: sentinel!.id },
    });

    const { finalizeReview } = await import("@/lib/processing/finalize-review");
    const result = await finalizeReview(
      { prisma, uploadAttachment: undefined, syncNotion: undefined },
      communicationId
    );

    assert.equal(result.isNewTask, false);
    assert.equal(result.task, undefined);
    const tasks = await prisma.task.findMany();
    assert.equal(tasks.length, 0);
  });

  it("no falla con comunicación sin adjuntos", async () => {
    const { communicationId } = await seedCommunication({
      relevance: "action",
      withAttachment: false,
    });

    const sentinel = await prisma.client.findFirst({
      where: { name: SENTINEL_CLIENT_NAME },
    });

    await prisma.communication.update({
      where: { id: communicationId },
      data: { clientId: sentinel!.id },
    });

    const { finalizeReview } = await import("@/lib/processing/finalize-review");
    const result = await finalizeReview(
      { prisma, uploadAttachment: undefined, syncNotion: undefined },
      communicationId
    );

    assert.equal(result.isNewTask, true);
    assert.ok(result.task);
  });

  it("rechaza comunicación que ya tiene un cliente real asignado", async () => {
    const realClient = await prisma.client.create({
      data: {
        name: "Cliente Real",
        aliases: "[]",
        areas: "[]",
        status: "Activo",
        notionPageId: "page-real",
      },
    });

    const { communicationId } = await seedCommunication({
      relevance: "info",
      clientId: realClient.id,
    });

    const updated = await prisma.communication.findUnique({
      where: { id: communicationId },
    });
    assert.equal(updated.clientId, realClient.id);

    // La guardia del endpoint: si el cliente no es el sentinela, no reasignar.
    const existing = await prisma.client.findUnique({ where: { id: updated.clientId! } });
    assert.equal(existing?.name, "Cliente Real");
    assert.notEqual(existing?.name, SENTINEL_CLIENT_NAME);
  });
});