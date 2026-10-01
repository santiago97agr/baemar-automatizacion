/**
 * Tipos de entrada/salida del pipeline de procesamiento de comunicaciones.
 * Diseñados para ser independientes del transporte (HTTP, webhook, n8n...).
 */

export type ProcessingInputAttachment = {
  filename: string;
  contentType?: string;
  size?: number;
  contentBase64?: string; // bytes codificados; preferente
  sourceUrl?: string; // URL alternativa si no viene base64
  sha256?: string;
};

export type ProcessingInput = {
  messageId: string;
  channel: "Email" | "WhatsApp";
  direction: "Entrante" | "Saliente";
  subject: string;
  from: string;
  to?: string;
  body: string;
  receivedAt: Date;
  externalRef?: string;
  attachments: ProcessingInputAttachment[];
};

export type ClassifiedResult = {
  relevance: "irrelevant" | "info" | "action";
  area?: string;
  priority?: "Normal" | "Alta" | "Urgente";
  title?: string;
  description?: string;
  summary?: string;
  clientName?: string;
  matchedTaskId?: string;
  isNewTask?: boolean;
  needsReview: boolean;
  reviewReason?: string;
};

export type PipelineResult = {
  communicationId: string;
  clientId?: string;
  taskId?: string;
  relevance?: string;
  needsReview: boolean;
  isNewTask: boolean;
  isNewClient: boolean;
  errors: string[];
};
