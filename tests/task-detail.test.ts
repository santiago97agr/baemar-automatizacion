import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { getTestPrisma, cleanDatabase, createTestClient, uniqueEmail } from "./helpers";

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

async function seedTaskWithFiles(opts: {
  withFiles: boolean;
}): Promise<{ taskId: string; commId: string; fileIds: string[] }> {
  const { id: clientId } = await createTestClient(prisma, { name: "Cliente", email: uniqueEmail() });
  const comm = await prisma.communication.create({
    data: {
      messageId: `msg-${Date.now()}-${Math.random()}`,
      channel: "Email",
      from: "x@x.com",
      subject: "S",
      body: "",
      receivedAt: new Date(),
      clientId,
    },
  });
  const task = await prisma.task.create({
    data: {
      clientId,
      title: "Tarea test",
      area: "Fiscal",
      status: "Pendiente",
      priority: "Normal",
    },
  });
  await prisma.communication.update({
    where: { id: comm.id },
    data: { taskId: task.id },
  });

  const fileIds: string[] = [];
  if (opts.withFiles) {
    const a = await prisma.attachment.create({
      data: {
        communicationId: comm.id,
        filename: "doc.pdf",
        contentBase64: Buffer.from("hi").toString("base64"),
        uploadStatus: "uploaded",
        dropboxPath: "/path/doc.pdf",
      },
    });
    fileIds.push(a.id);
  }
  return { taskId: task.id, commId: comm.id, fileIds };
}

describe("GET /api/tasks/[id]", () => {
  it("devuelve la tarea con communications.files (no con attachments)", async () => {
    const { taskId } = await seedTaskWithFiles({ withFiles: true });

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        client: true,
        communications: {
          orderBy: { receivedAt: "desc" },
          include: { files: { orderBy: { createdAt: "asc" } } },
        },
      },
    });

    assert.ok(task);
    assert.equal(task.id, taskId);
    assert.ok(task.client);
    assert.equal(task.communications.length, 1);
    assert.equal(task.communications[0].files.length, 1);
    assert.equal(task.communications[0].files[0].filename, "doc.pdf");

    // task no debe tener una clave attachments
    const raw = task as unknown as Record<string, unknown>;
    assert.equal(raw.attachments, undefined);
  });

  it("no falla cuando no hay archivos adjuntos", async () => {
    const { taskId } = await seedTaskWithFiles({ withFiles: false });

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        client: true,
        communications: {
          orderBy: { receivedAt: "desc" },
          include: { files: true },
        },
      },
    });

    assert.ok(task);
    assert.equal(task.communications.length, 1);
    assert.equal(task.communications[0].files.length, 0);
  });
});