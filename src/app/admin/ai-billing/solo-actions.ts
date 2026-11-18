"use server";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
export async function overrideSoloPlan(form: FormData) {
  const viewer = await getViewer();
  if (!viewer || viewer.demo || viewer.role !== "platform_owner") redirect("/no-access");
  const organization = String(form.get("organizationId"));
  const seats = Number(form.get("seats")); const units = Math.round(Number(form.get("cost")) * 100000000);
  const until = String(form.get("until") || "");
  if (!/^[0-9a-f-]{36}$/i.test(organization) || !Number.isSafeInteger(seats) || seats < 1 || seats > 10000 || !Number.isSafeInteger(units) || units < 0 || units > 100000000000 || (until && !Number.isFinite(Date.parse(`${until}Z`)))) redirect("/admin/ai-billing?message=Invalid+override");
  const db = await createClient();
  const { error } = await db.rpc("override_sales_solo", { target_org: organization, new_seat_limit: seats, new_ai_limit: units, override_until: until ? new Date(`${until}Z`).toISOString() : null, reason: String(form.get("reason") || "").trim() });
  revalidatePath("/admin/ai-billing"); revalidatePath("/billing");
  redirect(`/admin/ai-billing?message=${error ? "Override+could+not+be+saved.+Check+limits+and+reason." : "Audited+Sales+Solo+override+saved."}`);
}
