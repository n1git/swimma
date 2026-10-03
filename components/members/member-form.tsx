"use client";

import { useActionState, useEffect, useState } from "react";
import { createMember, searchDuplicateMembers, type DuplicateMemberMatch } from "@/lib/actions/members";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useActionToast } from "@/components/shared/use-action-toast";
import { MemberFields } from "./member-fields";
import { MemberConsentFields } from "./member-consent-fields";
import type { Lookup } from "@/lib/data/lookups";

export function MemberForm({ locations, coaches }: { locations: Lookup[]; coaches: Lookup[] }) {
  const [state, formAction, pending] = useActionState(createMember, {});
  useActionToast(state, "Anggota berhasil ditambahkan");

  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [duplicates, setDuplicates] = useState<DuplicateMemberMatch[]>([]);

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (name.trim().length >= 2) {
        setDuplicates(await searchDuplicateMembers(name, dob));
      } else {
        setDuplicates([]);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [name, dob]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <MemberFields coaches={coaches} locations={locations} onNameChange={setName} onBirthDateChange={setDob} />
      <MemberConsentFields dateOfBirth={dob} />

      {duplicates.length > 0 ? (
        <Alert variant="warning">
          <AlertTitle>Kemungkinan data anggota sudah ada</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 flex flex-col gap-1">
              {duplicates.map((d) => (
                <li key={d.id}>
                  {d.full_name} — lahir {d.date_of_birth}
                  {d.contact_name ? ` — kontak ${d.contact_name}` : ""}
                </li>
              ))}
            </ul>
            <p className="mt-2">
              Periksa daftar di atas. Anda tetap bisa melanjutkan jika ini memang anggota yang berbeda (misalnya
              kembar).
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Menyimpan..." : "Simpan Anggota"}
      </Button>
    </form>
  );
}
