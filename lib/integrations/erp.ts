import { Integration, IntegrationResult, NormalizedActivity } from "./types";

export class ErpIntegration implements Integration {
  readonly type = "erp";

  async push(activity: NormalizedActivity): Promise<IntegrationResult> {
    // GoldenSoft es una app de escritorio sin API. Esta integración deja la
    // actividad en estado "pending" para que un middleware a medida la recoja
    // mediante GET /api/outbox?type=erp&status=pending y reporte resultado.
    return {
      status: "pending",
      payload: {
        activityId: activity.id,
        messageId: activity.messageId,
        subject: activity.subject,
        from: activity.from,
        title: activity.title,
        type: activity.type,
        priority: activity.priority,
        description: activity.description,
        summary: activity.summary,
      },
    };
  }
}
