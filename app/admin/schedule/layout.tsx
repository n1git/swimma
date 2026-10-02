import { requireModule } from "@/lib/modules";

export default async function ScheduleLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  await requireModule("classes");
  return (
    <>
      {children}
      {modal}
    </>
  );
}
