"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/app-shell";

export function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return <>{children}</>;
  return <AppShell>{children}</AppShell>;
}
