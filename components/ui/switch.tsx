import * as React from "react";
import { cn } from "@/lib/utils";

export function Switch({
  checked,
  label,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "type" | "role"> & { checked: boolean; label: string }) {
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors after:absolute after:-inset-2 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-input",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-background shadow transition-transform motion-reduce:transition-none",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
