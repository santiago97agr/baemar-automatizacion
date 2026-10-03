/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Client, PrismaClient } from "@prisma/client";
import { notion } from "@/lib/notion";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { Client as NotionClient } from "@notionhq/client";

const SYNC_TTL_MS = 5 * 60 * 1000; // 5 minutos

export type NotionClientSearchResult =
  | { client: Client; source: "notion" | "cache" }
  | { client: null; source: "notion" | "cache" };

/**
 * Busca un cliente en Notion por su email principal y actualiza el espejo local.
 * Si el cliente local ya existe y está fresco, se devuelve desde SQLite.
 */
export async function searchClientByEmail(
  prisma: PrismaClient,
  email: string
): Promise<NotionClientSearchResult> {
  const normalized = normalizeEmail(email);
  if (!normalized) return { client: null, source: "cache" };

  const cached = await prisma.client.findFirst({
    where: { email: normalized },
    orderBy: { lastSyncedAt: "desc" },
  });

  if (cached && cached.lastSyncedAt && Date.now() - cached.lastSyncedAt.getTime() < SYNC_TTL_MS) {
    return { client: cached, source: "cache" };
  }

  const clientsDbId = process.env.NOTION_CLIENTS_DB_ID;
  if (!clientsDbId) {
    throw new Error("NOTION_CLIENTS_DB_ID no configurado");
  }

  const pages = await queryNotionClientsByEmail(clientsDbId, normalized);

  if (pages.length === 0) {
    return { client: null, source: "notion" };
  }

  if (pages.length > 1) {
    // Ambiguo: no asignamos ninguno.
    return { client: null, source: "notion" };
  }

  const client = await upsertClientFromNotionPage(prisma, pages[0]);
  return { client, source: "notion" };
}

/**
 * Búsqueda por nombre para el selector manual. Siempre consulta Notion.
 */
export async function searchClientByName(
  prisma: PrismaClient,
  query: string,
  limit = 20
): Promise<Client[]> {
  if (!query.trim()) return [];

  const clientsDbId = process.env.NOTION_CLIENTS_DB_ID;
  if (!clientsDbId) {
    throw new Error("NOTION_CLIENTS_DB_ID no configurado");
  }

  const response = await queryNotionDatabase(notion, clientsDbId, {
    filter: {
      or: [
        { property: "Nombre", title: { contains: query } },
        { property: "Emails", rich_text: { contains: query } },
      ],
    },
    page_size: limit,
  });

  const pages = response.results.filter(isFullPage);
  const upserts = await Promise.all(pages.map((page: PageObjectResponse) => upsertClientFromNotionPage(prisma, page)));
  return upserts;
}

/**
 * Sincroniza una página de cliente de Notion al espejo local.
 */
export async function refreshClientFromNotion(
  prisma: PrismaClient,
  notionPageId: string
): Promise<Client | null> {
  try {
    const page = await notion.pages.retrieve({ page_id: notionPageId });
    if (!isFullPage(page)) return null;
    return upsertClientFromNotionPage(prisma, page);
  } catch {
    return null;
  }
}

/**
 * Backfill: trae todas las páginas activas de la DB de clientes en Notion.
 */
export async function syncAllClients(prisma: PrismaClient): Promise<{ count: number }> {
  const clientsDbId = process.env.NOTION_CLIENTS_DB_ID;
  if (!clientsDbId) {
    throw new Error("NOTION_CLIENTS_DB_ID no configurado");
  }

  let cursor: string | undefined;
  let count = 0;

  do {
    const response = await queryNotionDatabase(notion, clientsDbId, {
      start_cursor: cursor,
      page_size: 100,
    });

    const pages = response.results.filter(isFullPage);
    await Promise.all(pages.map((page: PageObjectResponse) => upsertClientFromNotionPage(prisma, page)));
    count += pages.length;
    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  return { count };
}

async function queryNotionClientsByEmail(
  clientsDbId: string,
  email: string
): Promise<PageObjectResponse[]> {
  const response = await queryNotionDatabase(notion, clientsDbId, {
    filter: {
      // Notion no permite filtro exacto sobre rich_text; buscamos contención
      // y filtramos manualmente en el resultado.
      property: "Emails",
      rich_text: { contains: email },
    },
  });

  const pages = response.results.filter(isFullPage);

  // Notion "contains" puede dar falsos positivos; filtramos manualmente.
  return pages.filter((page: PageObjectResponse) => {
    const emails = extractEmailsFromPage(page);
    return emails.includes(email);
  });
}

async function queryNotionDatabase(
  client: NotionClient,
  databaseId: string,
  body: Record<string, unknown>
): Promise<{ results: unknown[]; next_cursor?: string | null; has_more?: boolean }> {
  return client.request({
    path: `databases/${databaseId}/query`,
    method: "post",
    body,
  }) as Promise<{ results: unknown[]; next_cursor?: string | null; has_more?: boolean }>;
}

export async function upsertClientFromNotionPage(
  prisma: PrismaClient,
  page: PageObjectResponse
): Promise<Client> {
  const props = page.properties;
  const name = getTitle(props["Nombre"]) || "Sin nombre";
  const emailsRaw = getRichText(props["Emails"]);
  const emails = parseEmailList(emailsRaw);
  const primaryEmail = emails[0] || null;

  const taxId = getRichText(props["NIF/CIF"]) || null;
  const status = getSelect(props["Estado"]) || "Activo";
  const areasText = getMultiSelect(props["Áreas"]);

  return prisma.client.upsert({
    where: { notionPageId: page.id },
    update: {
      name,
      email: primaryEmail,
      taxId,
      status,
      areas: JSON.stringify(areasText),
      lastSyncedAt: new Date(),
    },
    create: {
      notionPageId: page.id,
      name,
      email: primaryEmail,
      taxId,
      status,
      areas: JSON.stringify(areasText),
      lastSyncedAt: new Date(),
    },
  });
}

function extractEmailsFromPage(page: PageObjectResponse): string[] {
  const props = page.properties;
  return parseEmailList(getRichText(props["Emails"]));
}

function parseEmailList(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((e) => normalizeEmail(e))
    .filter(Boolean) as string[];
}

function isFullPage(page: any): page is PageObjectResponse {
  return page?.object === "page" && "properties" in page;
}

function getTitle(prop: any): string {
  if (prop?.type !== "title" || !Array.isArray(prop.title)) return "";
  return prop.title.map((t: any) => t.plain_text || t.text?.content || "").join("");
}

function getRichText(prop: any): string {
  if (prop?.type !== "rich_text" || !Array.isArray(prop.rich_text)) return "";
  return prop.rich_text.map((t: any) => t.plain_text || t.text?.content || "").join("");
}

function getSelect(prop: any): string | null {
  if (prop?.type !== "select") return null;
  return prop.select?.name || null;
}

function getMultiSelect(prop: any): string[] {
  if (prop?.type !== "multi_select" || !Array.isArray(prop.multi_select)) return [];
  return prop.multi_select.map((s: any) => s.name).filter(Boolean);
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const cleaned = email.toLowerCase().trim();
  if (!/^\S+@\S+\.\S+$/.test(cleaned)) return null;
  return cleaned;
}
