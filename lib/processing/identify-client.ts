import type { PrismaClient } from "@prisma/client";

/**
 * Identifica el cliente asociado a una dirección de contacto.
 * - Email: extrae la primera dirección de correo de la cadena "from".
 * - Si el contacto existe, devuelve el cliente.
 * - Si varios clientes comparten la dirección (anómalo), devuelve null + ambiguous=true.
 * - Si no existe, devuelve null.
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

  const normalized = email.toLowerCase().trim();

  const contacts = await prisma.contact.findMany({
    where: { channel: "Email", address: normalized },
    include: { client: true },
  });

  if (contacts.length === 0) {
    return { clientId: null, ambiguous: false };
  }

  const clientIds = new Set(contacts.map((c) => c.clientId));
  if (clientIds.size > 1) {
    return { clientId: null, ambiguous: true };
  }

  return { clientId: contacts[0].clientId, ambiguous: false };
}

export function extractEmail(fromHeader: string): string | null {
  const match = fromHeader.match(/<([^>]+)>/);
  if (match) return match[1];
  const simple = fromHeader.trim();
  if (/^\S+@\S+\.\S+$/.test(simple)) return simple;
  return null;
}
