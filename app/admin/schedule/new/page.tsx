import { getClassResourceOptions } from "@/lib/data/booking";
import { getActiveCoaches, getLocations, getClassTypes } from "@/lib/data/lookups";
import { BackLink } from "@/components/shared/back-link";
import { ClassForm } from "@/components/schedule/class-form";

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
      <h1 className="text-2xl font-semibold">Tambah Kelas</h1>
      <ClassForm coaches={coaches} locations={locations} classTypes={classTypes} resources={resources} />
    </div>
  );
}
