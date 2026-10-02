import { getVisitHistory } from "@/lib/data/checkin";
import { VisitTable } from "./visit-table";

export async function MemberVisits({ memberId }: { memberId: string }) {
  const { rows, visitsThisMonth } = await getVisitHistory(memberId);
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">Kunjungan</h2>
        <p className="text-sm text-muted-foreground">{visitsThisMonth} kunjungan bulan ini</p>
      </div>
      <VisitTable rows={rows.slice(0, 20)} />
    </section>
  );
}
