"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { bookResource, cancelBooking, setBookingStatus } from "@/lib/actions/booking";
import { BOOKING_STATUS_LABEL } from "@/lib/booking";
import type { GridCell, GridColumn } from "@/lib/booking-grid";
import { formatRupiahFull } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ActionForm } from "@/components/shared/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Lookup } from "@/lib/data/lookups";

interface Selected {
  column: GridColumn;
  cell: GridCell;
}

function used(cell: GridCell) {
  return cell.bookings.filter((b) => b.status === "confirmed").length;
}

function cellSummary(column: GridColumn, cell: GridCell) {
  const count = used(cell);
  const cap = column.resource.capacity;
  if (count === 0) return { text: "Kosong", tone: "free" as const };
  if (cap === 1) return { text: cell.bookings[0]?.label ?? "Terisi", tone: "full" as const };
  return { text: `${count}/${cap} terisi`, tone: count >= cap ? ("full" as const) : ("part" as const) };
}

function BookForm({ selected, members, onDone }: { selected: Selected; members: Lookup[]; onDone: () => void }) {
  const [state, action, pending] = useActionState(bookResource, {});
  const [who, setWho] = useState<"member" | "guest">("member");
  useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Booking dibuat");
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="resourceId" value={selected.column.resource.id} />
      <input type="hidden" name="start" value={selected.cell.start} />
      <input type="hidden" name="end" value={selected.cell.end} />
      <input type="hidden" name="who" value={who} />
      {state.error ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="inline-flex w-fit rounded-md border border-input p-0.5" role="group" aria-label="Jenis pemesan">
        {(["member", "guest"] as const).map((w) => (
          <button
            key={w}
            type="button"
            aria-pressed={who === w}
            onClick={() => setWho(w)}
            className={cn(
              "h-9 rounded px-3 text-sm font-medium",
              who === w ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
            )}
          >
            {w === "member" ? "Anggota" : "Tamu"}
          </button>
        ))}
      </div>
      {who === "member" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bk-member">Anggota</Label>
          <Select id="bk-member" name="memberId" required defaultValue="">
            <option value="" disabled>
              Pilih anggota
            </option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bk-guest">Nama tamu</Label>
            <Input id="bk-guest" name="guestName" required minLength={2} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bk-phone">Telepon (opsional)</Label>
            <Input id="bk-phone" name="guestPhone" type="tel" />
          </div>
        </div>
      )}
      <Button type="submit" disabled={pending} className="h-10 w-fit">
        {pending ? "Menyimpan..." : "Buat booking"}
      </Button>
    </form>
  );
}

