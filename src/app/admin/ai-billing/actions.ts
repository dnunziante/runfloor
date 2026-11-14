"use server";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
export async function updateAiBilling(form: FormData) {
  const viewer = await getViewer();
  if (!viewer || viewer.demo || viewer.role !== "platform_owner")
    redirect("/no-access");
  const action = String(form.get("action") ?? ""),
    org = String(form.get("organization") ?? ""),
    reason = String(form.get("reason") ?? "");
  let message = "Saved.";
  try {
    const amount = (name: string) => {
      const n = Number(form.get(name));
      if (!Number.isFinite(n)) throw new Error("Enter valid numeric values.");
      return n;
    };
    const units = (name: string, multiplier: number) => {
      const n = Math.round(amount(name) * multiplier);
      if (!Number.isSafeInteger(n)) throw new Error("Amount too large.");
      return n;
    };
    const enabled = form.get("enabled") === "on",
      record = String(form.get("record_id") ?? "");
    const parameters: Record<
      string,
      string | number | boolean | null | number[]
    > =
      action === "settings"
        ? {
            included_units: units("credits", 1000000),
            reset_day: amount("reset_day"),
            frozen: enabled,
            warn_at: String(form.get("warn_at") ?? "75,90")
              .split(",")
              .map((value) => Number(value.trim())),
          }
        : action === "adjustment"
          ? { units: units("credits", 1000000) }
          : action === "billing_admin"
            ? { user_id: record, enabled }
            : action === "pack"
              ? {
                  name: String(form.get("name") ?? ""),
                  credit_units: units("credits", 1000000),
                  price_cents: units("price", 100),
                  expires_days: form.get("expires_days")
                    ? amount("expires_days")
                    : null,
                }
              : action === "approve_pack"
                ? { id: record, active: enabled }
                : action === "rate"
                  ? {
                      model: String(form.get("model")),
                      version: String(form.get("version")),
                      input_units_per_million: units("input_price", 100000000),
                      cached_units_per_million: units(
                        "cached_price",
                        100000000,
                      ),
                      output_units_per_million: units(
                        "output_price",
                        100000000,
                      ),
                      source_url: String(form.get("source_url")),
                    }
                  : action === "subscription"
                    ? { price_id: record, enabled }
                    : {
                        id: record,
                        outcome: String(form.get("outcome")),
                        input: amount("input_tokens"),
                        cached: amount("cached_tokens"),
                        output: amount("output_tokens"),
                        reasoning: amount("reasoning_tokens"),
                        provider_id: String(form.get("provider_id") ?? ""),
                      };
    const db = await createClient();
    if (action === "reconcile") {
      if (reason.trim().length < 10)
        throw new Error("A reconciliation audit reason is required.");
      const { error } = await db.rpc("admin_reconcile_ai_usage", {
        request_id: parameters.id,
        outcome: parameters.outcome,
        usage_data: parameters,
        reason,
      });
      if (error) throw new Error("Reconciliation failed.");
    } else if (action === "subscription") {
      const { error } = await db.rpc("admin_approve_runfloor_plan", {
        price_id: parameters.price_id,
        enabled: parameters.enabled === true,
        reason,
      });
      if (error) throw new Error("Plan approval failed.");
    } else {
      const { error } = await db.rpc("admin_ai_billing", {
        action,
        target_org: org || null,
        parameters,
        reason,
      });
      if (error)
        throw new Error(
          "Billing update failed. Check the values and permissions.",
        );
    }
  } catch (e) {
    message = e instanceof Error ? e.message : "Update failed.";
  }
  revalidatePath("/admin/ai-billing");
  revalidatePath("/ai-usage");
  redirect(`/admin/ai-billing?message=${encodeURIComponent(message)}`);
}
