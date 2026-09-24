import * as React from "react";
import { cn } from "@/lib/utils";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "min-h-[5rem] w-full rounded border border-line-strong bg-surface px-3 py-2 text-body text-ink placeholder:text-ink-3 hover:border-ink-3 focus:border-accent",
        className
      )}
      {...props}
    />
  );
}