export function BookingCalendar({
  columns,
  members,
  nowIso,
  emptyText,
}: {
  columns: GridColumn[];
  members: Lookup[];
  nowIso: string;
  emptyText: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [selectedKey, setSelectedKey] = useState<{ column: string; start: string } | null>(null);
  const now = new Date(nowIso).getTime();

  const selected: Selected | null = (() => {
    if (!selectedKey) return null;
    const column = columns.find((c) => c.key === selectedKey.column);
    const cell = column?.cells.find((c) => c.start === selectedKey.start);
    return column && cell ? { column, cell } : null;
  })();

  function open(column: GridColumn, cell: GridCell) {
    setSelectedKey({ column: column.key, start: cell.start });
    ref.current?.showModal();
  }

  const close = () => ref.current?.close();
  const remaining = selected ? selected.column.resource.capacity - used(selected.cell) : 0;
  const ended = selected ? new Date(selected.cell.end).getTime() <= now : false;
  const started = selected ? new Date(selected.cell.start).getTime() <= now : false;

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((column) => (
          <section key={column.key} className="flex w-44 shrink-0 flex-col gap-1.5 sm:w-48" aria-label={column.title}>
            <header className="rounded-md bg-muted/60 px-3 py-2">
              <p className="text-sm font-semibold">{column.title}</p>
              <p className="text-xs text-muted-foreground">{column.subtitle}</p>
            </header>
            {column.cells.length === 0 ? <p className="px-1 py-2 text-xs text-muted-foreground">{emptyText}</p> : null}
            {column.cells.map((cell) => {
              const summary = cellSummary(column, cell);
              const past = new Date(cell.end).getTime() <= now;
              return (
                <button
                  key={cell.start}
                  type="button"
                  onClick={() => open(column, cell)}
                  className={cn(
                    "flex min-h-[52px] flex-col items-start justify-center rounded-md border px-3 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    summary.tone === "free" && "border-dashed border-border bg-card hover:bg-accent",
                    summary.tone === "part" && "border-primary/30 bg-primary/5 hover:bg-primary/10",
                    summary.tone === "full" && "border-primary/40 bg-primary/10 hover:bg-primary/15",
                    past && "opacity-60"
                  )}
                >
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {cell.startLabel}–{cell.endLabel}
                  </span>
                  <span className={cn("w-full truncate text-sm", summary.tone === "free" ? "text-muted-foreground" : "font-medium")}>
                    {summary.text}
                  </span>
                </button>
              );
            })}
          </section>
        ))}
      </div>

      <dialog
        ref={ref}
        onClose={() => setSelectedKey(null)}
        onClick={(e) => {
          if (e.target === ref.current) close();
        }}
        className="m-auto w-full max-w-lg rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/50"
      >
        <div className="max-h-[85vh] overflow-y-auto p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
          <button type="button" aria-label="Tutup" onClick={close} className="float-right flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent">
            <X className="size-4" />
          </button>
          {selected ? (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold">{selected.column.resource.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {selected.column.subtitle} · {selected.cell.startLabel}–{selected.cell.endLabel} ·{" "}
                  {selected.column.resource.capacity > 1
                    ? `${used(selected.cell)}/${selected.column.resource.capacity} terisi`
                    : used(selected.cell) ? "Terisi" : "Kosong"}
                </p>
              </div>

              {selected.cell.bookings.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {selected.cell.bookings.map((b) => (
                    <li key={b.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{b.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {b.source === "class" ? "Dari jadwal kelas" : b.source === "member" ? "Dipesan anggota" : "Dipesan staf"}
                            {b.phone ? ` · ${b.phone}` : ""}
                            {b.price > 0 ? ` · ${formatRupiahFull(b.price)}` : ""}
                          </p>
                        </div>
                        <Badge variant={b.status === "confirmed" ? "secondary" : b.status === "completed" ? "success" : "warning"}>
                          {BOOKING_STATUS_LABEL[b.status]}
                        </Badge>
                      </div>
                      {b.status === "confirmed" && b.source !== "class" ? (
                        <div className="flex flex-wrap gap-2">
                          {started ? (
                            <>
                              <ActionForm action={setBookingStatus}>
                                <input type="hidden" name="bookingId" value={b.id} />
                                <input type="hidden" name="status" value="completed" />
                                <Button type="submit" size="sm" variant="outline" className="h-9">
                                  Tandai selesai
                                </Button>
                              </ActionForm>
                              <ActionForm action={setBookingStatus}>
                                <input type="hidden" name="bookingId" value={b.id} />
                                <input type="hidden" name="status" value="no_show" />
                                <Button type="submit" size="sm" variant="outline" className="h-9">
                                  Tidak hadir
                                </Button>
                              </ActionForm>
                            </>
                          ) : null}
                          <ActionForm action={cancelBooking}>
                            <input type="hidden" name="bookingId" value={b.id} />
                            <Button
                              type="submit"
                              size="sm"
                              variant="destructive"
                              className="h-9"
                              onClick={(e) => {
                                if (!window.confirm(`Batalkan booking ${b.label}?`)) e.preventDefault();
                              }}
                            >
                              Batalkan
                            </Button>
                          </ActionForm>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              {remaining > 0 && !ended ? (
                <div className="flex flex-col gap-3 border-t border-border pt-4">
                  <h3 className="text-sm font-semibold">Booking baru</h3>
                  <BookForm key={`${selected.column.key}-${selected.cell.start}`} selected={selected} members={members} onDone={close} />
                </div>
              ) : null}
              {remaining > 0 && ended ? <p className="text-sm text-muted-foreground">Slot ini sudah lewat.</p> : null}
              {remaining <= 0 ? <p className="text-sm text-muted-foreground">Slot penuh.</p> : null}
            </div>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
