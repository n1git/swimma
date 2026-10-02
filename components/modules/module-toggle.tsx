"use client";

import { setClubModule } from "@/lib/actions/modules";
import { ActionForm } from "@/components/shared/action-form";
import { Switch } from "@/components/ui/switch";

export function ModuleToggle({ code, name, enabled, locked }: { code: string; name: string; enabled: boolean; locked: boolean }) {
  return (
    <ActionForm action={setClubModule}>
      <input type="hidden" name="module" value={code} />
      <input type="hidden" name="enabled" value={(!enabled).toString()} />
      <Switch checked={enabled} label={`${name}: ${enabled ? "aktif" : "nonaktif"}`} disabled={locked} />
    </ActionForm>
  );
}
