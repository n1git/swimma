"use client";

import { formatRupiahCompact, formatRupiahFull } from "@/lib/format";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface RevenueByProgramPoint {
  package_name: string;
  revenue: number;
}

export function RevenueByProgramChart({ data }: { data: RevenueByProgramPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="package_name" fontSize={12} />
          <YAxis fontSize={12} tickFormatter={formatRupiahCompact} width={80} />
          <Tooltip formatter={(value) => formatRupiahFull(value)} contentStyle={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-card-foreground)" }} labelStyle={{ color: "var(--color-card-foreground)" }} itemStyle={{ color: "var(--color-card-foreground)" }} />
          <Bar dataKey="revenue" fill="var(--color-primary)" name="Pendapatan" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
