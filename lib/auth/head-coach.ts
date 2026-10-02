import { redirect } from "next/navigation";
import { requireRole } from "./guard";

export async function requireHeadCoach() {
  const user = await requireRole("coach");
  if (!user.isHeadCoach) redirect("/coach");
  return user;
}
