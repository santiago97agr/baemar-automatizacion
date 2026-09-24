import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded border border-dashed border-line bg-surface py-12 text-center",
        className
      )}
    >
      <div className="mb-3 text-ink-3" aria-hidden="true">
        {icon}
      </div>
      <h3 className="text-h3 text-ink">{title}</h3>
      {description && (
        <p className="mt-1 max-w-xs text-body text-ink-2">{description}</p>
      )}
    </div>
  );
}
