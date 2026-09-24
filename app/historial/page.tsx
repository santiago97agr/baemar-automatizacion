"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight, History } from "lucide-react";
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
import {
  CategoryBadge,
  PriorityBadge,
  ReviewStatusBadge,
  TargetStatusBadge,
} from "@/components/status-badges";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";

type Target = {
  id: string;
  targetType: string;
  status: string;
  targetUrl: string | null;
};

type Item = {
  id: string;
  title: string;
  subject: string;
  from: string;
  type: string;
  priority: string;
  reviewStatus: string;
  status: string;
  createdAt: string;
  targets: Target[];
};

function HistorialSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="space-y-3 p-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function HistorialPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/items", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Error cargando historial");
        return res.json();
      })
      .then((data) => {
        setItems(data.items || []);
        setError(false);
      })
      .catch(() => {
        setItems([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Historial"
        description="Todas las ejecuciones procesadas, su decisión de IA y el estado en los destinos."
      />

      {loading ? (
        <HistorialSkeleton />
      ) : error ? (
        <EmptyState
          icon={<AlertCircle className="h-8 w-8" />}
          title="No se pudo cargar el historial"
          description="Ha ocurrido un error al consultar las ejecuciones. Inténtalo de nuevo."
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<History className="h-8 w-8" />}
          title="No hay ejecuciones aún"
          description="Cuando se procesen correos aparecerán en este listado."
        />
      ) : (
        <Card className="max-xl:overflow-x-auto">
          <CardContent className="min-w-[900px] p-0">
            <Table>
              <TableHeader>
                <TableHead>Actividad</TableHead>
                <TableHead>Remitente</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Revisión</TableHead>
                <TableHead>Destinos</TableHead>
                <TableHead className="text-right">Fecha</TableHead>
                <TableHead className="w-10" />
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link
                        href={`/items/${item.id}`}
                        className="font-medium text-ink hover:text-accent hover:underline"
                      >
                        {item.title}
                      </Link>
                      <p className="text-meta text-ink-3">{item.subject}</p>
                    </TableCell>
                    <TableCell className="text-ink">{item.from}</TableCell>
                    <TableCell>
                      <CategoryBadge category={item.type} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={item.priority} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <ReviewStatusBadge status={item.reviewStatus} />
                        {item.status === "error" && (
                          <TargetStatusBadge status="error" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {item.targets.map((t) => (
                          <div key={t.id} className="flex items-center gap-2">
                            <TargetStatusBadge status={t.status} />
                            {t.targetUrl && (
                              <a
                                href={t.targetUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-meta text-accent hover:underline"
                              >
                                Ver
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="tabular text-right text-ink-3">
                      {formatDateTime(item.createdAt)}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden="true" />
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
