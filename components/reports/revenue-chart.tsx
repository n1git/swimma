"use client";

import { formatRupiahCompact, formatRupiahFull } from "@/lib/format";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, ChartTable, ChartTotal, TOOLTIP_STYLE, TOOLTIP_TEXT } from "./chart-parts";

export interface RevenueByProgramPoint {
  package_name: string;
  revenue: number;
}

export function RevenueByProgramChart({ data }: { data: RevenueByProgramPoint[] }) {
  const total = data.reduce((sum, d) => sum + Number(d.revenue), 0);
  const average = data.length ? total / data.length : 0;
  return (
    <div>
      <ChartTotal label="Total" value={formatRupiahFull(total)} />
      <div className="h-72 w-full" role="img" aria-label="Diagram batang pendapatan per program, rinciannya ada pada tabel di bawah">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis dataKey="package_name" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_TICK} tickFormatter={formatRupiahCompact} width={80} tickLine={false} axisLine={false} tickCount={6} />
            <Tooltip
              cursor={{ fill: "var(--color-muted)", opacity: 0.6 }}
              formatter={(value) => formatRupiahFull(value)}
              contentStyle={TOOLTIP_STYLE}
              labelStyle={TOOLTIP_TEXT}
              itemStyle={TOOLTIP_TEXT}
            />
            {data.length > 1 ? <ReferenceLine y={average} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" /> : null}
            <Bar
              dataKey="revenue"
              name="Pendapatan"
              fill="var(--color-primary)"
              fillOpacity={0.72}
              radius={[6, 6, 0, 0]}
              maxBarSize={48}
              activeBar={{ fill: "var(--color-primary)", fillOpacity: 1 }}
              animationDuration={240}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartTable
        caption="Pendapatan per program"
        head={["Program", "Pendapatan"]}
        rows={data.map((d) => [d.package_name, formatRupiahFull(d.revenue)])}
      />
    </div>
  );
}
