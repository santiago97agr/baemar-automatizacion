import { prisma } from "@/lib/prisma";

export async function logAuthFailure(ip: string, path: string): Promise<void> {
  try {
    await prisma.errorLog.create({
      data: {
        source: "auth",
        message: `Intento de autenticación fallido desde ${ip} en ${path}`,
      },
    });
  } catch {
    // No bloquear la respuesta de auth si falla el logging.
  }
}
