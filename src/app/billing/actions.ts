"use server";
import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { canManageBilling, getLocationBilling } from "@/lib/billing/data";
import { stripeClient, billingOrigin, completePrice } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function authorizedLocation(form: FormData) {
  const viewer = await getViewer();
  if (!viewer || !canManageBilling(viewer)) throw new Error("Only dealership administrators can manage billing.");
  const row = (await getLocationBilling(viewer)).find(item => item.location_id === String(form.get("locationId") || ""));
  if (!row) throw new Error("Location not found.");
  return { viewer, row };
}
export async function selectBillingLocation(form: FormData) {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) redirect("/login");
  const id = String(form.get("locationId") || "");
  if (!(await getLocationBilling(viewer)).some(row => row.location_id === id)) throw new Error("Location access denied.");
  (await cookies()).set("rf-billing-location", id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
  redirect("/dashboard");
}
export async function startCheckout(form: FormData) {
  let destination: string;
  try {
    const { viewer, row } = await authorizedLocation(form);
    const stripe = await stripeClient();
    const price = await completePrice(stripe);
    const admin = createAdminClient();
    // One Stripe Customer per location makes ownership authoritative without trusting webhook metadata.
    let customer = row.stripe_customer_id;
    if (!customer) {
      customer = (await stripe.customers.create({ email: viewer.email, name: viewer.organizationName }, { idempotencyKey: `rv-customer:${row.location_id}` })).id;
      const { error } = await admin.from("rv_location_billing").update({ stripe_customer_id: customer }).eq("location_id", row.location_id).is("stripe_customer_id", null);
      if (error) throw error;
    }
    for await (const subscription of stripe.subscriptions.list({ customer, status: "all", limit: 100 })) {
      if (!["canceled", "incomplete_expired"].includes(subscription.status)) throw new Error("A subscription already exists. Use Manage Billing.");
    }
    // Reuse an open session; a DB compare-and-set prevents simultaneous checkout sessions.
    if (row.checkout_session_id) {
      const session = await stripe.checkout.sessions.retrieve(row.checkout_session_id);
      if (session.status === "open" && session.url) redirect(session.url);
      if (session.status === "complete") throw new Error("Your payment is being confirmed. Refresh Billing shortly.");
    }
    const attempt = randomUUID();
    const expires = Math.floor(Date.now() / 1000) + 1800;
    const { data: claim, error } = await admin.from("rv_location_billing").update({ checkout_attempt: attempt, checkout_expires_at: new Date(expires * 1000).toISOString() }).eq("location_id", row.location_id).or(`checkout_expires_at.is.null,checkout_expires_at.lt.${new Date().toISOString()}`).select("location_id").maybeSingle();
    if (error || !claim) throw new Error("Checkout is already being prepared. Refresh Billing shortly.");
    const origin = billingOrigin();
    const label = `runfloor_rv_${Array.from(randomBytes(8), byte => String.fromCharCode(97 + byte % 26)).join("")}`;
    const session = await stripe.checkout.sessions.create({ mode: "subscription", customer, line_items: [{ price: price.id, quantity: 1 }], expires_at: expires, success_url: `${origin}/billing?checkout=returned`, cancel_url: `${origin}/billing`, metadata: { application: "runfloor", billing_scope: "location" }, subscription_data: { metadata: { application: "runfloor", billing_scope: "location" } }, integration_identifier: label }, { idempotencyKey: `rv-checkout:${row.location_id}:${attempt}` });
    const saved = await admin.from("rv_location_billing").update({ checkout_session_id: session.id }).eq("location_id", row.location_id).eq("checkout_attempt", attempt);
    if (saved.error || !session.url) throw new Error("Checkout could not be saved. Please contact support.");
    destination = session.url;
  } catch (error) {
    // Redirect exceptions must pass through unchanged.
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(`/billing?error=${encodeURIComponent(error instanceof Error && !/key|token|secret|sql/i.test(error.message) ? error.message : "Billing is temporarily unavailable.")}`);
  }
  redirect(destination);
}
export async function openBillingPortal(form: FormData) {
  let destination: string;
  try {
    const { row } = await authorizedLocation(form);
    if (!row.stripe_customer_id) throw new Error("Activate your subscription first.");
    const stripe = await stripeClient();
    const configuration = process.env.STRIPE_RV_PORTAL_CONFIGURATION_ID;
    if (!configuration) throw new Error("A billing portal configuration is required.");
    const config = await stripe.billingPortal.configurations.retrieve(configuration);
    if (!config.active || !config.features.subscription_cancel.enabled || config.features.subscription_cancel.mode !== "at_period_end" || config.features.subscription_update.enabled) throw new Error("The billing portal must cancel at period end and disable plan or quantity changes.");
    const session = await stripe.billingPortal.sessions.create({ customer: row.stripe_customer_id, return_url: `${billingOrigin()}/billing`, configuration });
    destination = session.url;
  } catch { redirect("/billing?error=Billing%20management%20is%20temporarily%20unavailable."); }
  redirect(destination);
}
export async function saveOnboarding(form: FormData) {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) return;
  const id = String(form.get("locationId") || "");
  if (!(await getLocationBilling(viewer)).some(row => row.location_id === id)) throw new Error("Location access denied.");
  const allowed = ["profile", "assistant", "knowledge", "team", "operations"];
  const db = await createClient();
  const dismissed = form.get("dismissed") === "true";
  const { data: current } = dismissed ? await db.from("rv_onboarding_progress").select("completed").eq("location_id", id).eq("user_id", viewer.id).maybeSingle() : { data: null };
  const completed = dismissed && !form.has("completed") ? current?.completed ?? [] : form.getAll("completed").map(String).filter(value => allowed.includes(value));
  const { error } = await db.from("rv_onboarding_progress").upsert({ location_id: id, user_id: viewer.id, completed, dismissed });
  if (error) throw new Error("Your checklist could not be saved.");
  redirect("/billing");
}

export async function addPaidLocation(form: FormData) {
  const viewer = await getViewer();
  if (!viewer || !canManageBilling(viewer)) throw new Error("Only dealership administrators can add locations.");
  const { error } = await createAdminClient().rpc("add_rv_paid_location", { actor: viewer.id, target_org: viewer.organizationId, location_name: String(form.get("locationName") || "").trim() });
  if (error) redirect("/billing?error=The%20location%20could%20not%20be%20added.");
  redirect("/billing");
}
