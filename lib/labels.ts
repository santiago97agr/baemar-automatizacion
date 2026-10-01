/**
 * Etiquetas de presentación para valores almacenados como enums internos.
 * Sólo afectan a lo que se muestra; no cambian ningún dato ni lógica.
 */

const targetLabels: Record<string, string> = {
  notion: "Notion",
  erp: "Globalsoft (ERP)",
  dropbox: "Dropbox",
};

export function targetLabel(targetType: string): string {
  return targetLabels[targetType] || targetType;
}

const feedbackTypeLabels: Record<string, string> = {
  correction: "Corrección",
  comment: "Comentario",
};

export function feedbackTypeLabel(type: string): string {
  return feedbackTypeLabels[type] || type;
}

const errorSourceLabels: Record<string, string> = {
  n8n: "n8n",
  ia: "IA",
  notion: "Notion",
  processing: "Procesamiento",
  erp: "Globalsoft (ERP)",
  dropbox: "Dropbox",
  sync: "Sincronización",
};

export function errorSourceLabel(source: string): string {
  return errorSourceLabels[source] || source;
}

const taskStatusLabels: Record<string, string> = {
  Pendiente: "Pendiente",
  "En curso": "En curso",
  "Esperando cliente": "Esperando cliente",
  "Esperando tercero": "Esperando tercero",
  Terminada: "Terminada",
};

export function taskStatusLabel(status: string): string {
  return taskStatusLabels[status] || status;
}

const channelLabels: Record<string, string> = {
  Email: "Email",
  WhatsApp: "WhatsApp",
  Teléfono: "Teléfono",
  Presencial: "Presencial",
  Interno: "Interno",
};

export function channelLabel(channel: string): string {
  return channelLabels[channel] || channel;
}

const directionLabels: Record<string, string> = {
  Entrante: "Entrante",
  Saliente: "Saliente",
};

export function directionLabel(direction: string): string {
  return directionLabels[direction] || direction;
}

const relevanceLabels: Record<string, string> = {
  irrelevant: "Sin actuación",
  info: "Informativa",
  action: "Requiere actuación",
};

export function relevanceLabel(relevance: string | null | undefined): string {
  if (!relevance) return "Sin clasificar";
  return relevanceLabels[relevance] || relevance;
}

const clientStatusLabels: Record<string, string> = {
  Activo: "Activo",
  Baja: "Baja",
};

export function clientStatusLabel(status: string): string {
  return clientStatusLabels[status] || status;
}

const syncStatusLabels: Record<string, string> = {
  pending: "Pendiente",
  ok: "Sincronizado",
  error: "Error",
  skipped: "Omitido",
};

export function syncStatusLabel(status: string): string {
  return syncStatusLabels[status] || status;
}

const uploadStatusLabels: Record<string, string> = {
  pending: "Pendiente",
  uploaded: "Subido",
  skipped: "Omitido",
  error: "Error",
};

export function uploadStatusLabel(status: string): string {
  return uploadStatusLabels[status] || status;
}
