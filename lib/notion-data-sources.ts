import { notion } from "@/lib/notion";

const TTL_MS = 5 * 60 * 1000;
const dataSourceIdCache = new Map<string, { id: string; expires: number }>();
const schemaCache = new Map<string, { schema: Record<string, unknown>; expires: number }>();

export type NotionQueryResult = {
  results: unknown[];
  next_cursor?: string | null;
  has_more?: boolean;
};

function isNotExpired(entry: { expires: number }): boolean {
  return Date.now() < entry.expires;
}

export async function getDataSourceId(databaseId: string): Promise<string> {
  const cached = dataSourceIdCache.get(databaseId);
  if (cached && isNotExpired(cached)) {
    return cached.id;
  }

  const db = (await notion.databases.retrieve({
    database_id: databaseId,
  })) as unknown as {
    data_sources?: Array<{ id: string }>;
  };

  const dataSources = db?.data_sources;
  if (!dataSources || dataSources.length === 0) {
    throw new Error(
      `La base de datos ${databaseId} no tiene data_sources. Notion puede estar usando el modelo antiguo.`
    );
  }

  const id = dataSources[0].id;
  dataSourceIdCache.set(databaseId, { id, expires: Date.now() + TTL_MS });
  return id;
}

export async function getDataSourceSchema(
  databaseId: string
): Promise<Record<string, unknown>> {
  const cached = schemaCache.get(databaseId);
  if (cached && isNotExpired(cached)) {
    return cached.schema;
  }

  const dataSourceId = await getDataSourceId(databaseId);
  const dataSource = (await notion.dataSources.retrieve({
    data_source_id: dataSourceId,
  })) as unknown as {
    properties?: Record<string, unknown>;
  };

  if (!dataSource.properties) {
    throw new Error(
      `El data source ${dataSourceId} no devolvió propiedades. Verifica permisos de lectura.`
    );
  }

  schemaCache.set(databaseId, {
    schema: dataSource.properties,
    expires: Date.now() + TTL_MS,
  });
  return dataSource.properties;
}

export async function queryDataSource(
  databaseId: string,
  body: Record<string, unknown>
): Promise<NotionQueryResult> {
  const dataSourceId = await getDataSourceId(databaseId);
  return (await notion.dataSources.query({
    data_source_id: dataSourceId,
    ...body,
  })) as unknown as NotionQueryResult;
}

export function clearNotionDataSourceCache(): void {
  dataSourceIdCache.clear();
  schemaCache.clear();
}