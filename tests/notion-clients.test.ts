import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { normalizeEmail, upsertClientFromNotionPage } from "@/lib/sync/notion-clients";
import { identifyClientByEmail } from "@/lib/processing/identify-client";
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

function makeNotionPage(overrides: {
  id?: string;
  name?: string;
  email?: string;
  emails?: string;
  taxId?: string;
  status?: string;
  areas?: string[];
  assignee?: string;
}) {
  return {
    object: "page",
    id: overrides.id || `page-${Date.now()}`,
    properties: {
      Nombre: { type: "title", title: [{ plain_text: overrides.name || "Cliente Notion" }] },
      Emails: { type: "rich_text", rich_text: overrides.email ? [{ plain_text: overrides.email }] : [] },
      "NIF/CIF": { type: "rich_text", rich_text: overrides.taxId ? [{ plain_text: overrides.taxId }] : [] },
      Estado: { type: "select", select: overrides.status ? { name: overrides.status } : null },
      Áreas: { type: "multi_select", multi_select: (overrides.areas || []).map((a) => ({ name: a })) },
      Responsable: { type: "rich_text", rich_text: overrides.assignee ? [{ plain_text: overrides.assignee }] : [] },
    },
  } as unknown as Parameters<typeof upsertClientFromNotionPage>[1];
}

describe("Notion clients mirror", () => {
  it("normaliza emails correctamente", () => {
    assert.equal(normalizeEmail("Foo@Example.COM"), "foo@example.com");
    assert.equal(normalizeEmail("not-an-email"), null);
    assert.equal(normalizeEmail(null), null);
  });

  it("upsert crea cliente desde página de Notion", async () => {
    const page = makeNotionPage({ email: "cliente@example.com", areas: ["Fiscal", "Laboral"] });
    const client = await upsertClientFromNotionPage(prisma, page);

    assert.equal(client.name, "Cliente Notion");
    assert.equal(client.email, "cliente@example.com");
    assert.equal(client.notionPageId, page.id);
    assert.equal(client.status, "Activo");
    assert.deepEqual(JSON.parse(client.areas), ["Fiscal", "Laboral"]);
  });

  it("upsert actualiza cliente existente por notionPageId", async () => {
    const notionPageId = `page-${Date.now()}`;
    await createTestClient(prisma, { name: "Antiguo", email: "old@example.com", notionPageId });

    const page = makeNotionPage({ id: notionPageId, name: "Renombrado", email: "new@example.com" });
    const client = await upsertClientFromNotionPage(prisma, page);

    assert.equal(client.name, "Renombrado");
    assert.equal(client.email, "new@example.com");
  });

  it("extrae emails de formatos con nombre y paréntesis", async () => {
    const page = {
      object: "page",
      id: `page-rich-${Date.now()}`,
      properties: {
        Nombre: { type: "title", title: [{ plain_text: "Cliente AB" }] },
        Emails: {
          type: "rich_text",
          rich_text: [{ plain_text: "Cliente Empresa <ab@empresa.com>, cd@empresa.com (CFO)" }],
        },
        "NIF/CIF": { type: "rich_text", rich_text: [] },
        Estado: { type: "select", select: { name: "Activo" } },
        Áreas: { type: "multi_select", multi_select: [] },
      },
    } as unknown as Parameters<typeof upsertClientFromNotionPage>[1];

    const client = await upsertClientFromNotionPage(prisma, page);
    assert.equal(client.email, "ab@empresa.com");

    const refreshed = await upsertClientFromNotionPage(prisma, page);
    assert.equal(refreshed.id, client.id);
    assert.equal(refreshed.email, "ab@empresa.com");
  });

  it("encuentra email embebido en campos distintos a Emails", async () => {
    const page = {
      object: "page",
      id: `page-embed-${Date.now()}`,
      properties: {
        Nombre: { type: "title", title: [{ plain_text: "Cliente Embebido" }] },
        Emails: { type: "rich_text", rich_text: [] },
        Responsable: {
          type: "rich_text",
          rich_text: [{ plain_text: "Contacto: embebido@ejemplo.com (CEO)" }],
        },
        Estado: { type: "select", select: { name: "Activo" } },
        Áreas: { type: "multi_select", multi_select: [] },
      },
    } as unknown as Parameters<typeof upsertClientFromNotionPage>[1];

    const client = await upsertClientFromNotionPage(prisma, page);
    assert.equal(client.email, "embebido@ejemplo.com");
  });
});

describe("identify-client con Notion", () => {
  it("devuelve null cuando no hay email", async () => {
    const res = await identifyClientByEmail(prisma, "sin-email");
    assert.equal(res.clientId, null);
    assert.equal(res.ambiguous, false);
  });

  it("usa cliente en espejo cuando coincide el email y está fresco", async () => {
    const email = uniqueEmail();
    const { id: clientId } = await createTestClient(prisma, { name: "Cliente Fresco", email });

    const res = await identifyClientByEmail(prisma, `"Remitente" <${email}>`);
    assert.equal(res.clientId, clientId);
    assert.equal(res.ambiguous, false);
  });
});
