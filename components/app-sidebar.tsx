"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  History,
  Inbox,
  LayoutDashboard,
  Menu,
  Scale,
  Settings,
  X,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/revisiones", label: "Revisiones", icon: Inbox },
  { href: "/historial", label: "Historial", icon: History },
  { href: "/reglas", label: "Reglas", icon: Scale },
  { href: "/errores", label: "Errores", icon: AlertCircle },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer on Escape
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      {/* Mobile header */}
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <span className="font-semibold text-ink">Gestoría</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded text-ink-2 hover:bg-highlight hover:text-ink"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      {/* Mobile overlay */}
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default bg-ink/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Cerrar menú"
          tabIndex={-1}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 z-50 h-full w-56 border-r border-line bg-surface
          transition-transform duration-200 ease-out
          lg:sticky lg:top-0 lg:h-screen lg:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex flex-col">
              <span className="font-semibold text-ink">Gestoría</span>
              <span className="text-meta text-ink-3">Automatización</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-ink-3 hover:bg-highlight hover:text-ink lg:hidden"
              aria-label="Cerrar menú"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-3" aria-label="Navegación principal">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`
                        group relative flex items-center gap-3 rounded px-3 py-2 transition-ui
                        ${
                          active
                            ? "bg-highlight font-medium text-ink"
                            : "text-ink-2 hover:bg-highlight hover:text-ink"
                        }
                      `}
                      aria-current={active ? "page" : undefined}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-accent" />
                      )}
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="text-body">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </aside>
    </>
  );
}
