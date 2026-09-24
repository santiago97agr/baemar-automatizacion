import { cn } from "@/lib/utils";

type Option = {
  value: string;
  label: string;
};

type SegmentedControlProps = {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  className?: string;
};

export function SegmentedControl({
  value,
  options,
  onChange,
  className,
}: SegmentedControlProps) {
  return (
    <div
      className={cn(
        "inline-flex rounded border border-line bg-surface p-1",
        className
      )}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded px-3 py-1.5 text-meta font-medium transition-ui",
              active
                ? "bg-ink text-surface"
                : "text-ink-2 hover:bg-highlight hover:text-ink"
            )}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
