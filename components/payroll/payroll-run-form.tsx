"use client";

import { useActionState, useState } from "react";
import { createPayrollRun, previewPayrollSessions } from "@/lib/actions/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useActionToast } from "@/components/shared/use-action-toast";
import type { Lookup } from "@/lib/data/lookups";

export function PayrollRunForm({ coaches }: { coaches: Lookup[] }) {
  const [state, formAction, pending] = useActionState(createPayrollRun, {});
  useActionToast(state, "Gaji berhasil dibuat");
  const [coachId, setCoachId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
  const [sessionNote, setSessionNote] = useState<string | null>(null);
  const [counting, setCounting] = useState(false);

  async function fillFromSessions() {
    setCounting(true);
    const preview = await previewPayrollSessions(coachId, periodStart, periodEnd);
    setCounting(false);
    if (!preview) {
      setSessionNote("Gagal menghitung sesi. Periksa pelatih dan periode.");
      return;
    }
    if (preview.rate === null) {
      setSessionNote(`${preview.sessions} sesi mengajar. Tarif per sesi pelatih ini belum diisi di halaman Pelatih.`);
      return;
    }
    setBaseSalary(String(preview.sessions * preview.rate));
    setSessionNote(
      `${preview.sessions} sesi × Rp ${preview.rate.toLocaleString("id-ID")} = Rp ${(preview.sessions * preview.rate).toLocaleString("id-ID")}. Bisa diubah sebelum disimpan.`
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="coachId">Pelatih</Label>
        <Select id="coachId" name="coachId" required value={coachId} onChange={(e) => setCoachId(e.target.value)}>
          <option value="" disabled>
            Pilih pelatih
          </option>
          {coaches.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="periodStart">Awal Periode</Label>
          <Input id="periodStart" name="periodStart" type="date" required value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="periodEnd">Akhir Periode</Label>
          <Input id="periodEnd" name="periodEnd" type="date" required value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={!coachId || !periodStart || !periodEnd || counting}
          onClick={fillFromSessions}
        >
          {counting ? "Menghitung..." : "Hitung dari sesi mengajar"}
        </Button>
        {sessionNote ? <p className="text-sm text-muted-foreground">{sessionNote}</p> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="baseSalary">Gaji Pokok (Rp)</Label>
          <Input
            id="baseSalary"
            name="baseSalary"
            type="number"
            min={0}
            step={1}
            required
            value={baseSalary}
            onChange={(e) => setBaseSalary(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bonus">Bonus (Rp)</Label>
          <Input id="bonus" name="bonus" type="number" min={0} step={1000} defaultValue={0} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="thr">THR (Rp)</Label>
          <Input id="thr" name="thr" type="number" min={0} step={1000} defaultValue={0} />
        </div>
      </div>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Memproses..." : "Buat Gaji"}
      </Button>
    </form>
  );
}
