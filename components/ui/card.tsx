import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, frame = true, ...props }: React.ComponentProps<"div"> & { frame?: boolean }) {
  return (
    <div
      data-frame={frame}
      className={cn(
        "group/card min-w-0 border border-border text-card-foreground",
        frame
          ? "hatch rounded-[var(--radius-frame)] p-[3px]"
          : "rounded-lg bg-card shadow-sm",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 p-6 group-data-[frame=true]/card:min-h-9 group-data-[frame=true]/card:justify-center group-data-[frame=true]/card:gap-0.5 group-data-[frame=true]/card:px-3 group-data-[frame=true]/card:py-2",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "text-lg font-semibold leading-none tracking-tight group-data-[frame=true]/card:text-sm group-data-[frame=true]/card:font-medium group-data-[frame=true]/card:text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground group-data-[frame=true]/card:text-xs", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "p-6 pt-0 group-data-[frame=true]/card:rounded-[var(--radius-inner)] group-data-[frame=true]/card:border group-data-[frame=true]/card:border-border group-data-[frame=true]/card:bg-card group-data-[frame=true]/card:p-4 group-data-[frame=true]/card:shadow-sm",
        className
      )}
      {...props}
    />
  );
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center p-6 pt-0 group-data-[frame=true]/card:px-3 group-data-[frame=true]/card:py-2",
        className
      )}
      {...props}
    />
  );
}
