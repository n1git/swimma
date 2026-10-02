import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OnboardingStep {
  key: string;
  label: string;
}

export function Stepper({ steps, current }: { steps: OnboardingStep[]; current: string }) {
  const index = steps.findIndex((s) => s.key === current);
  return (
    <nav aria-label="Langkah penyiapan">
      <p className="mb-3 text-sm font-medium text-muted-foreground" aria-live="polite">
        Langkah {index + 1} dari {steps.length}
      </p>
      <ol className="flex flex-wrap gap-2">
        {steps.map((step, i) => {
          const done = i < index;
          const active = i === index;
          return (
            <li key={step.key}>
              <Link
                href={`/admin/onboarding?step=${step.key}`}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {done ? <Check className="size-4" aria-hidden /> : <span aria-hidden>{i + 1}</span>}
                {step.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
