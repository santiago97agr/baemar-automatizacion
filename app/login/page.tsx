"use client";

import { Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, FormEvent } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const from = searchParams.get("from") ?? "/";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setRateLimitSeconds(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ user, password, from }),
      });

      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        setRateLimitSeconds(retryAfter ? parseInt(retryAfter, 10) : 900);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Error al iniciar sesión" }));
        setError(data.error ?? "Credenciales incorrectas");
        setLoading(false);
        return;
      }

      const data = await res.json();
      router.push(data.redirect ?? from);
    } catch {
      setError("Error de red. Comprueba tu conexión.");
      setLoading(false);
    }
  };

  const formatWaitTime = (seconds: number): string => {
    const minutes = Math.ceil(seconds / 60);
    return minutes <= 1 ? "1 minuto" : `${minutes} minutos`;
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-base p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-lg border border-line bg-surface p-8 shadow-sm">
        <Image
          src="/baemar-logo.png"
          alt="BAEMAR"
          width={96}
          height={96}
          className="h-24 w-auto"
          priority
        />
        <div className="text-center">
          <h1 className="text-heading font-semibold text-ink">BAEMAR</h1>
          <p className="text-body text-ink-3">Automatización de la gestoría</p>
        </div>

        {error && (
          <div className="w-full rounded border border-danger-border bg-danger-bg px-4 py-2 text-sm text-danger-text">
            {error}
          </div>
        )}

        {rateLimitSeconds != null && (
          <div className="w-full rounded border border-warning-border bg-warning-bg px-4 py-2 text-sm text-warning-text">
            Demasiados intentos fallidos. Vuelve a intentarlo dentro de {formatWaitTime(rateLimitSeconds)}.
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="user" className="text-sm font-medium text-ink">
              Usuario
            </label>
            <input
              id="user"
              name="user"
              type="text"
              autoComplete="username"
              required
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="rounded border border-line-strong bg-base px-3 py-2 text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="admin"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium text-ink">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded border border-line-strong bg-base px-3 py-2 text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-accent px-4 py-2 text-center font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen flex-col items-center justify-center bg-base p-6">
        <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-lg border border-line bg-surface p-8 shadow-sm">
          <div className="h-24 w-24 animate-pulse rounded bg-line" />
          <div className="h-6 w-32 animate-pulse rounded bg-line" />
          <div className="h-4 w-48 animate-pulse rounded bg-line" />
        </div>
      </main>
    }>
      <LoginForm />
    </Suspense>
  );
}
