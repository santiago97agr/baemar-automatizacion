/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Briefcase, History, Mail } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { clientStatusLabel, taskStatusLabel, relevanceLabel } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { PriorityBadge } from "@/components/status-badges";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [taskForm, setTaskForm] = useState({ title: "", area: "", priority: "Normal" as const });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/clients/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setData(d.client))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskForm.title.trim() || !id) return;
    setSaving(true);
    const res = await fetch("/api/tasks", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: id, ...taskForm }),
    });
    setSaving(false);
    if (res.ok) {
      setTaskForm({ title: "", area: "", priority: "Normal" });
      const d = await fetch(`/api/clients/${id}`, { credentials: "include" }).then((r) => r.json());
      setData(d.client);
    }
  }

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={data.name} description={data.taxId ? `NIF/CIF: ${data.taxId}` : "Cliente"} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-meta text-ink-3">Estado</p>
            <p className="text-h3">{clientStatusLabel(data.status)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-meta text-ink-3">Tareas</p>
            <p className="text-h3">{data.tasks.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-meta text-ink-3">Comunicaciones</p>
            <p className="text-h3">{data.communications.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-h3 flex items-center gap-2">
            <Briefcase className="h-4 w-4" /> Tareas
          </h2>
        </CardHeader>
        <CardContent className="p-0">
          {data.tasks.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={<Briefcase className="h-8 w-8" />} title="Sin tareas" description="Aún no hay tareas para este cliente." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableHead>Tarea</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Prioridad</TableHead>
              </TableHeader>
              <TableBody>
                {data.tasks.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link href={`/tareas/${t.id}`} className="font-medium hover:text-accent hover:underline">
                        {t.title}
                      </Link>
                    </TableCell>
                    <TableCell>{t.area || "—"}</TableCell>
                    <TableCell>{taskStatusLabel(t.status)}</TableCell>
                    <TableCell>
                      <PriorityBadge priority={t.priority} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <form onSubmit={createTask} className="flex items-end gap-3 border-t border-line p-4">
            <Field label="Nueva tarea" className="flex-1">
              <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} required />
            </Field>
            <Field label="Área">
              <Input value={taskForm.area} onChange={(e) => setTaskForm({ ...taskForm, area: e.target.value })} />
            </Field>
            <Field label="Prioridad">
              <select
                value={taskForm.priority}
                onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as any })}
                className="h-9 rounded border border-line bg-surface px-2 text-body"
              >
                <option>Normal</option>
                <option>Alta</option>
                <option>Urgente</option>
              </select>
            </Field>
            <Button type="submit" loading={saving}>
              Crear
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-h3 flex items-center gap-2">
            <Mail className="h-4 w-4" /> Comunicaciones
          </h2>
        </CardHeader>
        <CardContent className="p-0">
          {data.communications.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={<History className="h-8 w-8" />} title="Sin comunicaciones" description="Aún no se han registrado comunicaciones." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableHead>Asunto</TableHead>
                <TableHead>Relevancia</TableHead>
                <TableHead>Tarea</TableHead>
                <TableHead>Fecha</TableHead>
              </TableHeader>
              <TableBody>
                {data.communications.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/items/${c.id}`} className="font-medium hover:text-accent hover:underline">
                        {c.subject}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.relevance === "action" ? "danger" : c.relevance === "info" ? "neutral" : "neutral"}>
                        {relevanceLabel(c.relevance)}
                      </Badge>
                    </TableCell>
                    <TableCell>{c.task?.title || "—"}</TableCell>
                    <TableCell className="tabular text-ink-3">{formatDateTime(c.receivedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

