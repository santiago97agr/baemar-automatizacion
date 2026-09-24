"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Boxes, Tags, Bot, Database, CheckCircle, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";

type Category = {
  id: string;
  name: string;
  active: boolean;
};

export default function ConfiguracionPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [integrations, setIntegrations] = useState<{ type: string; enabled: boolean }[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [checkingAI, setCheckingAI] = useState(false);
  const [checkingNotion, setCheckingNotion] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [notionStatus, setNotionStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/config", { credentials: "include" });
      if (!res.ok) throw new Error("Error cargando configuración");
      const data = await res.json();
      setCategories(data.categories || []);
      setIntegrations(data.integrations || []);
      setError(false);
    } catch {
      setCategories([]);
      setIntegrations([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategory.trim()) return;
    await fetch("/api/config/categories", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategory.trim() }),
    });
    setNewCategory("");
    await load();
  }

  async function toggleCategory(id: string, active: boolean) {
    setBusyId(id);
    await fetch(`/api/config/categories/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    await load();
    setBusyId(null);
  }

  async function deleteCategory(id: string) {
    setBusyId(id);
    await fetch(`/api/config/categories/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await load();
    setBusyId(null);
  }

  async function checkAI() {
    setCheckingAI(true);
    setAiStatus(null);
    try {
      const res = await fetch("/api/config/check/ai", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setAiStatus({ ok: true, message: `Conexión correcta con ${data.provider} (${data.model}).` });
      } else {
        setAiStatus({ ok: false, message: data.error || "No se pudo conectar con la IA." });
      }
    } catch {
      setAiStatus({ ok: false, message: "Error inesperado al comprobar la conexión." });
    } finally {
      setCheckingAI(false);
    }
  }

  async function checkNotion() {
    setCheckingNotion(true);
    setNotionStatus(null);
    try {
      const res = await fetch("/api/config/check/notion", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setNotionStatus({ ok: true, message: `Conexión correcta con Notion (${data.bot}).` });
      } else {
        setNotionStatus({ ok: false, message: data.error || "No se pudo conectar con Notion." });
      }
    } catch {
      setNotionStatus({ ok: false, message: "Error inesperado al comprobar la conexión." });
    } finally {
      setCheckingNotion(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Configuración"
          description="Integraciones activas y categorías que la IA puede asignar a las actividades."
        />
        <div className="space-y-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Configuración"
          description="Integraciones activas y categorías que la IA puede asignar a las actividades."
        />
        <EmptyState
          icon={<AlertCircle className="h-8 w-8" />}
          title="No se pudo cargar la configuración"
          description="Ha ocurrido un error al consultar la configuración. Inténtalo de nuevo."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Configuración"
        description="Integraciones activas y categorías que la IA puede asignar a las actividades."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <h2 className="text-h3">Integraciones activas</h2>
          </CardHeader>
          <CardContent className="p-0">
            {integrations.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<Boxes className="h-8 w-8" />}
                  title="Sin integraciones"
                  description="No hay integraciones activas en este entorno."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {integrations.map((i) => (
                  <li
                    key={i.type}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <span className="font-medium capitalize text-ink">
                      {i.type}
                    </span>
                    <Badge variant="success" dot>
                      Activa
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <p className="text-meta text-ink-3">
          Para activar o desactivar integraciones edita la variable{" "}
          <code className="rounded bg-highlight px-1 py-0.5 text-ink-2">
            INTEGRATIONS
          </code>{" "}
          en{" "}
          <code className="rounded bg-highlight px-1 py-0.5 text-ink-2">
            app/.env
          </code>
          .
        </p>

        <Card>
          <CardHeader>
            <h2 className="text-h3">Comprobación de conectividad</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Bot className="h-5 w-5 text-ink-2" />
                <div>
                  <p className="font-medium text-ink">Inteligencia artificial</p>
                  <p className="text-meta text-ink-3">Verifica que la app puede llamar al proveedor de IA.</p>
                </div>
              </div>
              <Button
                onClick={checkAI}
                loading={checkingAI}
                disabled={checkingAI}
                className="sm:w-auto w-full"
              >
                Comprobar conexión
              </Button>
            </div>
            {aiStatus && (
              <Alert variant={aiStatus.ok ? "success" : "danger"}>
                <div className="flex items-start gap-2">
                  {aiStatus.ok ? (
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span>{aiStatus.message}</span>
                </div>
              </Alert>
            )}
            <div className="border-t border-line" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-ink-2" />
                <div>
                  <p className="font-medium text-ink">Notion</p>
                  <p className="text-meta text-ink-3">Verifica que el token de Notion es válido.</p>
                </div>
              </div>
              <Button
                onClick={checkNotion}
                loading={checkingNotion}
                disabled={checkingNotion}
                className="sm:w-auto w-full"
              >
                Comprobar conexión
              </Button>
            </div>
            {notionStatus && (
              <Alert variant={notionStatus.ok ? "success" : "danger"}>
                <div className="flex items-start gap-2">
                  {notionStatus.ok ? (
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span>{notionStatus.message}</span>
                </div>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-h3">Categorías</h2>
          </CardHeader>
          <CardContent className="border-b border-line">
            <form onSubmit={addCategory} className="flex gap-2">
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Nueva categoría"
                aria-label="Nueva categoría"
                className="max-w-xs"
              />
              <Button type="submit" disabled={!newCategory.trim()}>
                Añadir
              </Button>
            </form>
          </CardContent>
          <CardContent className="p-0">
            {categories.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<Tags className="h-8 w-8" />}
                  title="Sin categorías"
                  description="Añade la primera categoría para clasificar actividades."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {categories.map((cat) => (
                  <li
                    key={cat.id}
                    className="flex items-center justify-between gap-4 px-5 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={cat.active}
                        onChange={() => toggleCategory(cat.id, cat.active)}
                        label={
                          cat.active
                            ? `Desactivar categoría ${cat.name}`
                            : `Activar categoría ${cat.name}`
                        }
                        disabled={busyId === cat.id}
                      />
                      <span
                        className={
                          cat.active
                            ? "capitalize text-ink"
                            : "capitalize text-ink-3"
                        }
                      >
                        {cat.name}
                      </span>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteCategory(cat.id)}
                      disabled={busyId === cat.id}
                    >
                      Eliminar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
