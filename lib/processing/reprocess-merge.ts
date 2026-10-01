import type { Communication } from "@prisma/client";
import type { ClassifiedResponse } from "@/lib/ai";
import type { ClassifiedResult } from "./types";

export type CorrectionOverrides = {
  title?: string;
  area?: string;
  priority?: "Normal" | "Alta" | "Urgente";
  description?: string;
  summary?: string;
};

export function mergeWithCorrections(
  classification: ClassifiedResponse,
  communication: Communication,
  overrides: CorrectionOverrides
): ClassifiedResult {
  const wasCorrected = communication.correctedAt != null;
  return {
    ...classification,
    title: overrides.title ?? (wasCorrected ? communication.title : classification.title) ?? communication.title,
    area: overrides.area ?? (wasCorrected ? communication.type : classification.area),
    priority: overrides.priority ?? (wasCorrected ? (communication.priority as "Normal" | "Alta" | "Urgente") : classification.priority),
    description: overrides.description ?? (wasCorrected ? communication.description : classification.description) ?? "",
    summary: overrides.summary ?? (wasCorrected ? communication.summary : classification.summary) ?? "",
    needsReview: classification.needsReview ?? false,
  };
}
