import { AppSidebar } from "@/components/app-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full lg:flex">
      <AppSidebar />
      <main className="min-h-full flex-1 p-4 md:p-6 lg:p-8">{children}</main>
    </div>
  );
}
