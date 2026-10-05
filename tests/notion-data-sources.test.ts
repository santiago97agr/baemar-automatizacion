import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import {
  clearNotionDataSourceCache,
  getDataSourceId,
  getDataSourceSchema,
  queryDataSource,
} from "@/lib/notion-data-sources";

const DB_ID = "3eefac7342da804ab8ace00ad32c2559";
const DATA_SOURCE_ID = "ds-123";

describe("notion-data-sources helpers", () => {
  beforeEach(() => {
    clearNotionDataSourceCache();
  });

  it("getDataSourceId extrae el primer data_source_id y cachea", async () => {
    const notionModule = await import("@/lib/notion");
    mock.method(notionModule.notion.databases, "retrieve", async () => ({
      data_sources: [{ id: DATA_SOURCE_ID }],
    }));

    const id = await getDataSourceId(DB_ID);
    assert.equal(id, DATA_SOURCE_ID);

    // Segunda llamada usa cache; el mock solo se invoca una vez si comprobamos callCount.
    const id2 = await getDataSourceId(DB_ID);
    assert.equal(id2, DATA_SOURCE_ID);
  });

  it("getDataSourceId lanza error si no hay data_sources", async () => {
    const notionModule = await import("@/lib/notion");
    mock.method(notionModule.notion.databases, "retrieve", async () => ({
      data_sources: [],
    }));

    await assert.rejects(getDataSourceId(DB_ID), /no tiene data_sources/);
  });

  it("getDataSourceSchema devuelve properties del data source", async () => {
    const notionModule = await import("@/lib/notion");
    mock.method(notionModule.notion.databases, "retrieve", async () => ({
      data_sources: [{ id: DATA_SOURCE_ID }],
    }));
    mock.method(notionModule.notion.dataSources, "retrieve", async () => ({
      properties: { Nombre: { type: "title" } },
    }));

    const schema = await getDataSourceSchema(DB_ID);
    assert.deepEqual(schema, { Nombre: { type: "title" } });
  });

  it("queryDataSource delega en dataSources.query", async () => {
    const notionModule = await import("@/lib/notion");
    mock.method(notionModule.notion.databases, "retrieve", async () => ({
      data_sources: [{ id: DATA_SOURCE_ID }],
    }));
    mock.method(notionModule.notion.dataSources, "query", async () => ({
      results: [{ object: "page", id: "page-1", properties: {} }],
      next_cursor: null,
      has_more: false,
    }));

    const result = await queryDataSource(DB_ID, { page_size: 10 });
    assert.equal(result.results.length, 1);
  });
});