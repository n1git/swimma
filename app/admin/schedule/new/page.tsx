import { getClassResourceOptions } from "@/lib/data/booking";
import { getActiveCoaches, getLocations, getClassTypes } from "@/lib/data/lookups";
import { BackLink } from "@/components/shared/back-link";
import { ClassForm } from "@/components/schedule/class-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function NewClassPage() {
  const [coaches, locations, classTypes, resources] = await Promise.all([
    getActiveCoaches(),
    getLocations(),
    getClassTypes(),
    getClassResourceOptions(),
  ]);

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <BackLink href="/admin/schedule" label="Jadwal Kelas" />
      <PageHeader title={<>Tambah Kelas</>} />
      <ClassForm coaches={coaches} locations={locations} classTypes={classTypes} resources={resources} />
    </div>
  );
}
