import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FieldProps = {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  className?: string;
};

export function Field({
  label,
  htmlFor,
  children,
  hint,
  error,
  className,
}: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-meta font-medium text-ink-2"
      >
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-meta text-ink-3">{hint}</p>}
      {error && <p className="text-meta text-danger-text">{error}</p>}
    </div>
  );
}
