import { getActiveCoaches, getLocations } from "@/lib/data/lookups";
import { Dialog } from "@/components/ui/dialog";
import { MemberForm } from "@/components/members/member-form";

export default async function NewMemberModal() {
  const [locations, coaches] = await Promise.all([getLocations(), getActiveCoaches()]);
  return (
    <Dialog>
      <h2 className="mb-4 text-xl font-semibold">Daftarkan Anggota Baru</h2>
      <MemberForm locations={locations} coaches={coaches} />
    </Dialog>
  );
}
