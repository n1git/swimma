"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function HourlyChart({ data }: { data: { hour: string; visits: number }[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Jumlah kunjungan per jam dalam 30 hari terakhir">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="hour" fontSize={11} interval={1} />
          <YAxis fontSize={12} allowDecimals={false} width={40} />
          <Tooltip formatter={(value) => [`${value} kunjungan`, "Jumlah"]} />
          <Bar dataKey="visits" fill="var(--color-primary)" name="Kunjungan" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
