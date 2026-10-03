import { requireMemberClub } from "@/lib/auth/guard";
import { requireModule } from "@/lib/modules";
import { getVisitHistory } from "@/lib/data/checkin";
import { getClubTerms } from "@/lib/club-type";
import { MetricCard } from "@/components/ui/metric-card";
import { VisitTable } from "@/components/checkin/visit-table";

export default async function MemberVisitsPage() {
  await requireMemberClub();
  await requireModule("checkin");
  const [{ rows, visitsThisMonth }, terms] = await Promise.all([getVisitHistory(), getClubTerms()]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{terms.visit} Saya</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard title={`${terms.visit} bulan ini`} value={String(visitsThisMonth)} />
      </div>
      <VisitTable rows={rows} />
    </div>
  );
}
