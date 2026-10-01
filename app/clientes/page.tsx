"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { clientStatusLabel } from "@/lib/labels";

type Client = {
  id: string;
  name: string;
  taxId: string | null;
  status: string;
  _count: { tasks: number; communications: number };
  contacts: { channel: string; address: string }[];
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", taxId: "", email: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/clients", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setClients(data.clients || []))
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const contacts = form.email.trim()
      ? [{ channel: "Email", address: form.email.trim(), isPrimary: true }]
      : [];
    const res = await fetch("/api/clients", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name.trim(), taxId: form.taxId.trim() || undefined, contacts }),
    });
    setSaving(false);
    if (res.ok) {
      setForm({ name: "", taxId: "", email: "" });
      const updated = await fetch("/api/clients", { credentials: "include" }).then((r) => r.json());
      setClients(updated.clients || []);
    }
  }

  if (loading || clients === null) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title="Clientes" description="Gestión de clientes del despacho." />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Clientes" description="Gestión de clientes del despacho." />

      <Card>
        <CardHeader>
          <h2 className="text-h3">Nuevo cliente</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid gap-4 sm:grid-cols-4">
            <Field label="Nombre / razón social" className="sm:col-span-2">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="NIF/CIF">
              <Input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
            </Field>
            <Field label="Email principal">
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" />
            </Field>
            <div className="flex items-end">
              <Button type="submit" loading={saving}>
                <Plus className="mr-1 h-4 w-4" /> Crear
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-h3">Listado</h2>
        </CardHeader>
        <CardContent className="p-0">
          {clients.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Building2 className="h-8 w-8" />}
                title="No hay clientes"
                description="Crea el primer cliente para empezar a vincular correos."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableHead>Cliente</TableHead>
                <TableHead>Contactos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Tareas</TableHead>
                <TableHead>Comunicaciones</TableHead>
                <TableHead className="w-10" />
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <Link
                        href={`/clientes/${client.id}`}
                        className="font-medium text-ink hover:text-accent hover:underline"
                      >
                        {client.name}
                      </Link>
                      {client.taxId && <p className="text-meta text-ink-3">{client.taxId}</p>}
                    </TableCell>
                    <TableCell>
                      <p className="text-meta text-ink-2">
                        {client.contacts.map((c) => c.address).join(", ") || "—"}
                      </p>
                    </TableCell>
                    <TableCell>{clientStatusLabel(client.status)}</TableCell>
                    <TableCell>{client._count.tasks}</TableCell>
                    <TableCell>{client._count.communications}</TableCell>
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
