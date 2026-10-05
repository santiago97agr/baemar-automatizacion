/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { History, Paperclip } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { taskStatusLabel, uploadStatusLabel } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/format";
import { PriorityBadge } from "@/components/status-badges";

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    const res = await fetch(`/api/tasks/${id}`, { credentials: "include" });
    if (res.ok) {
      const d = await res.json();
      setTask(d.task);
    }
    setLoading(false);
  }

  async function retryAttachment(attachmentId: string) {
    await fetch(`/api/attachments/${attachmentId}/retry`, {
      method: "POST",
      credentials: "include",
    });
    load();
  }

  if (loading || !task) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={task.title} description={task.client?.name ? `Cliente: ${task.client.name}` : "Tarea"} />

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-meta text-ink-3">Estado</p>
            <p className="mt-1 text-body font-medium">{taskStatusLabel(task.status)}</p>
          </div>
          <div>
            <p className="text-meta text-ink-3">Prioridad</p>
            <div className="mt-1">
              <PriorityBadge priority={task.priority} />
            </div>
          </div>
          <div>
            <p className="text-meta text-ink-3">Área</p>
            <p className="text-body font-medium">{task.area || "—"}</p>
          </div>
          <div>
            <p className="text-meta text-ink-3">Origen</p>
            <p className="text-body font-medium">{task.origin}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-h3">Detalle y seguimiento</h2>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-meta text-ink-3">Responsable</p>
            <p className="mt-1 text-body font-medium">{task.assignee || "Sin asignar"}</p>
          </div>
          <div>
            <p className="text-meta text-ink-3">Vencimiento</p>
            <p className="mt-1 text-body font-medium">{task.dueDate ? formatDate(task.dueDate) : "—"}</p>
          </div>
          <div>
            <p className="text-meta text-ink-3">Valoración económica</p>
            <p className="mt-1 text-body font-medium">{task.economicValue ?? "—"}</p>
          </div>
          <div>
            <p className="text-meta text-ink-3">Resumen</p>
            <p className="mt-1 text-body whitespace-pre-wrap">{task.summary || "—"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-h3 flex items-center gap-2">
            <History className="h-4 w-4" /> Comunicaciones relacionadas
          </h2>
        </CardHeader>
        <CardContent className="p-0">
          {task.communications.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={<History className="h-8 w-8" />} title="Sin comunicaciones" description="No hay comunicaciones vinculadas." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableHead>Asunto</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Fecha</TableHead>
              </TableHeader>
              <TableBody>
                {task.communications.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/items/${c.id}`} className="font-medium hover:text-accent hover:underline">
                        {c.subject}
                      </Link>
                    </TableCell>
                    <TableCell>{c.channel}</TableCell>
                    <TableCell className="tabular text-ink-3">{formatDateTime(c.receivedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-h3 flex items-center gap-2">
            <Paperclip className="h-4 w-4" /> Documentos
          </h2>
        </CardHeader>
        <CardContent className="p-0">
          {(() => {
            const docs = (task.communications || []).flatMap((c: any) =>
              (c.files || []).map((f: any) => ({ ...f, _commId: c.id }))
            );
            if (docs.length === 0) {
              return (
                <div className="p-6">
                  <EmptyState icon={<Paperclip className="h-8 w-8" />} title="Sin documentos" description="No hay adjuntos subidos para esta tarea." />
                </div>
              );
            }
            return (
              <Table>
                <TableHeader>
                  <TableHead>Fichero</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Intentos</TableHead>
                  <TableHead />
                </TableHeader>
                <TableBody>
                  {docs.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.filename}</TableCell>
                      <TableCell>{uploadStatusLabel(a.uploadStatus)}</TableCell>
                      <TableCell>{a.attempts}</TableCell>
                      <TableCell>
                        {a.uploadStatus !== "uploaded" && (
                          <Button variant="secondary" size="sm" onClick={() => retryAttachment(a.id)}>
                            Reintentar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}