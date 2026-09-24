"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight, History } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CategoryBadge,
  ReviewStatusBadge,
  TargetStatusBadge,
} from "@/components/status-badges";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";

type Stats = {
  processed: number;
  pendingReview: number;
  reviewed: number;
  errors: number;
  notionErrors: number;
  n8nErrors: number;
  iaErrors: number;
  lastRuns: {
    id: string;
    subject: string;
    title: string;
    type: string;
    reviewStatus: string;
    status: string;
    createdAt: string;
    targets: { targetType: string; status: string; targetUrl: string | null }[];
  }[];
};

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-16" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Error cargando métricas");
        return res.json();
      })
      .then((data) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Dashboard"
          description="Resumen de procesamiento, revisiones pendientes y últimas ejecuciones."
        />
        <DashboardSkeleton />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Dashboard"
          description="Resumen de procesamiento, revisiones pendientes y últimas ejecuciones."
        />
        <EmptyState
          icon={<AlertCircle className="h-8 w-8" />}
          title="Error cargando dashboard"
          description="No se pudieron cargar las métricas. Inténtalo de nuevo."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Dashboard"
        description="Resumen de procesamiento, revisiones pendientes y últimas ejecuciones."
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Procesados" value={stats.processed} />
        <KpiCard label="Pendientes de revisión" value={stats.pendingReview} />
        <KpiCard label="Revisados" value={stats.reviewed} />
        <KpiCard label="Errores" value={stats.errors} variant="danger" />
      </div>

      <div className="mt-6">
        <h2 className="text-h3 mb-3">Errores por fuente</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard label="Notion" value={stats.notionErrors} variant="danger" />
          <KpiCard label="n8n" value={stats.n8nErrors} variant="danger" />
          <KpiCard label="IA" value={stats.iaErrors} variant="danger" />
        </div>
      </div>

      <Card className="mt-8 max-xl:overflow-x-auto">
        <CardHeader>
          <h2 className="text-h3">Últimas ejecuciones</h2>
        </CardHeader>
        <CardContent className="p-0">
          {stats.lastRuns.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<History className="h-8 w-8" />}
                title="Aún no hay ejecuciones"
                description="Cuando la IA procese correos aparecerán aquí."
              />
            </div>
          ) : (
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableHead>Actividad</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Destinos</TableHead>
                <TableHead className="text-right">Fecha</TableHead>
                <TableHead className="w-10" />
              </TableHeader>
              <TableBody>
                {stats.lastRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <Link
                        href={`/items/${run.id}`}
                        className="font-medium text-ink hover:text-accent hover:underline"
                      >
                        {run.title}
                      </Link>
                      <p className="text-meta text-ink-3">{run.subject}</p>
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={run.type} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <ReviewStatusBadge status={run.reviewStatus} />
                        {run.status === "error" && (
                          <TargetStatusBadge status="error" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {run.targets.map((t, i) => (
                          <TargetStatusBadge key={i} status={t.status} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="tabular text-right text-ink-3">
                      {formatDateTime(run.createdAt)}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden="true" />
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
