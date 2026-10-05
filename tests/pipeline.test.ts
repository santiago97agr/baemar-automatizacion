import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { processCommunication } from "@/lib/processing/pipeline";
import type { ClassifiedResponse } from "@/lib/ai";

import { getTestPrisma, cleanDatabase, createTestClient, createTestTask, uniqueEmail } from "./helpers";

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

function makeClassify(result: Partial<ClassifiedResponse>) {
  return async () => ({
    relevance: "action" as const,
    needsReview: false,
    ...result,
  });
}

const noopUpload = async () => ({ status: "uploaded" as const, dropboxPath: "/x/file.pdf" });
const noopSync = { syncFromDecision: async () => {} };

function baseInput(email: string) {
  return {
    messageId: `msg-${Date.now()}`,
    from: `"Test" <${email}>`,
    subject: "Asunto de prueba",
    body: "Cuerpo de prueba",
  };
}

// Reemplaza la identificación por una versión determinista basada en el espejo local.
function identifyFromMirror(prismaClient: PrismaClient) {
  return async (fromHeader: string) => {
    // Evita llamadas a Notion en los tests: busca directamente en el espejo local.
    const email = fromHeader.match(/<([^>]+)>/)
      ? fromHeader.match(/<([^>]+)>/)![1]
      : fromHeader.trim();
    const client = await prismaClient.client.findFirst({
      where: { email: email.toLowerCase() },
      orderBy: { lastSyncedAt: "desc" },
    });
    if (client) return { clientId: client.id, ambiguous: false as const };
    return { clientId: null, ambiguous: false as const };
  };
}

function processWithMirror(
  input: unknown,
  classify: (input: { subject: string; from: string; body: string }) => Promise<Record<string, unknown>>,
  uploadAttachment = noopUpload,
  syncNotion = noopSync
) {
  return processCommunication(
    { prisma, classify, identifyClient: identifyFromMirror(prisma), uploadAttachment, syncNotion },
    input
  );
}

