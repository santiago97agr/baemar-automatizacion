import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { checkDropboxConnection } from "@/lib/integrations/dropbox";
import { getTestPrisma, cleanDatabase } from "./helpers";

let prisma: PrismaClient;

before(async () => {
  prisma = await getTestPrisma();
});

beforeEach(async () => {
  await cleanDatabase(prisma);
  delete process.env.DROPBOX_ACCESS_TOKEN;
  delete process.env.DROPBOX_REFRESH_TOKEN;
  delete process.env.DROPBOX_APP_KEY;
  delete process.env.DROPBOX_APP_SECRET;
});

after(async () => {
  await prisma.$disconnect();
});

function mockDropbox(
  result:
    | { ok: true; account_id: string; email: string; name: { display_name: string } }
    | { ok: false; error: unknown }
) {
  return {
    usersGetCurrentAccount: async () =>
      result.ok
        ? { result: { account_id: result.account_id, email: result.email, name: result.name } }
        : Promise.reject(result.error),
  } as unknown as Parameters<typeof checkDropboxConnection>[0];
}

describe("Dropbox healthcheck", () => {
  it("devuelve error si no está configurado", async () => {
    const result = await checkDropboxConnection();
    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.error.includes("DROPBOX_ACCESS_TOKEN"));
  });

  it("funciona con access token", async () => {
    process.env.DROPBOX_ACCESS_TOKEN = "test-token";
    const dbx = mockDropbox({
      ok: true,
      account_id: "dbid:123",
      email: "dropbox@example.com",
      name: { display_name: "Cuenta Test" },
    });
    const result = await checkDropboxConnection(dbx);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.account.id, "dbid:123");
    assert.equal(result.account.email, "dropbox@example.com");
    assert.equal(result.mode, "accessToken");
  });

  it("detecta error de API", async () => {
    process.env.DROPBOX_ACCESS_TOKEN = "bad-token";
    const dbx = mockDropbox({ ok: false, error: new Error("Invalid token") });
    const result = await checkDropboxConnection(dbx);
    assert.equal(result.ok, false);
  });
});
