import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { uploadPendingAttachments } from "@/lib/processing/attachments";
import { getTestPrisma, cleanDatabase, createTestClient } from "./helpers";

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

describe("Subida de adjuntos", () => {
  it("reintento tras subida satisfactoria no vuelve a llamar a Dropbox", async () => {
    const email = `test-${Date.now()}@example.com`;
    const { id: clientId } = await createTestClient(prisma, { name: "Cliente", email });
    const communication = await prisma.communication.create({
      data: {
        messageId: "msg-1",
        channel: "Email",
        from: email,
        subject: "Adjunto",
        body: "",
        clientId,
      },
    });
    const attachment = await prisma.attachment.create({
      data: {
        communicationId: communication.id,
        filename: "doc.pdf",
        contentBase64: "SGVsbG8=",
        uploadStatus: "pending",
      },
    });

    let calls = 0;
    const upload = async () => {
      calls++;
      return { status: "uploaded" as const, dropboxPath: "/cliente/doc.pdf" };
    };

    await uploadPendingAttachments({ prisma, uploadAttachment: upload }, communication, "action");
    assert.equal(calls, 1);
    const first = await prisma.attachment.findUnique({ where: { id: attachment.id } });
    assert.equal(first?.uploadStatus, "uploaded");

    await uploadPendingAttachments({ prisma, uploadAttachment: upload }, communication, "action");
    assert.equal(calls, 1); // No se reintenta porque ya está uploaded
  });
});
