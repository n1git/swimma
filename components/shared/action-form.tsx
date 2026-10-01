"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/actions/types";
import { useActionToast } from "@/components/shared/use-action-toast";

export function ActionForm({
  action,
  className,
  children,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, {});
  useActionToast(state, "Berhasil disimpan");
  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className={className}>
      {children}
    </form>
  );
}
