"use client";

import { formatRupiahCompact, formatRupiahFull } from "@/lib/format";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, ChartTable, ChartTotal, TOOLTIP_STYLE, TOOLTIP_TEXT } from "./chart-parts";

export interface CashFlowPoint {
  month: string;
  cash_in: number;
  cash_out: number;
  net: number;
}

export function CashflowChart({ data }: { data: CashFlowPoint[] }) {
  const net = data.reduce((sum, d) => sum + Number(d.net), 0);
  return (
    <div>
      <ChartTotal label="Bersih" value={formatRupiahFull(net)} />
      <div className="h-72 w-full" role="img" aria-label="Diagram batang arus kas bulanan, rinciannya ada pada tabel di bawah">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_TICK} tickFormatter={formatRupiahCompact} width={80} tickLine={false} axisLine={false} tickCount={6} />
            <Tooltip
              cursor={{ fill: "var(--color-muted)", opacity: 0.6 }}
              formatter={(value) => formatRupiahFull(value)}
              contentStyle={TOOLTIP_STYLE}
              labelStyle={TOOLTIP_TEXT}
              itemStyle={TOOLTIP_TEXT}
            />
            <ReferenceLine y={0} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" />
            <Bar dataKey="cash_in" name="Masuk" fill="var(--color-success)" fillOpacity={0.72} radius={[6, 6, 0, 0]} maxBarSize={28} activeBar={{ fillOpacity: 1 }} animationDuration={240} />
            <Bar dataKey="cash_out" name="Keluar" fill="var(--color-destructive)" fillOpacity={0.72} radius={[6, 6, 0, 0]} maxBarSize={28} activeBar={{ fillOpacity: 1 }} animationDuration={240} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartTable
        caption="Arus kas bulanan"
        head={["Bulan", "Masuk", "Keluar", "Bersih"]}
        rows={data.map((d) => [d.month, formatRupiahFull(d.cash_in), formatRupiahFull(d.cash_out), formatRupiahFull(d.net)])}
      />
    </div>
  );
}
