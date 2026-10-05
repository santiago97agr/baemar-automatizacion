/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Paperclip, RefreshCw, User, Briefcase, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ReviewStatusBadge } from "@/components/status-badges";
import { formatDateTime } from "@/lib/format";
import { relevanceLabel, uploadStatusLabel } from "@/lib/labels";

export default function CommunicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activity, setActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [assignForm, setAssignForm] = useState({ clientId: "" });
  const [taskForm, setTaskForm] = useState({ title: "", area: "", priority: "Normal" });
  const [correctForm, setCorrectForm] = useState({ title: "", type: "", priority: "Normal", description: "", summary: "", feedbackText: "" });

  useEffect(() => {
    if (!id) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const q = clientQuery.trim();
    if (q.length < 2) {
      setClientResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingClients(true);
      try {
        const res = await fetch(`/api/clients?q=${encodeURIComponent(q)}`, { credentials: "include" });
        const data = await res.json();
        setClientResults(data.clients || []);
      } catch {
        setClientResults([]);
      } finally {
        setSearchingClients(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [clientQuery]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/items/${id}`, { credentials: "include" });
    if (res.ok) {
      const d = await res.json();
      setActivity(d.activity);
      setCorrectForm({
        title: d.activity.title,
        type: d.activity.type,
        priority: d.activity.priority,
        description: d.activity.description,
        summary: d.activity.summary,
        feedbackText: "",
      });
    }
    setLoading(false);
  }

  async function doAction(name: string, url: string, body?: unknown) {
    setActionLoading(name);
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    setActionLoading(null);
    if (res.ok) load();
  }

  async function submitCorrection(e: React.FormEvent) {
    e.preventDefault();
    await doAction("correct", `/api/items/${id}/correct`, correctForm);
  }

  if (loading || !activity) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={activity.title || activity.subject} description={activity.subject} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-meta text-ink-3">Canal</p><p className="text-h3">{activity.channel}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-meta text-ink-3">Dirección</p><p className="text-h3">{activity.direction}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-meta text-ink-3">Relevancia</p><p className="text-h3">{relevanceLabel(activity.relevance)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-meta text-ink-3">Revisión</p><ReviewStatusBadge status={activity.reviewStatus} /></CardContent></Card>
      </div>

      <Card>
        <CardHeader><h2 className="text-h3">Cliente y tarea</h2></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <User className="h-4 w-4 text-ink-3" />
            {activity.client ? (
              <span className="font-medium">{activity.client.name}</span>
            ) : (
              <span className="text-ink-3">Sin cliente asignado</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Briefcase className="h-4 w-4 text-ink-3" />
            {activity.task ? (
              <Link href={`/tareas/${activity.task.id}`} className="font-medium hover:text-accent hover:underline">
                {activity.task.title}
              </Link>
            ) : (
              <span className="text-ink-3">Sin tarea vinculada</span>
            )}
          </div>

          {!activity.client && (
            <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-4">
              <Field label="Asignar cliente desde Notion" className="sm:col-span-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-ink-3" />
                  <Input
                    value={clientQuery}
                    onChange={(e) => {
                      setClientQuery(e.target.value);
                      if (e.target.value.trim().length < 2) {
                        setAssignForm({ clientId: "" });
                      }
                    }}
                    placeholder="Escribe para buscar..."
                    className="pl-9"
                  />
                  {searchingClients && (
                    <span className="absolute right-2.5 top-2.5 text-xs text-ink-3">Buscando...</span>
                  )}
                </div>
                {clientResults.length > 0 && (
                  <ul className="mt-1 max-h-48 overflow-auto rounded border border-line bg-surface shadow-sm">
                    {clientResults.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setAssignForm({ clientId: c.id });
                            setClientQuery(c.name);
                            setClientResults([]);
                          }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-highlight ${assignForm.clientId === c.id ? "bg-highlight font-medium" : ""}`}
                        >
                          {c.name}
                          {c.email ? <span className="ml-2 text-ink-3">({c.email})</span> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {clientQuery.trim().length >= 2 && !searchingClients && clientResults.length === 0 && (
                  <p className="mt-1 text-xs text-ink-3">No se encontraron clientes en Notion.</p>
                )}
              </Field>
              <p className="self-end text-meta text-ink-3 sm:col-span-1">
                Al asignar el cliente se creará la tarea automáticamente.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <Button onClick={() => doAction("assign", `/api/items/${id}/assign`, assignForm)} loading={actionLoading === "assign"} disabled={!assignForm.clientId}>
                  Asignar
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (!window.confirm("¿Procesar la comunicación sin asignar cliente? Se subirá a Dropbox sin cliente real.")) return;
                    doAction("process-orphan", `/api/items/${id}/process-orphan`, { reason: "" });
                  }}
                  loading={actionLoading === "process-orphan"}
                  title="Procesa la comunicación asignándola al cliente interno. Crea la tarea y sube los adjuntos sin vincular a un cliente real."
                >
                  Procesar sin asignar
                </Button>
              </div>
            </div>
          )}

          {activity.client && !activity.task && activity.relevance === "action" && (
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <p className="text-meta text-ink-3">
                Esta comunicación requiere una tarea. Se creará automáticamente al confirmar la revisión.
              </p>
              <Button onClick={() => doAction("materialize", `/api/items/${id}/assign`, { clientId: activity.clientId })} loading={actionLoading === "materialize"}>
                <Plus className="mr-1 h-4 w-4" /> Materializar tarea
              </Button>
            </div>
          )}

          {activity.client && !activity.task && activity.relevance !== "action" && (
            <details className="border-t border-line pt-4">
              <summary className="cursor-pointer text-meta text-ink-3">Crear tarea manualmente (opcional)</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  doAction("create-task", `/api/items/${id}/create-task`, taskForm);
                }}
                className="mt-3 grid gap-3 sm:grid-cols-5"
              >
                <Field label="Título" className="sm:col-span-2">
                  <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} required />
                </Field>
                <Field label="Área">
                  <Input value={taskForm.area} onChange={(e) => setTaskForm({ ...taskForm, area: e.target.value })} />
                </Field>
                <Field label="Prioridad">
                  <Select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                    <option>Normal</option>
                    <option>Alta</option>
                    <option>Urgente</option>
                  </Select>
                </Field>
                <div className="flex items-end">
                  <Button type="submit" loading={actionLoading === "create-task"}>
                    <Plus className="mr-1 h-4 w-4" /> Crear
                  </Button>
                </div>
              </form>
            </details>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="text-h3">Correo original</h2></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-meta"><strong>De:</strong> {activity.from}</p>
          {activity.to && <p className="text-meta"><strong>Para:</strong> {activity.to}</p>}
          <p className="text-meta"><strong>Fecha:</strong> {formatDateTime(activity.receivedAt)}</p>
          {activity.externalRef && <p className="text-meta"><strong>Referencia:</strong> {activity.externalRef}</p>}
          <div className="rounded border border-line bg-surface p-3 text-body whitespace-pre-wrap">{activity.body}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="text-h3 flex items-center gap-2"><Paperclip className="h-4 w-4" /> Adjuntos</h2></CardHeader>
        <CardContent className="p-0">
          {activity.files.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={<Paperclip className="h-8 w-8" />} title="Sin adjuntos" description="Esta comunicación no tiene archivos adjuntos." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableHead>Fichero</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Intentos</TableHead>
                <TableHead />
              </TableHeader>
              <TableBody>
                {activity.files.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.filename}</TableCell>
                    <TableCell>{uploadStatusLabel(a.uploadStatus)}</TableCell>
                    <TableCell>{a.attempts}</TableCell>
                    <TableCell>
                      {a.uploadStatus !== "uploaded" && (
                        <Button variant="secondary" size="sm" onClick={() => doAction(`retry-${a.id}`, `/api/attachments/${a.id}/retry`)} loading={actionLoading === `retry-${a.id}`}>
                          Reintentar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="text-h3">Corrección / aprobación</h2></CardHeader>
        <CardContent>
          <form onSubmit={submitCorrection} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Título">
                <Input value={correctForm.title} onChange={(e) => setCorrectForm({ ...correctForm, title: e.target.value })} required />
              </Field>
              <Field label="Área / categoría">
                <Input value={correctForm.type} onChange={(e) => setCorrectForm({ ...correctForm, type: e.target.value })} required />
              </Field>
              <Field label="Prioridad">
                <Select value={correctForm.priority} onChange={(e) => setCorrectForm({ ...correctForm, priority: e.target.value as any })}>
                  <option>Normal</option>
                  <option>Alta</option>
                  <option>Urgente</option>
                </Select>
              </Field>
            </div>
            <Field label="Descripción / acción">
              <Textarea value={correctForm.description} onChange={(e) => setCorrectForm({ ...correctForm, description: e.target.value })} rows={3} />
            </Field>
            <Field label="Resumen del correo">
              <Textarea value={correctForm.summary} onChange={(e) => setCorrectForm({ ...correctForm, summary: e.target.value })} rows={3} />
            </Field>
            <Field label="Comentario o corrección para la IA">
              <Textarea value={correctForm.feedbackText} onChange={(e) => setCorrectForm({ ...correctForm, feedbackText: e.target.value })} rows={2} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={actionLoading === "correct"}>Guardar corrección</Button>
              <Button type="button" variant="secondary" onClick={() => doAction("review", `/api/items/${id}/review`)} loading={actionLoading === "review"}>
                <CheckCircle className="mr-1 h-4 w-4" /> Marcar revisado
              </Button>
              <Button type="button" variant="secondary" onClick={() => doAction("reprocess", `/api/items/${id}/reprocess`)} loading={actionLoading === "reprocess"}>
                <RefreshCw className="mr-1 h-4 w-4" /> Reprocesar con IA
              </Button>
              <Button type="button" variant="secondary" onClick={() => doAction("retry-sync", `/api/items/${id}/retry-sync`)} loading={actionLoading === "retry-sync"}>
                <RefreshCw className="mr-1 h-4 w-4" /> Reintentar sync Notion
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {activity.aiRaw && (
        <Card>
          <CardHeader><h2 className="text-h3">Respuesta de la IA (bruto)</h2></CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded bg-highlight p-3 text-meta">{activity.aiRaw}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
