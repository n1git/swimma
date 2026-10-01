import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveCoaches, getLocations } from "@/lib/data/lookups";
import { BackLink } from "@/components/shared/back-link";
import { MemberEditForm } from "@/components/members/member-edit-form";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const [{ data: member }, locations, coaches] = await Promise.all([
    supabase
      .from("members")
      .select(
        "id, full_name, date_of_birth, notes, address, preferred_location_id, is_active, coach_id, contact_name, contact_phone"
      )
      .eq("id", id)
      .maybeSingle(),
    getLocations(),
    getActiveCoaches(),
  ]);

  if (!member) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <BackLink href="/admin/members" label="Anggota" />
      <h1 className="text-2xl font-semibold">{member.full_name}</h1>
      <MemberEditForm member={member} locations={locations} coaches={coaches} />
    </div>
  );
}
