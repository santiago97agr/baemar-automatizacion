import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: number;
  variant?: "default" | "danger";
};

export function KpiCard({ label, value, variant = "default" }: KpiCardProps) {
  const isDanger = variant === "danger" && value > 0;

  return (
    <div
      className={cn(
        "rounded border bg-surface p-5",
        isDanger ? "border-danger-border bg-danger-bg" : "border-line"
      )}
    >
      <div
        className={cn(
          "text-stat font-semibold tabular tracking-tight",
          isDanger ? "text-danger-text" : "text-ink"
        )}
      >
        {value}
      </div>
      <div
        className={cn(
          "mt-1 text-meta font-medium",
          isDanger ? "text-danger-text" : "text-ink-2"
        )}
      >
        {label}
      </div>
    </div>
  );
}
