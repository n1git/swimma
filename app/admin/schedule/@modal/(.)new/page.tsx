import { getClassResourceOptions } from "@/lib/data/booking";
import { getActiveCoaches, getLocations, getClassTypes } from "@/lib/data/lookups";
import { Dialog } from "@/components/ui/dialog";
import { ClassForm } from "@/components/schedule/class-form";

export default async function NewClassModal() {
  const [coaches, locations, classTypes, resources] = await Promise.all([
    getActiveCoaches(),
    getLocations(),
    getClassTypes(),
    getClassResourceOptions(),
  ]);

  return (
    <Dialog>
      <h2 className="mb-4 text-xl font-semibold">Tambah Kelas</h2>
      <ClassForm coaches={coaches} locations={locations} classTypes={classTypes} resources={resources} />
    </Dialog>
  );
}
