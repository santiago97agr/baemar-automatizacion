/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { taskStatusLabel } from "@/lib/labels";
import { PriorityBadge } from "@/components/status-badges";

const statusOptions = ["Pendiente", "En curso", "Esperando cliente", "Esperando tercero", "Terminada"];

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[] | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = status ? `/api/tasks?status=${encodeURIComponent(status)}` : "/api/tasks";
    fetch(url, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks || []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [status]);

  if (loading || tasks === null) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title="Tareas" description="Seguimiento de actuaciones del despacho." />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Tareas" description="Seguimiento de actuaciones del despacho." />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-h3">Listado</h2>
            <div className="flex items-center gap-2">
              <label className="text-meta text-ink-3">Filtrar por estado</label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Todos</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {taskStatusLabel(s)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Briefcase className="h-8 w-8" />}
                title="No hay tareas"
                description="Cuando se procesen correos o se creen tareas manualmente aparecerán aquí."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableHead>Tarea</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead className="w-10" />
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <Link href={`/tareas/${task.id}`} className="font-medium text-ink hover:text-accent hover:underline">
                        {task.title}
                      </Link>
                    </TableCell>
                    <TableCell>{task.client?.name || "—"}</TableCell>
                    <TableCell>{task.area || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={task.status === "Terminada" ? "success" : "warning"}>{taskStatusLabel(task.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={task.priority} />
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-ink-3" />
                    </TableCell>
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
