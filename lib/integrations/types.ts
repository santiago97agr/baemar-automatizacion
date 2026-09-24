export type IntegrationType = "notion" | "erp";

export type IntegrationResult = {
  targetId?: string;
  targetUrl?: string;
  status: "ok" | "pending" | "error";
  errorMessage?: string;
  payload?: Record<string, unknown>;
};

export type NormalizedActivity = {
  id?: string;
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
};

export interface Integration {
  readonly type: IntegrationType;
  push(activity: NormalizedActivity): Promise<IntegrationResult>;
}
