"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const DIALOG_CLASS =
  "hatch m-auto w-full max-w-lg rounded-[var(--radius-frame)] border border-border p-[3px] text-card-foreground shadow-lg backdrop:bg-black/50";

export function Dialog({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={() => router.back()}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className={cn(DIALOG_CLASS, className)}
    >
      <div className="max-h-[85vh] overflow-y-auto rounded-[var(--radius-inner)] border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </dialog>
  );
}

export function TriggerDialog({
  trigger,
  children,
  className,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <span onClick={() => ref.current?.showModal()}>{trigger}</span>
      <dialog
        ref={ref}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className={cn(DIALOG_CLASS, className)}
      >
        <div className="max-h-[85vh] overflow-y-auto rounded-[var(--radius-inner)] border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            aria-label="Tutup"
            onClick={() => ref.current?.close()}
            className="float-right text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
          {children}
        </div>
      </dialog>
    </>
  );
}
