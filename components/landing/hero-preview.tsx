import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SampleLabel } from "./sample-label";

const STATS = [
  { label: "Booking hari ini", value: "18" },
  { label: "Okupansi minggu ini", value: "64%" },
  { label: "Penjualan hari ini", value: "Rp 1.250.000" },
];

const SLOTS = [
  { time: "16:00", court: "Lapangan 1", who: "Anggota", state: "Terisi" },
  { time: "16:00", court: "Lapangan 2", who: "-", state: "Kosong" },
  { time: "17:00", court: "Lapangan 1", who: "Kelas", state: "Terisi" },
  { time: "17:00", court: "Lapangan 2", who: "Tamu", state: "Terisi" },
];

export function HeroPreview() {
  return (
    <figure className="relative motion-safe:animate-fade-up" aria-label="Contoh tampilan dasbor admin dengan data contoh">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-heading text-sm font-semibold">Dasbor Admin</p>
          <SampleLabel />
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-background p-3">
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className="mt-1 font-heading text-base font-semibold tabular-nums sm:text-lg">{s.value}</dd>
            </div>
          ))}
        </dl>
        <Card className="mt-3 p-4 shadow-none">
          <p className="mb-3 text-sm font-semibold">Booking · Sabtu</p>
          <div>
            <ul className="grid grid-cols-2 gap-2">
              {SLOTS.map((slot) => (
                <li
                  key={`${slot.time}-${slot.court}`}
                  className={
                    slot.state === "Kosong"
                      ? "rounded-md border border-dashed border-border px-3 py-2"
                      : "rounded-md border border-primary/30 bg-primary/10 px-3 py-2"
                  }
                >
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {slot.time} · {slot.court}
                  </p>
                  <p className="text-sm font-medium">{slot.state === "Kosong" ? "Kosong" : slot.who}</p>
                </li>
              ))}
            </ul>
          </div>
        </Card>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
          <p className="text-sm">
            <span className="font-medium">POS-2026-000128</span>
            <span className="text-muted-foreground"> · Tunai + QRIS</span>
          </p>
          <Badge variant="success">Lunas</Badge>
        </div>
      </div>
      <figcaption className="sr-only">Contoh data, bukan data klub sungguhan.</figcaption>
    </figure>
  );
}
