import type { Communication } from "@prisma/client";
import type { ClassifiedResponse, priorityValues } from "@/lib/ai";
import { normalizeArea } from "@/lib/ai";
import type { ClassifiedResult } from "./types";

export type CorrectionOverrides = {
  title?: string;
  area?: string;
  priority?: "Normal" | "Alta" | "Urgente";
  description?: string;
  summary?: string;
};

function normalizeString(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizePriority(
  value: string | null | undefined
): (typeof priorityValues)[number] | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  const allowed = ["Normal", "Alta", "Urgente"] as const;
  if (allowed.includes(normalized as (typeof allowed)[number])) {
    return normalized as (typeof allowed)[number];
  }
  return undefined;
}

export function mergeWithCorrections(
  classification: ClassifiedResponse,
  communication: Communication,
  overrides: CorrectionOverrides
): ClassifiedResult {
  const wasCorrected = communication.correctedAt != null;
  const correctedArea = normalizeArea(communication.type);
  const correctedPriority = normalizePriority(communication.priority);
  const classifiedArea = normalizeArea(classification.area);
  const classifiedPriority = normalizePriority(classification.priority);
  const correctedTitle = normalizeString(communication.title);
  const classifiedTitle = normalizeString(classification.title);
  const correctedDescription = normalizeString(communication.description);
  const classifiedDescription = normalizeString(classification.description);
  const correctedSummary = normalizeString(communication.summary);
  const classifiedSummary = normalizeString(classification.summary);

  return {
    relevance: classification.relevance,
    title: overrides.title ?? (wasCorrected ? correctedTitle : classifiedTitle) ?? correctedTitle,
    area: overrides.area ?? (wasCorrected ? correctedArea : classifiedArea),
    priority: overrides.priority ?? (wasCorrected ? correctedPriority : classifiedPriority),
    description: overrides.description ?? (wasCorrected ? correctedDescription : classifiedDescription) ?? "",
    summary: overrides.summary ?? (wasCorrected ? correctedSummary : classifiedSummary) ?? "",
    clientName: classification.clientName ?? undefined,
    matchedTaskId: classification.matchedTaskId ?? undefined,
    isNewTask: classification.isNewTask ?? undefined,
    needsReview: classification.needsReview ?? false,
    reviewReason: classification.reviewReason ?? undefined,
  };
}
