import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 80},${28 - ((v - min) / span) * 24 - 2}`).join(" ");
  return (
    <svg viewBox="0 0 80 28" className="h-7 w-20 shrink-0 text-primary" aria-hidden="true" focusable="false">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MetricCard({
  title,
  value,
  delta,
  deltaLabel,
  spark,
  className,
}: {
  title: string;
  value: React.ReactNode;
  delta?: number;
  deltaLabel?: string;
  spark?: number[];
  className?: string;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <Card className={cn("flex min-h-[8.75rem] flex-col", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          {delta !== undefined ? (
            <p className={cn("mt-1 flex items-center gap-1 text-xs", up ? "text-success" : "text-destructive")}>
              {up ? <ArrowUpRight className="size-3.5" aria-hidden="true" /> : <ArrowDownRight className="size-3.5" aria-hidden="true" />}
              <span>
                {up ? "Naik" : "Turun"} {Math.abs(delta).toLocaleString("id-ID")}%
              </span>
              {deltaLabel ? <span className="text-muted-foreground">{deltaLabel}</span> : null}
            </p>
          ) : null}
        </div>
        {spark ? <Sparkline values={spark} /> : null}
      </CardContent>
    </Card>
  );
}
