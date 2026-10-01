/* eslint-disable @typescript-eslint/no-explicit-any */
import { Dropbox, DropboxAuth } from "dropbox";
import type { Attachment } from "@prisma/client";

type DropboxConfig =
  | { accessToken: string }
  | { refreshToken: string; appKey: string; appSecret: string };

function getConfig(): DropboxConfig | null {
  const accessToken = process.env.DROPBOX_ACCESS_TOKEN;
  if (accessToken) return { accessToken };

  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  if (refreshToken && appKey && appSecret) {
    return { refreshToken, appKey, appSecret };
  }
  return null;
}

export function isDropboxConfigured(): boolean {
  return getConfig() !== null;
}

async function buildClient(): Promise<Dropbox | null> {
  const cfg = getConfig();
  if (!cfg) return null;

  const fetchImpl = globalThis.fetch;

  if ("accessToken" in cfg) {
    return new Dropbox({ accessToken: cfg.accessToken, fetch: fetchImpl });
  }

  const auth = new DropboxAuth({
    clientId: cfg.appKey,
    clientSecret: cfg.appSecret,
    fetch: fetchImpl,
  });
  auth.setRefreshToken(cfg.refreshToken);
  await auth.refreshAccessToken();
  const accessToken = auth.getAccessToken();
  if (!accessToken) return null;

  return new Dropbox({ accessToken, fetch: fetchImpl });
}

export async function uploadAttachmentToDropbox(
  attachment: Attachment,
  clientSlug: string,
  dateFolder: string
): Promise<{ status: "uploaded" | "error"; dropboxPath?: string; errorMessage?: string }> {
  const dbx = await buildClient();
  if (!dbx) {
    return {
      status: "error",
      errorMessage: "Dropbox no configurado (faltan DROPBOX_ACCESS_TOKEN o DROPBOX_REFRESH_TOKEN+APP_KEY+APP_SECRET)",
    };
  }

  const root = process.env.DROPBOX_ROOT_FOLDER || "baemar";
  const folderPath = `/${root}/${clientSlug}/${dateFolder}/${attachment.communicationId.slice(0, 8)}`;
  const filePath = `${folderPath}/${attachment.filename}`;

  // Reintento idempotente: si ya tenemos este path, verificamos que exista.
  if (attachment.dropboxPath === filePath) {
    try {
      await dbx.filesGetMetadata({ path: filePath });
      return { status: "uploaded", dropboxPath: filePath };
    } catch (err: any) {
      const tag = err?.error?.error?.[".tag"] || err?.error?.[".tag"];
      if (tag !== "not_found") {
        return { status: "error", errorMessage: extractError(err) };
      }
      // no existe realmente: continuar para subir
    }
  }

  const content = attachment.contentBase64 ? Buffer.from(attachment.contentBase64, "base64") : null;
  if (!content) {
    return { status: "error", errorMessage: "Sin contenido disponible para subir" };
  }

  try {
    await ensureFolders(dbx, [rootFolder(root), `/${root}/${clientSlug}`, `/${root}/${clientSlug}/${dateFolder}`, folderPath]);
  } catch (err: any) {
    return { status: "error", errorMessage: `Error creando carpetas: ${extractError(err)}` };
  }

  try {
    await dbx.filesUpload({
      path: filePath,
      contents: content,
      mode: { ".tag": "add" },
      autorename: false,
    });
    return { status: "uploaded", dropboxPath: filePath };
  } catch (err: any) {
    const tag = err?.error?.error?.[".tag"] || err?.error?.[".tag"];
    const status = err?.status;
    if (tag === "conflict" || status === 409) {
      return { status: "uploaded", dropboxPath: filePath };
    }
    return { status: "error", errorMessage: extractError(err) };
  }
}

function rootFolder(root: string): string {
  return root.startsWith("/") ? root : `/${root}`;
}

async function ensureFolders(dbx: Dropbox, paths: string[]): Promise<void> {
  for (const path of paths) {
    try {
      await dbx.filesCreateFolderV2({ path, autorename: false });
    } catch (err: any) {
      const tag = err?.error?.error?.[".tag"] || err?.error?.[".tag"];
      if (tag !== "conflict") throw err;
    }
  }
}

function extractError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
