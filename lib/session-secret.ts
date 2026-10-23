import { randomBytes } from "crypto";

let cachedSecret: string | null = null;

export function getSessionSecret(): string {
  if (cachedSecret) return cachedSecret;

  const fromEnv = process.env.AUTH_SECRET;
  if (fromEnv && fromEnv.length >= 32) {
    cachedSecret = fromEnv;
    return cachedSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET debe estar definido en producción y tener al menos 32 caracteres."
    );
  }

  console.warn(
    "[auth] AUTH_SECRET no está definido. Generando secreto efímero para desarrollo. " +
      "Las sesiones no sobrevivirán al reinicio del servidor."
  );
  cachedSecret = randomBytes(32).toString("hex");
  return cachedSecret;
}

export function clearCachedSecretForTests(): void {
  cachedSecret = null;
}
