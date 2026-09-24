"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ShieldCheck } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { errorSourceLabel } from "@/lib/labels";

type ErrorItem = {
  id: string;
  source: string;
  message: string;
  resolved: boolean;
  createdAt: string;
  activity: { id: string; title: string; subject: string; messageId: string } | null;
};

const filterOptions = [
  { value: "all", label: "Todos" },
  { value: "n8n", label: "n8n" },
  { value: "ia", label: "IA" },
  { value: "notion", label: "Notion" },
  { value: "processing", label: "Procesamiento" },
  { value: "erp", label: "ERP" },
];

export default function ErroresPage() {
  const [errors, setErrors] = useState<ErrorItem[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const url = filter === "all" ? "/api/errors" : `/api/errors?source=${filter}`;
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Error cargando errores");
      const data = await res.json();
      setErrors(data.errors || []);
      setError(false);
    } catch {
      setErrors([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function resolve(id: string) {
    setResolvingId(id);
    await fetch(`/api/errors/${id}`, {
      method: "PATCH",
      credentials: "include",
    });
    await load();
    setResolvingId(null);
  }

  const unresolvedCount = errors.filter((e) => !e.resolved).length;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Errores"
        description="Fallos de n8n, IA, Notion y procesamiento. Reprocesa la actividad desde su detalle una vez resuelta la causa."
      />

      <SegmentedControl
        value={filter}
        options={filterOptions}
        onChange={setFilter}
        className="mb-6"
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
          title="No se pudieron cargar los errores"
          description="Ha ocurrido un error al consultar el registro. Inténtalo de nuevo."
        />
      ) : errors.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-8 w-8" />}
          title="Sin errores registrados"
          description={
            filter === "all"
              ? "El pipeline está funcionando con normalidad."
              : "No hay errores para este filtro."
          }
        />
      ) : (
        <>
          {unresolvedCount > 0 && (
            <p className="mb-3 text-meta text-ink-2">
              <span className="tabular font-medium text-danger-text">
                {unresolvedCount}
              </span>{" "}
              {unresolvedCount === 1 ? "error abierto" : "errores abiertos"} en
              este filtro
            </p>
          )}
          <Card className="max-xl:overflow-x-auto">
            <CardContent className="min-w-[900px] p-0">
              <Table>
                <TableHeader>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead>Mensaje</TableHead>
                  <TableHead>Actividad</TableHead>
                  <TableHead className="text-right">Fecha</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableHeader>
                <TableBody>
                  {errors.map((err) => (
                    <TableRow key={err.id}>
                      <TableCell>
                        {err.resolved ? (
                          <Badge variant="success" dot>
                            Resuelto
                          </Badge>
                        ) : (
                          <Badge variant="danger" dot>
                            Abierto
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-ink">
                          {errorSourceLabel(err.source)}
                        </span>
                      </TableCell>
                      <TableCell
                        className={`max-w-md break-words ${
                          err.resolved ? "text-ink-3" : "text-ink"
                        }`}
                      >
                        {err.message}
                      </TableCell>
                      <TableCell>
                        {err.activity ? (
                          <>
                            <Link
                              href={`/items/${err.activity.id}`}
                              className="inline-flex items-center gap-1 text-accent hover:underline"
                            >
                              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                              {err.activity.title}
                            </Link>
                            <p className="text-meta text-ink-3">
                              {err.activity.subject}
                            </p>
                          </>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular text-right text-ink-3">
                        {formatDateTime(err.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {!err.resolved && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => resolve(err.id)}
                            loading={resolvingId === err.id}
                          >
                            Resolver
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
