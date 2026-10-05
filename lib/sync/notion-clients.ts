/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Client, PrismaClient } from "@prisma/client";
import { notion } from "@/lib/notion";
import { queryDataSource } from "@/lib/notion-data-sources";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

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

  let cursor: string | undefined;
  const collected: Client[] = [];

  do {
    const response = await queryDataSource(clientsDbId, {
      filter: {
        or: [
          { property: "Nombre", title: { contains: query } },
          { property: "Emails", rich_text: { contains: query } },
        ],
      },
      start_cursor: cursor,
      page_size: 100,
    });

    const pages = response.results.filter(isFullPage) as PageObjectResponse[];
    const upserts = await Promise.all(pages.map((page) => upsertClientFromNotionPage(prisma, page)));
    collected.push(...upserts);
    if (collected.length >= limit) break;
    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  return collected.slice(0, limit);
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
    const response = await queryDataSource(clientsDbId, {
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
  // Notion no permite filtro exacto sobre rich_text; "contains" puede dar falsos positivos
  // y omitir matches si el email está embebido en otro campo (p. ej. Notas). Filtramos
  // manualmente tras recibir todas las páginas (con paginación).
  let cursor: string | undefined;
  const matched: PageObjectResponse[] = [];

  do {
    const response = await queryDataSource(clientsDbId, {
      filter: {
        property: "Emails",
        rich_text: { contains: email },
      },
      start_cursor: cursor,
      page_size: 100,
    });

    const pages = response.results.filter(isFullPage) as PageObjectResponse[];
    for (const page of pages) {
      const emails = extractEmailsFromPage(page);
      if (emails.includes(email)) matched.push(page);
    }
    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  return matched;
}

export async function upsertClientFromNotionPage(
  prisma: PrismaClient,
  page: PageObjectResponse
): Promise<Client> {
  const props = page.properties;
  const name = getTitle(props["Nombre"]) || "Sin nombre";
  // Buscamos emails en cualquier campo rich_text del cliente, no solo en "Emails",
  // porque en Notion los emails a veces están embebidos en Nombre, Responsable o notas.
  const allEmails = extractEmailsFromPage(page);
  const primaryEmail = allEmails[0] || null;

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
  const all = new Set<string>();
  for (const value of Object.values(props)) {
    const text = getRichText(value);
    if (!text) continue;
    for (const email of parseEmailList(text)) all.add(email);
  }
  return Array.from(all);
}

function parseEmailList(raw: string): string[] {
  if (!raw) return [];
  const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  const matches = raw.match(EMAIL_RE);
  if (!matches) return [];
  const out = new Set<string>();
  for (const m of matches) {
    const normalized = normalizeEmail(m);
    if (normalized) out.add(normalized);
  }
  return Array.from(out);
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
