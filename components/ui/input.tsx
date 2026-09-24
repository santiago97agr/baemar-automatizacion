import * as React from "react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded border border-line-strong bg-surface px-3 py-2 text-body text-ink placeholder:text-ink-3 hover:border-ink-3 focus:border-accent",
        className
      )}
      {...props}
    />
  );
}
