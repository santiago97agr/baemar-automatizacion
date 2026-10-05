import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { finalizeReview } from "@/lib/processing/finalize-review";
import {
  getTestPrisma,
  cleanDatabase,
  createTestClient,
  uniqueEmail,
} from "./helpers";

let prisma: PrismaClient;

before(async () => {
  prisma = await getTestPrisma();
});

beforeEach(async () => {
  await cleanDatabase(prisma);
});

after(async () => {
  await prisma.$disconnect();
});

const noopUpload = async () => ({
  status: "uploaded" as const,
  dropboxPath: "/dropbox/file.pdf",
});

async function seedFailedIACommunication(opts: {
  clientId: string | null;
  relevance: "action" | "info" | "irrelevant";
  withAttachment?: boolean;
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
      clientId: opts.clientId,
      title: "Título provisional",
      type: "Fiscal",
      priority: "Urgente",
      description: "Descripción provisional",
      summary: "Resumen provisional",
      reviewStatus: "pending",
      needsReview: true,
      reviewReason: "Respuesta de IA inválida: ...",
      processingStatus: "error",
      status: "error",
      errorMessage: "ai_validation_failed: ...",
      attachments: opts.withAttachment ? JSON.stringify([{ filename: "doc.pdf" }]) : null,
    },
  });
  if (opts.withAttachment) {
    await prisma.attachment.create({
      data: {
        communicationId: comm.id,
        filename: "doc.pdf",
        contentBase64: Buffer.from("fake-content").toString("base64"),
        uploadStatus: "pending",
      },
    });
  }
  return { communicationId: comm.id };
}

describe("finalizeReview", () => {
  it("crea la Task cuando la comunicación es action y tiene cliente", async () => {
    const client = await createTestClient(prisma, { name: "Cliente A", email: uniqueEmail() });
    const { communicationId } = await seedFailedIACommunication({
      clientId: client.id,
      relevance: "action",
    });

    const syncCalls: { isNewTask: boolean; taskId?: string }[] = [];
    const syncNotion = {
      syncFromDecision: async (
        _deps: { prisma: PrismaClient },
        decision: { isNewTask: boolean; task?: { id: string } }
      ) => {
        syncCalls.push({
          isNewTask: decision.isNewTask,
          taskId: decision.task?.id,
        });
      },
    };

    const result = await finalizeReview(
      { prisma, uploadAttachment: noopUpload, syncNotion },
      communicationId
    );

    assert.equal(result.isNewTask, true);
    assert.ok(result.task);
    assert.equal(result.task?.clientId, client.id);
    assert.equal(result.task?.status, "Pendiente");

    const tasks = await prisma.task.findMany();
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].id, result.task?.id);

    const updated = await prisma.communication.findUnique({ where: { id: communicationId } });
    assert.equal(updated?.taskId, result.task?.id);
    assert.equal(updated?.processingStatus, "done");
    assert.equal(updated?.status, "ok");
    assert.equal(updated?.errorMessage, null);

    assert.equal(syncCalls.length, 1);
    assert.equal(syncCalls[0].isNewTask, true);
    assert.equal(syncCalls[0].taskId, result.task?.id);
  });

  it("no crea Task cuando la comunicación es info aunque tenga cliente", async () => {
    const client = await createTestClient(prisma, { name: "Cliente A", email: uniqueEmail() });
    const { communicationId } = await seedFailedIACommunication({
      clientId: client.id,
      relevance: "info",
    });

    const result = await finalizeReview(
      { prisma, uploadAttachment: noopUpload, syncNotion: { syncFromDecision: async () => {} } },
      communicationId
    );

    assert.equal(result.isNewTask, false);
    assert.equal(result.task, undefined);
    const tasks = await prisma.task.findMany();
    assert.equal(tasks.length, 0);
  });

  it("no crea Task cuando la comunicación action no tiene cliente", async () => {
    const { communicationId } = await seedFailedIACommunication({
      clientId: null,
      relevance: "action",
    });

    const result = await finalizeReview(
      { prisma, uploadAttachment: noopUpload, syncNotion: { syncFromDecision: async () => {} } },
      communicationId
    );

    assert.equal(result.isNewTask, false);
    assert.equal(result.task, undefined);
    const tasks = await prisma.task.findMany();
    assert.equal(tasks.length, 0);
  });

  it("sube adjuntos pendientes a Dropbox", async () => {
    const client = await createTestClient(prisma, { name: "Cliente A", email: uniqueEmail() });
    const { communicationId } = await seedFailedIACommunication({
      clientId: client.id,
      relevance: "action",
      withAttachment: true,
    });

    let uploadInvokedWith: { commId: string; clientId: string | null } = {
      commId: "",
      clientId: null,
    };
    const uploadAttachment = async (attachment: { communicationId: string }) => {
      uploadInvokedWith = { commId: attachment.communicationId, clientId: null };
      return { status: "uploaded" as const, dropboxPath: "/dropbox/doc.pdf" };
    };

    await finalizeReview(
      {
        prisma,
        uploadAttachment,
        syncNotion: {
          syncFromDecision: async (_d, decision) => {
            uploadInvokedWith.clientId = decision.task?.clientId ?? null;
          },
        },
      },
      communicationId
    );

    assert.equal(uploadInvokedWith.commId, communicationId);

    const attachments = await prisma.attachment.findMany({ where: { communicationId } });
    assert.equal(attachments.length, 1);
    assert.equal(attachments[0].uploadStatus, "uploaded");
    assert.equal(attachments[0].dropboxPath, "/dropbox/doc.pdf");
    assert.equal(attachments[0].clientId, client.id);
  });

  it("es idempotente: una segunda llamada no duplica Task ni Notion sync", async () => {
    const client = await createTestClient(prisma, { name: "Cliente A", email: uniqueEmail() });
    const { communicationId } = await seedFailedIACommunication({
      clientId: client.id,
      relevance: "action",
    });

    let syncCalls = 0;
    const syncNotion = {
      syncFromDecision: async (
        deps: { prisma: PrismaClient },
        decision: { communication: { id: string } }
      ) => {
        syncCalls++;
        await deps.prisma.activityTarget.create({
          data: {
            communicationId: decision.communication.id,
            targetType: "notion",
            targetId: `page-${syncCalls}`,
            status: "ok",
          },
        });
      },
    };

    await finalizeReview({ prisma, uploadAttachment: noopUpload, syncNotion }, communicationId);
    await finalizeReview({ prisma, uploadAttachment: noopUpload, syncNotion }, communicationId);

    const tasks = await prisma.task.findMany();
    assert.equal(tasks.length, 1);
    assert.equal(syncCalls, 1);
  });

  it("registra error de Notion en ErrorLog sin abortar", async () => {
    const client = await createTestClient(prisma, { name: "Cliente A", email: uniqueEmail() });
    const { communicationId } = await seedFailedIACommunication({
      clientId: client.id,
      relevance: "action",
    });

    const syncNotion = {
      syncFromDecision: async () => {
        throw new Error("notion 500");
      },
    };

    const result = await finalizeReview(
      { prisma, uploadAttachment: noopUpload, syncNotion },
      communicationId
    );

    assert.deepEqual(result.errors, ["notion 500"]);
    const errors = await prisma.errorLog.findMany({ where: { communicationId } });
    assert.equal(errors.length, 1);
    assert.equal(errors[0].source, "sync");
  });
});