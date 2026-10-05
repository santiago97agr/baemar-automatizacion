import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateClientsDb } from "@/app/api/clients/route";

describe("validateClientsDb", () => {
  it("detecta NOTION_CLIENTS_DB_ID no configurado", async () => {
    const original = process.env.NOTION_CLIENTS_DB_ID;
    delete process.env.NOTION_CLIENTS_DB_ID;
    try {
      const res = await validateClientsDb();

      assert.equal(res.ok, false);
      assert.ok((res as { ok: false; error: string }).error.includes("no configurado"));
    } finally {
      process.env.NOTION_CLIENTS_DB_ID = original;
    }
  });

  it("detecta NOTION_CLIENTS_DB_ID con formato inválido", async () => {
    const original = process.env.NOTION_CLIENTS_DB_ID;
    process.env.NOTION_CLIENTS_DB_ID = "not-a-uuid";
    try {
      const res = await validateClientsDb();

      assert.equal(res.ok, false);
      assert.ok((res as { ok: false; error: string }).error.includes("inválido"));
    } finally {
      process.env.NOTION_CLIENTS_DB_ID = original;
    }
  });
});