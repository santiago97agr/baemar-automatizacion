"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Scale } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { feedbackTypeLabel } from "@/lib/labels";

type FeedbackItem = {
  id: string;
  type: string;
  text: string;
  active: boolean;
  createdAt: string;
  activity: { id: string; title: string; subject: string };
};

export default function ReglasPage() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/feedback", { credentials: "include" });
      if (!res.ok) throw new Error("Error cargando reglas");
      const data = await res.json();
      setFeedback(data.feedback || []);
      setError(false);
    } catch {
      setFeedback([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(id: string, active: boolean) {
    setTogglingId(id);
    await fetch(`/api/feedback/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    await load();
    setTogglingId(null);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Reglas"
        description="Correcciones y feedback que la IA tendrá en cuenta al procesar próximos correos."
      />

      {loading ? (
        <Card>
          <CardContent className="p-0">
            <div className="space-y-3 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <EmptyState
          icon={<AlertCircle className="h-8 w-8" />}
          title="No se pudieron cargar las reglas"
          description="Ha ocurrido un error al consultar el feedback. Inténtalo de nuevo."
        />
      ) : feedback.length === 0 ? (
        <EmptyState
          icon={<Scale className="h-8 w-8" />}
          title="No hay reglas todavía"
          description="Cuando corrijas una actividad y añadas feedback, la regla aparecerá aquí."
        />
      ) : (
        <Card className="max-xl:overflow-x-auto">
          <CardContent className="min-w-[800px] p-0">
            <Table>
              <TableHeader>
                <TableHead>Tipo</TableHead>
                <TableHead>Regla</TableHead>
                <TableHead>Actividad de origen</TableHead>
                <TableHead className="text-right">Fecha</TableHead>
                <TableHead className="text-right">Activa</TableHead>
              </TableHeader>
              <TableBody>
                {feedback.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      <Badge variant="neutral">
                        {feedbackTypeLabel(f.type)}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={f.active ? "text-ink" : "text-ink-3"}
                    >
                      {f.text}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/items/${f.activity.id}`}
                        className="text-accent hover:underline"
                      >
                        {f.activity.title}
                      </Link>
                      <p className="text-meta text-ink-3">{f.activity.subject}</p>
                    </TableCell>
                    <TableCell className="tabular text-right text-ink-3">
                      {formatDateTime(f.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={f.active}
                        onChange={() => toggle(f.id, f.active)}
                        label={f.active ? `Desactivar regla ${f.text}` : `Activar regla ${f.text}`}
                        disabled={togglingId === f.id}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
