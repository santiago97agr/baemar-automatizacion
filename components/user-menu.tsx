"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function UserMenu() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.push("/login");
  };

  return (
    <div className="border-t border-line p-3">
      <button
        type="button"
        onClick={handleLogout}
        className="flex w-full items-center gap-3 rounded px-3 py-2 text-ink-2 transition-ui hover:bg-highlight hover:text-ink"
      >
        <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="text-body">Cerrar sesión</span>
      </button>
    </div>
  );
}
