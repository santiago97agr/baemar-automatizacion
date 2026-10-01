import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Communication } from "@prisma/client";
import type { ClassifiedResponse } from "@/lib/ai";
import { mergeWithCorrections } from "@/lib/processing/reprocess-merge";

function comm(overrides: Partial<Communication>): Communication {
  return {
    id: "c1",
    messageId: "m1",
    channel: "Email",
    direction: "Entrante",
    subject: "S",
    from: "a@b.com",
    body: "",
    receivedAt: new Date(),
    title: "Título manual",
    type: "Laboral",
    priority: "Alta",
    description: "Desc manual",
    summary: "Resumen manual",
    relevance: "action",
    needsReview: false,
    reviewStatus: "reviewed",
    processingStatus: "done",
    status: "ok",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Communication;
}

const classification: ClassifiedResponse = {
  relevance: "action",
  title: "Título IA",
  area: "Fiscal",
  priority: "Normal",
  description: "Desc IA",
  summary: "Resumen IA",
  needsReview: false,
};

describe("mergeWithCorrections", () => {
  it("sin corrección manual aplica la clasificación de la IA", () => {
    const merged = mergeWithCorrections(classification, comm({ correctedAt: null }), {});
    assert.equal(merged.title, "Título IA");
    assert.equal(merged.area, "Fiscal");
    assert.equal(merged.priority, "Normal");
  });

  it("con corrección manual conserva los valores humanos", () => {
    const merged = mergeWithCorrections(classification, comm({ correctedAt: new Date() }), {});
    assert.equal(merged.title, "Título manual");
    assert.equal(merged.area, "Laboral");
    assert.equal(merged.priority, "Alta");
    assert.equal(merged.description, "Desc manual");
    assert.equal(merged.summary, "Resumen manual");
  });

  it("un override explícito prevalece sobre la corrección manual", () => {
    const merged = mergeWithCorrections(classification, comm({ correctedAt: new Date() }), { title: "Override" });
    assert.equal(merged.title, "Override");
    assert.equal(merged.area, "Laboral");
  });
});
