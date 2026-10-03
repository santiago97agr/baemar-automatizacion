import type { PrismaClient } from "@prisma/client";
import { searchClientByEmail, normalizeEmail } from "@/lib/sync/notion-clients";

/**
 * Identifica el cliente asociado a una dirección de contacto consultando Notion.
 * - Email: extrae la primera dirección de correo de la cadena "from".
 * - Si Notion devuelve un único cliente, se actualiza el espejo local y se devuelve.
 * - Si hay varios candidatos (anómalo), devuelve null + ambiguous=true.
 * - Si no existe en Notion, devuelve null.
 */
export type IdentifyResult =
  | { clientId: string; ambiguous: false }
  | { clientId: null; ambiguous: true }
  | { clientId: null; ambiguous: false };

export async function identifyClientByEmail(
  prisma: PrismaClient,
  fromHeader: string
): Promise<IdentifyResult> {
  const email = extractEmail(fromHeader);
  if (!email) {
    return { clientId: null, ambiguous: false };
  }

  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { clientId: null, ambiguous: false };
  }

  try {
    const result = await searchClientByEmail(prisma, normalized);
    if (result.client) {
      return { clientId: result.client.id, ambiguous: false };
    }

    return { clientId: null, ambiguous: false };
  } catch {
    // Si Notion falla, marcamos como ambiguo para forzar revisión humana.
    return { clientId: null, ambiguous: true };
  }
}

export function extractEmail(fromHeader: string): string | null {
  const match = fromHeader.match(/<([^>]+)>/);
  if (match) return match[1];
  const simple = fromHeader.trim();
  if (/^\S+@\S+\.\S+$/.test(simple)) return simple;
  return null;
}
