import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AlertProps = {
  variant?: "info" | "success" | "warning" | "danger";
  children: ReactNode;
  className?: string;
};

export function Alert({
  variant = "info",
  children,
  className,
}: AlertProps) {
  const variants = {
    info: "bg-info-bg text-info-text border-info-border",
    success: "bg-success-bg text-success-text border-success-border",
    warning: "bg-warning-bg text-warning-text border-warning-border",
    danger: "bg-danger-bg text-danger-text border-danger-border",
  };

  return (
    <div
      className={cn(
        "rounded border p-3 text-body",
        variants[variant],
        className
      )}
    >
      {children}
    </div>
  );
}
