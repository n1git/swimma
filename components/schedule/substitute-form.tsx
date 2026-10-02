import { setClassSubstitute } from "@/lib/actions/schedule";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Select } from "@/components/ui/select";
import type { Lookup } from "@/lib/data/lookups";

export function SubstituteForm({
  classId,
  instructorId,
  substituteId,
  coaches,
}: {
  classId: string;
  instructorId: string;
  substituteId: string | null;
  coaches: Lookup[];
}) {
  return (
    <ActionForm action={setClassSubstitute} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="classId" value={classId} />
      <Select name="substituteId" defaultValue={substituteId ?? ""} aria-label="Pelatih pengganti" className="w-48">
        <option value="">Tanpa pengganti</option>
        {coaches
          .filter((c) => c.id !== instructorId)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </Select>
      <ActionSubmitButton size="sm" variant="outline">
        Simpan Pengganti
      </ActionSubmitButton>
    </ActionForm>
  );
}
