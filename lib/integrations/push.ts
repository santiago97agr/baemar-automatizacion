import { prisma } from "@/lib/prisma";
import { getEnabledIntegrations } from "./registry";

export type PushableActivity = {
  id: string;
  messageId: string;
  subject: string;
  from: string;
  body: string;
  title: string;
  type: string;
  priority: string;
  description: string;
  summary: string;
  aiRaw: string;
  attachments?: string | null;
};

export async function pushActivityToIntegrations(activity: PushableActivity) {
  const integrations = getEnabledIntegrations();
  const targets = await Promise.all(
    integrations.map(async (integration) => {
      try {
        const result = await integration.push(activity);
        return prisma.activityTarget.create({
          data: {
            activityId: activity.id,
            targetType: integration.type,
            targetId: result.targetId,
            targetUrl: result.targetUrl,
            status: result.status,
            errorMessage: result.errorMessage,
            payload: result.payload ? JSON.stringify(result.payload) : null,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Integration error";
        await prisma.errorLog.create({
          data: {
            source: integration.type as "notion" | "erp",
            message,
            activityId: activity.id,
          },
        });
        return prisma.activityTarget.create({
          data: {
            activityId: activity.id,
            targetType: integration.type,
            status: "error",
            errorMessage: message,
          },
        });
      }
    })
  );
  return targets;
}
