import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "neutral" | "success" | "warning" | "danger" | "info";
  dot?: boolean;
};

export function Badge({
  className,
  variant = "neutral",
  dot,
  children,
  ...props
}: BadgeProps) {
  const variants = {
    neutral: "bg-highlight text-ink-2 border-line",
    success: "bg-success-bg text-success-text border-success-border",
    warning: "bg-warning-bg text-warning-text border-warning-border",
    danger: "bg-danger-bg text-danger-text border-danger-border",
    info: "bg-info-bg text-info-text border-info-border",
  };

  const dotColors = {
    neutral: "bg-ink-3",
    success: "bg-success-text",
    warning: "bg-warning-text",
    danger: "bg-danger-text",
    info: "bg-info-text",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-meta font-medium",
        variants[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", dotColors[variant])}
        />
      )}
      {children}
    </span>
  );
}
