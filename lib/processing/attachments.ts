import { createHash } from "crypto";
import type { PrismaClient, Communication, Attachment as AttachmentRecord } from "@prisma/client";
import type { ProcessingInputAttachment } from "./types";

export type UploadAttachmentFn = (
  attachment: AttachmentRecord,
  clientSlug: string,
  dateFolder: string
) => Promise<{ status: "uploaded" | "error"; dropboxPath?: string; errorMessage?: string }>;

export type AttachmentDeps = {
  prisma: PrismaClient;
  uploadAttachment?: UploadAttachmentFn;
};

export async function createAttachmentRecords(
  deps: AttachmentDeps,
  communicationId: string,
  inputAttachments: ProcessingInputAttachment[]
): Promise<AttachmentRecord[]> {
  if (inputAttachments.length === 0) return [];

  const { prisma } = deps;
  const records: AttachmentRecord[] = [];

  for (const input of inputAttachments) {
    const sha256 = input.sha256 || sha256FromBase64(input.contentBase64);
    const existing = await prisma.attachment.findUnique({
      where: { communicationId_filename: { communicationId, filename: input.filename } },
    });

    if (existing) {
      records.push(existing);
      continue;
    }

    const record = await prisma.attachment.create({
      data: {
        communicationId,
        filename: input.filename,
        contentType: input.contentType,
        size: input.size,
        sha256,
        contentBase64: input.contentBase64 ?? null,
        uploadStatus: "pending",
      },
    });
    records.push(record);
  }

  return records;
}

export async function uploadPendingAttachments(
  deps: AttachmentDeps,
  communication: Communication,
  relevance?: string | null
): Promise<AttachmentRecord[]> {
  const { prisma, uploadAttachment } = deps;
  if (!uploadAttachment) return [];

  const attachments = await prisma.attachment.findMany({
    where: { communicationId: communication.id, uploadStatus: { in: ["pending", "error"] } },
  });

  if (attachments.length === 0) return [];

  // Política de relevancia: no subir adjuntos de comunicaciones irrelevantes.
  if (relevance === "irrelevant") {
    await prisma.attachment.updateMany({
      where: { communicationId: communication.id },
      data: { uploadStatus: "skipped", errorMessage: "Comunicación irrelevante" },
    });
    return prisma.attachment.findMany({ where: { communicationId: communication.id } });
  }

  // Sin cliente identificado: se retienen hasta la revisión manual.
  if (!communication.clientId) {
    await prisma.attachment.updateMany({
      where: { communicationId: communication.id, uploadStatus: "pending" },
      data: { errorMessage: "Pendiente de asignación de cliente" },
    });
    return prisma.attachment.findMany({ where: { communicationId: communication.id } });
  }

  const client = await prisma.client.findUnique({ where: { id: communication.clientId } });
  const clientSlug = slug(client?.name || "sin-cliente");
  const dateFolder = folderDate(communication.receivedAt);

  const updated: AttachmentRecord[] = [];
  for (const attachment of attachments) {
    if (attachment.uploadStatus === "uploaded" && attachment.dropboxPath) {
      updated.push(attachment);
      continue;
    }

    const result = await uploadAttachment(attachment, clientSlug, dateFolder);
    const updatedRecord = await prisma.attachment.update({
      where: { id: attachment.id },
      data: {
        clientId: communication.clientId,
        uploadStatus: result.status,
        dropboxPath: result.dropboxPath ?? null,
        errorMessage: result.errorMessage ?? null,
        attempts: { increment: 1 },
      },
    });
    updated.push(updatedRecord);
  }

  return updated;
}

function sha256FromBase64(base64?: string): string | null {
  if (!base64) return null;
  try {
    const buffer = Buffer.from(base64, "base64");
    return createHash("sha256").update(buffer).digest("hex");
  } catch {
    return null;
  }
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function folderDate(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}
