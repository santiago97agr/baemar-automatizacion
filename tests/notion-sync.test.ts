import { describe, it, before, beforeEach, after, mock } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { NotionSync } from "@/lib/sync/notion-sync";
import { notion } from "@/lib/notion";
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

describe("Notion sync properties", () => {
  it("envía contenido del correo y adjuntos Dropbox a la página de comunicación", async () => {
    const client = await createTestClient(prisma, {
      name: "Cliente Prueba",
      email: "cliente@example.com",
      notionPageId: "notion-client-page",
    });
    const task = await prisma.task.create({
      data: {
        clientId: client.id,
        title: "Tarea de prueba",
        notionPageId: "notion-task-page",
      },
    });
    const longBody = "Línea\n".repeat(400); // ~2.400 chars
    const communication = await prisma.communication.create({
      data: {
        messageId: "msg-test-1",
        channel: "Email",
        from: "remitente@example.com",
        to: "cliente@example.com",
        subject: "Asunto de prueba",
        body: longBody,
        summary: "Resumen generado",
        relevance: "action",
        clientId: client.id,
        taskId: task.id,
        attachments: JSON.stringify([{ filename: "doc.pdf", contentBase64: "abc" }]),
      },
    });
    await prisma.attachment.create({
      data: {
        communicationId: communication.id,
        filename: "doc.pdf",
        contentBase64: "abc",
        uploadStatus: "uploaded",
        dropboxPath: "/baemar/cliente-prueba/2026-10/doc.pdf",
        clientId: client.id,
      },
    });

    const captured: Record<string, unknown>[] = [];
    const restoreCreate = mock.method(notion.pages, "create", async (...args: unknown[]) => {
      if (args[0] && typeof args[0] === "object") captured.push(args[0] as Record<string, unknown>);
      return {
        id: "notion-comm-page",
        object: "page",
        created_time: new Date().toISOString(),
        last_edited_time: new Date().toISOString(),
        properties: {},
      };
    });
    const restoreUpdate = mock.method(notion.pages, "update", async (...args: unknown[]) => args[0]);

    process.env.NOTION_CLIENTS_DB_ID = "clients-db";
    process.env.NOTION_TASKS_DB_ID = "tasks-db";
    process.env.NOTION_COMMUNICATIONS_DB_ID = "comms-db";

    try {
      await new NotionSync().syncFromDecision(
        { prisma },
        {
          communication,
          task: { id: task.id, clientId: client.id },
          isNewTask: false,
          isNewClient: false,
        }
      );
    } finally {
      restoreCreate();
      restoreUpdate();
    }

    const createCall = captured.find((c) => (c.parent as { database_id?: string })?.database_id === "comms-db");
    assert.ok(createCall, "Se debería haber llamado a notion.pages.create para comunicaciones");

    const props = createCall.properties as Record<string, { rich_text?: { text?: { content?: string } }[]; title?: { text?: { content?: string } }[] }>;
    assert.equal(props.Asunto.title?.[0]?.text?.content, "Asunto de prueba");
    assert.ok(props.Contenido, "Debería enviar la propiedad Contenido");
    assert.ok(props.Contenido.rich_text && props.Contenido.rich_text.length > 1, "El body debería partirse en chunks");
    assert.ok(
      props.Contenido.rich_text?.every((item) => (item.text?.content?.length ?? 0) <= 1900),
      "Ningún chunk debería superar 1900 caracteres"
    );

    assert.ok(props["Adjuntos Dropbox"], "Debería enviar la propiedad Adjuntos Dropbox");
    const linksText = props["Adjuntos Dropbox"].rich_text?.map((t) => t.text?.content ?? "").join("") ?? "";
    assert.ok(linksText.includes("doc.pdf"), "Debería incluir el nombre del adjunto");
    assert.ok(
      linksText.includes("/baemar/cliente-prueba/2026-10/doc.pdf"),
      "Debería incluir el dropboxPath"
    );
  });
});
