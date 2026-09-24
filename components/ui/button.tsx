import * as React from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md";
  loading?: boolean;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  loading,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const variants = {
    primary: "bg-accent text-surface hover:bg-accent/90 active:bg-accent/80",
    secondary:
      "border border-line bg-surface text-ink hover:bg-highlight active:bg-line/50",
    ghost:
      "bg-transparent text-ink-2 hover:bg-highlight hover:text-ink active:bg-line/50",
    destructive:
      "border border-danger-border bg-danger-bg text-danger-text hover:bg-danger-border/40 active:bg-danger-border/60",
  };

  const sizes = {
    sm: "h-8 px-3 text-meta",
    md: "h-9 px-4 text-body",
  };

  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded font-medium transition-ui disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}
