"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight, Inbox } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
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
  type: string;
  priority: string;
  reviewStatus: string;
  status: string;
  createdAt: string;
  targets: Target[];
};

const filterOptions = [
  { value: "pending", label: "Pendientes" },
  { value: "reviewed", label: "Revisados" },
  { value: "not_required", label: "Sin revisión" },
];

function emptyMessage(filter: string) {
  switch (filter) {
    case "pending":
      return {
        title: "No hay revisiones pendientes",
        description: "Cuando la IA necesite confirmación aparecerán aquí.",
      };
    case "reviewed":
      return {
        title: "No hay revisiones revisadas",
        description: "Las actividades que marques como revisadas aparecerán aquí.",
      };
    default:
      return {
        title: "No hay actividades en este estado",
        description: "La IA considera que estas actividades no necesitan revisión.",
      };
  }
}

function RevisionesSkeleton() {
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

export default function RevisionesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/items?reviewStatus=${filter}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Error cargando actividades");
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
  }, [filter]);

  const empty = emptyMessage(filter);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Revisiones"
        description="Revisa y corrige las actividades que la IA ha marcado como dudosas antes de enviarlas a los destinos."
      />

      <SegmentedControl
        value={filter}
        options={filterOptions}
        onChange={setFilter}
        className="mb-6"
      />

      {loading ? (
        <RevisionesSkeleton />
      ) : error ? (
        <EmptyState
          icon={<AlertCircle className="h-8 w-8" />}
          title="No se pudieron cargar las revisiones"
          description="Ha ocurrido un error al consultar las actividades. Inténtalo de nuevo."
        />
      ) : items.length === 0 ? (
        <EmptyState icon={<Inbox className="h-8 w-8" />} title={empty.title} description={empty.description} />
      ) : (
        <Card className="max-xl:overflow-x-auto">
          <CardContent className="min-w-[900px] p-0">
            <Table>
              <TableHeader>
                <TableHead>Actividad</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Estado</TableHead>
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
                      <div className="flex flex-wrap gap-1.5">
                        {item.targets.map((t) => (
                          <TargetStatusBadge key={t.id} status={t.status} />
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
