import * as React from "react";
import { cn } from "@/lib/utils";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded border border-line-strong bg-surface px-3 py-2 pr-8 text-body text-ink hover:border-ink-3 focus:border-accent",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
