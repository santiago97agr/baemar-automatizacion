/**
 * Etiquetas de presentación para valores almacenados como enums internos.
 * Sólo afectan a lo que se muestra; no cambian ningún dato ni lógica.
 */

const targetLabels: Record<string, string> = {
  notion: "Notion",
  erp: "Globalsoft (ERP)",
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
};

export function errorSourceLabel(source: string): string {
  return errorSourceLabels[source] || source;
}
