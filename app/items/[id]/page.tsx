"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, FileX, Paperclip } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ReviewStatusBadge,
  TargetStatusBadge,
} from "@/components/status-badges";
import { formatBytes, formatDateTime } from "@/lib/format";
import { feedbackTypeLabel, targetLabel } from "@/lib/labels";

type Target = {
  id: string;
  targetType: string;
  targetId: string | null;
  targetUrl: string | null;
  status: string;
  errorMessage: string | null;
};

type FeedbackItem = {
  id: string;
  type: string;
  text: string;
  createdAt: string;
};

type Activity = {
  id: string;
  messageId: string;
  subject: string;
  from: string;
  body: string;
  attachments: string | null;
  title: string;
  type: string;
  priority: string;
  description: string;
  summary: string;
  aiRaw: string;
  needsReview: boolean;
  reviewReason: string | null;
  reviewStatus: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  targets: Target[];
  feedback: FeedbackItem[];
};

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Skeleton className="h-8 w-2/3" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Skeleton className="h-80" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-96" />
          <Skeleton className="h-40" />
        </div>
      </div>
    </div>
  );
}

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState(false);

  const [form, setForm] = useState({
    title: "",
    type: "",
    priority: "Media",
    description: "",
    summary: "",
    feedbackText: "",
  });

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/items/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error cargando actividad");
      const data = await res.json();
      setActivity(data.activity);
      setForm((f) => ({
        ...f,
        title: data.activity.title,
        type: data.activity.type,
        priority: data.activity.priority,
        description: data.activity.description,
        summary: data.activity.summary,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitCorrection(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    setSaveMsg(null);

    const res = await fetch(`/api/items/${id}/correct`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);
    if (res.ok) {
      setSaveMsg("Corrección guardada.");
      setForm((f) => ({ ...f, feedbackText: "" }));
      await load();
    } else {
      setSaveMsg("Error guardando corrección.");
    }
  }

  async function markReviewed() {
    if (!id) return;
    const res = await fetch(`/api/items/${id}/review`, {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) await load();
  }

  async function reprocess() {
    if (!id) return;
    setReprocessing(true);
    const res = await fetch(`/api/items/${id}/reprocess`, {
      method: "POST",
      credentials: "include",
    });
    setReprocessing(false);
    if (res.ok) {
      setSaveMsg("Reprocesado.");
      await load();
    } else {
      setSaveMsg("Error al reprocesar.");
    }
  }

  if (loading) return <DetailSkeleton />;

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title="Detalle" />
        <Alert variant="danger">{error}</Alert>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title="Detalle" />
        <EmptyState
          icon={<FileX className="h-8 w-8" />}
          title="No encontrado"
          description="La actividad que buscas no existe."
        />
      </div>
    );
  }

  const attachments: { filename: string; contentType?: string; size?: number }[] =
    activity.attachments ? JSON.parse(activity.attachments) : [];

  const saveVariant =
    saveMsg && saveMsg.toLowerCase().startsWith("error")
      ? "danger"
      : "success";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={activity.title}
        description={`${activity.from} · ${activity.subject}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={reprocess}
              loading={reprocessing}
              disabled={reprocessing}
            >
              Reprocesar
            </Button>
            {activity.reviewStatus === "pending" && (
              <Button variant="secondary" onClick={markReviewed}>
                Marcar revisado
              </Button>
            )}
          </div>
        }
      />

      {saveMsg && (
        <Alert variant={saveVariant} className="mb-6">
          {saveMsg}
        </Alert>
      )}

      {activity.status === "error" && (
        <Alert variant="danger" className="mb-6">
          <p className="font-medium">Error de procesamiento</p>
          {activity.errorMessage && (
            <p className="mt-0.5">{activity.errorMessage}</p>
          )}
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        {/* Email */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-h3">Email</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-meta font-medium text-ink-3">Remitente</p>
                  <p className="mt-0.5 text-body text-ink">{activity.from}</p>
                </div>
                <div>
                  <p className="text-meta font-medium text-ink-3">Fecha</p>
                  <p className="mt-0.5 text-body tabular text-ink">
                    {formatDateTime(activity.createdAt)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-meta font-medium text-ink-3">Asunto</p>
                <p className="mt-0.5 text-body font-medium text-ink">
                  {activity.subject}
                </p>
              </div>

              <div>
                <p className="text-meta font-medium text-ink-3">Message ID</p>
                <p className="mt-0.5 text-body tabular text-ink-3 break-all">
                  {activity.messageId}
                </p>
              </div>

              {activity.body && (
                <div>
                  <p className="text-meta font-medium text-ink-3">Cuerpo</p>
                  <div className="mt-1.5 rounded border border-line bg-highlight p-3 text-body text-ink whitespace-pre-wrap">
                    {activity.body}
                  </div>
                </div>
              )}

              {attachments.length > 0 && (
                <div>
                  <p className="text-meta font-medium text-ink-3">Adjuntos</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {attachments.map((a, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 text-body text-ink-2"
                      >
                        <Paperclip className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{a.filename}</span>
                        {a.size ? (
                          <span className="text-meta text-ink-3">
                            ({formatBytes(a.size)})
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* IA interpretation + corrections */}
        <div className="space-y-6">
          {activity.needsReview && activity.reviewReason && (
            <Alert variant="warning">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-medium">Necesita revisión</p>
                  <p className="mt-0.5">{activity.reviewReason}</p>
                </div>
              </div>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <h2 className="text-h3">Interpretación de la IA</h2>
                <ReviewStatusBadge status={activity.reviewStatus} />
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitCorrection} className="space-y-4">
                <Field label="Título" htmlFor="title">
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, title: e.target.value }))
                    }
                    required
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Categoría" htmlFor="type">
                    <Input
                      id="type"
                      value={form.type}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, type: e.target.value }))
                      }
                      required
                    />
                  </Field>
                  <Field label="Prioridad" htmlFor="priority">
                    <Select
                      id="priority"
                      value={form.priority}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          priority: e.target.value as "Alta" | "Media" | "Baja",
                        }))
                      }
                    >
                      <option value="Alta">Alta</option>
                      <option value="Media">Media</option>
                      <option value="Baja">Baja</option>
                    </Select>
                  </Field>
                </div>

                <Field label="Descripción / acción" htmlFor="description">
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    rows={3}
                  />
                </Field>

                <Field label="Resumen del correo" htmlFor="summary">
                  <Textarea
                    id="summary"
                    value={form.summary}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, summary: e.target.value }))
                    }
                    rows={2}
                  />
                </Field>

                <Field
                  label="Feedback opcional"
                  htmlFor="feedbackText"
                  hint="Explica qué estaba mal para que la IA lo tenga en cuenta"
                >
                  <Textarea
                    id="feedbackText"
                    value={form.feedbackText}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, feedbackText: e.target.value }))
                    }
                    rows={2}
                    placeholder="Por ejemplo: la fecha límite es el 15, no el 20"
                  />
                </Field>

                <div className="pt-2">
                  <Button type="submit" loading={saving} disabled={saving}>
                    Guardar corrección
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-h3">Destinos</h2>
            </CardHeader>
            <CardContent>
              {activity.targets.length === 0 ? (
                <p className="text-body text-ink-2">
                  Aún no se ha enviado a ningún destino.
                </p>
              ) : (
                <ul className="space-y-3">
                  {activity.targets.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-start justify-between gap-4 rounded border border-line p-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink">
                            {targetLabel(t.targetType)}
                          </span>
                          <TargetStatusBadge status={t.status} />
                        </div>
                        {t.errorMessage && (
                          <p className="mt-1 text-meta text-danger-text">
                            {t.errorMessage}
                          </p>
                        )}
                      </div>
                      {t.targetUrl && (
                        <a
                          href={t.targetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 text-meta font-medium text-accent hover:underline"
                        >
                          Ver en {targetLabel(t.targetType)}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {activity.feedback.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-h3">Feedback previo</h2>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {activity.feedback.map((f) => (
                    <li key={f.id} className="rounded border border-line p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-ink">
                          {feedbackTypeLabel(f.type)}
                        </span>
                        <span className="text-meta tabular text-ink-3">
                          {formatDateTime(f.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-body text-ink-2">{f.text}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <details className="rounded border border-line bg-surface">
            <summary className="cursor-pointer select-none p-4 text-meta font-medium text-ink-2 hover:text-ink">
              Ver salida bruta de la IA
            </summary>
            <div className="border-t border-line bg-highlight p-4">
              <pre className="overflow-x-auto text-meta text-ink-2 whitespace-pre-wrap">
                {activity.aiRaw}
              </pre>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
