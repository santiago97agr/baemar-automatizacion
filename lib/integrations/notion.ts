import { notion } from "@/lib/notion";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { Integration, IntegrationResult, NormalizedActivity } from "./types";

export class NotionIntegration implements Integration {
  readonly type = "notion";

  async push(activity: NormalizedActivity): Promise<IntegrationResult> {
    const tasksDbId = process.env.NOTION_TASKS_DB_ID;
    const historyDbId = process.env.NOTION_HISTORY_DB_ID;

    if (!tasksDbId || !historyDbId) {
      return {
        status: "error",
        errorMessage: "NOTION_TASKS_DB_ID or NOTION_HISTORY_DB_ID not configured",
      };
    }

    const historyPage = (await notion.pages.create({
      parent: { database_id: historyDbId },
      properties: {
        Asunto: { title: [{ text: { content: activity.subject } }] },
        Remitente: { rich_text: [{ text: { content: activity.from } }] },
        Fecha: { date: { start: new Date().toISOString() } },
        Resumen: { rich_text: [{ text: { content: activity.summary } }] },
      },
    })) as PageObjectResponse;

    const taskPage = (await notion.pages.create({
      parent: { database_id: tasksDbId },
      properties: {
        Name: { title: [{ text: { content: activity.title || activity.subject } }] },
        Status: { select: { name: "Pendiente" } },
        Type: { select: { name: activity.type || "General" } },
        Priority: { select: { name: activity.priority || "Media" } },
        Description: { rich_text: [{ text: { content: activity.description } }] },
        "Related Email": { relation: [{ id: historyPage.id }] },
      },
    })) as PageObjectResponse;

    return {
      status: "ok",
      targetId: taskPage.id,
      targetUrl: taskPage.url,
      payload: { historyPageId: historyPage.id },
    };
  }
}