describe("Pipeline de procesamiento", () => {
  it("correo irrelevante: registra comunicación sin crear tarea", async () => {
    const classify = makeClassify({ relevance: "irrelevant", needsReview: false });
    const res = await processWithMirror(baseInput(uniqueEmail()), classify);

    const comm = await prisma.communication.findUnique({ where: { id: res.communicationId } });
    assert.equal(comm?.relevance, "irrelevant");
    const tasks = await prisma.task.findMany();
    assert.equal(tasks.length, 0);
  });

  it("correo informativo: registra comunicación sin crear tarea", async () => {
    const classify = makeClassify({ relevance: "info", needsReview: false });
    const res = await processWithMirror(baseInput(uniqueEmail()), classify);

    const comm = await prisma.communication.findUnique({ where: { id: res.communicationId } });
    assert.equal(comm?.relevance, "info");
    const tasks = await prisma.task.findMany();
    assert.equal(tasks.length, 0);
  });

  it("nueva solicitud: crea tarea y la relaciona con el cliente", async () => {
    const email = uniqueEmail();
    const { id: clientId } = await createTestClient(prisma, { name: "Cliente Prueba", email });
    const classify = makeClassify({ relevance: "action", isNewTask: true, title: "Nueva tarea", area: "Fiscal", priority: "Normal", needsReview: false });

    const res = await processWithMirror(baseInput(email), classify);

    const comm = await prisma.communication.findUnique({ where: { id: res.communicationId } });
    assert.equal(comm?.clientId, clientId);
    assert.ok(comm?.taskId);
    const task = await prisma.task.findUnique({ where: { id: comm!.taskId! } });
    assert.equal(task?.clientId, clientId);
    assert.equal(task?.title, "Nueva tarea");
  });

  it("dos correos no relacionados del mismo cliente crean tareas separadas", async () => {
    const email = uniqueEmail();
    const { id: clientId } = await createTestClient(prisma, { name: "Cliente Prueba", email });
    const { id: existingTaskId } = await createTestTask(prisma, clientId, "Declaración IVA 1T", { area: "Fiscal" });

    const classify: (input: { subject: string; from: string; body: string }) => Promise<Record<string, unknown>> = async (
      input
    ) => {
      if (input.subject.includes("Nóminas")) {
        return {
          relevance: "action",
          isNewTask: false,
          matchedTaskId: existingTaskId,
          title: "Consulta nóminas",
          area: "Laboral",
          priority: "Normal",
          needsReview: false,
        };
      }
      return {
        relevance: "action",
        isNewTask: true,
        title: input.subject,
        area: "General",
        priority: "Normal",
        needsReview: false,
      };
    };

    const res = await processWithMirror(
      {
        messageId: `msg-nominas-${Date.now()}`,
        from: `"Test" <${email}>`,
        subject: "Nóminas de enero",
        body: "Consulta sobre nóminas de enero",
      },
      classify
    );

    const comm = await prisma.communication.findUnique({ where: { id: res.communicationId } });
    assert.notEqual(comm?.taskId, existingTaskId, "No debe vincularse a la tarea existente de área distinta");
    const tasks = await prisma.task.findMany({ where: { clientId } });
    assert.equal(tasks.length, 2, "Debe crear una nueva tarea en lugar de fusionar");
    const newTask = tasks.find((t) => t.id !== existingTaskId);
    assert.equal(newTask?.area, "Laboral");
    assert.equal(comm?.taskId, newTask?.id);
  });

  it("información adicional: se vincula a una tarea existente", async () => {
    const email = uniqueEmail();
    const { id: clientId } = await createTestClient(prisma, { name: "Cliente Prueba", email });
    const { id: taskId } = await createTestTask(prisma, clientId, "Tarea existente");
    const classify = makeClassify({ relevance: "info", matchedTaskId: taskId, needsReview: false });

    const res = await processWithMirror(baseInput(email), classify);

    const comm = await prisma.communication.findUnique({ where: { id: res.communicationId } });
    assert.equal(comm?.taskId, taskId);
    const tasks = await prisma.task.findMany();
    assert.equal(tasks.length, 1);
  });

  it("cliente desconocido: queda pendiente de revisión", async () => {
    const classify = makeClassify({ relevance: "action", needsReview: false });
    const res = await processWithMirror(baseInput(uniqueEmail()), classify);

    const comm = await prisma.communication.findUnique({ where: { id: res.communicationId } });
    assert.equal(comm?.needsReview, true);
    assert.equal(comm?.clientId, null);
    const tasks = await prisma.task.findMany();
    assert.equal(tasks.length, 0);
  });

  it("relación ambigua: no fusiona automáticamente y pide revisión", async () => {
    const email = uniqueEmail();
    const { id: clientId } = await createTestClient(prisma, { name: "Cliente Prueba", email });
    await createTestTask(prisma, clientId, "Tarea real");
    const classify = makeClassify({ relevance: "action", matchedTaskId: "tarea-inventada", needsReview: false });

    const res = await processWithMirror(baseInput(email), classify);

    const comm = await prisma.communication.findUnique({ where: { id: res.communicationId } });
    assert.equal(comm?.needsReview, true);
    const tasks = await prisma.task.findMany();
    assert.equal(tasks.length, 1);
  });

  it("correo duplicado: no duplica registros", async () => {
    const classify = makeClassify({ relevance: "irrelevant", needsReview: false });
    const input = baseInput(uniqueEmail());
    await processWithMirror(input, classify);
    const res2 = await processWithMirror(input, classify);

    const count = await prisma.communication.count();
    assert.equal(count, 1);
    assert.equal(res2.errors.length, 0);
  });

  it("error de Notion: conserva el registro local y permite recuperar la sincronización", async () => {
    const email = uniqueEmail();
    await createTestClient(prisma, { name: "Cliente Prueba", email });
    const classify = makeClassify({ relevance: "action", isNewTask: true, needsReview: false });
    let syncCalls = 0;
    const flakySync = {
      syncFromDecision: async () => {
        syncCalls++;
        if (syncCalls === 1) throw new Error("Notion timeout");
      },
    };

    const res1 = await processWithMirror(baseInput(email), classify, noopUpload, flakySync);
    assert.equal(res1.errors.length, 1);
    const errors = await prisma.errorLog.findMany({ where: { source: "sync" } });
    assert.equal(errors.length, 1);

    // Simular reintento: forzar estado error y reprocesar.
    const comm = await prisma.communication.findUnique({ where: { id: res1.communicationId } });
    await prisma.communication.update({ where: { id: comm!.id }, data: { processingStatus: "error" } });
    const res2 = await processWithMirror(baseInput(email), classify, noopUpload, flakySync);
    assert.equal(res2.errors.length, 0);
    assert.equal(syncCalls, 2);
  });

  it("error de Dropbox: conserva el registro local y permite reintentar la subida", async () => {
    const email = uniqueEmail();
    await createTestClient(prisma, { name: "Cliente Prueba", email });
    const classify = makeClassify({ relevance: "action", isNewTask: true, needsReview: false });
    let uploadCalls = 0;
    const flakyUpload = async () => {
      uploadCalls++;
      if (uploadCalls === 1) return { status: "error" as const, errorMessage: "Dropbox timeout" };
      return { status: "uploaded" as const, dropboxPath: "/x/file.pdf" };
    };

    const input = { ...baseInput(email), attachments: [{ filename: "doc.pdf", contentBase64: "SGVsbG8=" }] };
    await processWithMirror(input, classify, flakyUpload);
    const attachment = await prisma.attachment.findFirst();
    assert.equal(attachment?.uploadStatus, "error");

    // Reintentar subida vía pipeline: el adjunto en error se reintentará.
    await prisma.communication.update({ where: { id: attachment!.communicationId }, data: { processingStatus: "error" } });
    await processWithMirror(input, classify, flakyUpload);
    const updated = await prisma.attachment.findUnique({ where: { id: attachment!.id } });
    assert.equal(updated?.uploadStatus, "uploaded");
  });

  it("fallo de IA: no crea una tarea basada en una respuesta inválida", async () => {
    const email = uniqueEmail();
    await createTestClient(prisma, { name: "Cliente Prueba", email });
    const classify = async () => {
      throw new Error("IA no disponible");
    };

    const res = await processWithMirror(baseInput(email), classify);

    assert.equal(res.errors.length, 1);
    const comm = await prisma.communication.findUnique({ where: { id: res.communicationId } });
    assert.equal(comm?.status, "error");
    const tasks = await prisma.task.findMany();
    assert.equal(tasks.length, 0);
  });
});
