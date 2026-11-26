"use server";
import { isSoloPlan } from "@/lib/plans/policy";
import { randomBytes, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { billingStripe, billingOrigin } from "@/lib/ai-billing/stripe";
import { soloPrice } from "@/lib/plans/stripe";
import { completePrice } from "@/lib/billing/stripe";

async function account() {
  const viewer = await getViewer();
  if (!viewer || viewer.demo || !viewer.plan || (viewer.id !== viewer.plan.owner_user_id && viewer.role !== "platform_owner")) throw new Error("Only the account owner can manage this subscription.");
  const { stripe, account: stripeAccount, live } = await billingStripe();
  const plan = viewer.plan;
  if (plan.stripe_customer_id && (plan.stripe_account_id !== stripeAccount || plan.livemode !== live)) throw new Error("Subscription environment does not match this account.");
  return { viewer, plan, stripe, stripeAccount, live, db: createAdminClient() };
}
const safeError = (error: unknown) => error instanceof Error && !/key|token|secret|sql/i.test(error.message) ? error.message : "Subscription management is temporarily unavailable.";
export async function startSoloCheckout() {
  let destination: string;
  try {
    const { viewer, plan, stripe, stripeAccount, live, db } = await account();
    if (!isSoloPlan(plan.plan_key)) throw new Error("This account already has a different plan.");
    const price = await soloPrice(stripe, stripeAccount, live);
    let customer = plan.stripe_customer_id;
    if (!customer) {
      customer = (await stripe.customers.create({ email: viewer.email, name: viewer.organizationName }, { idempotencyKey: `sales-solo-customer:${viewer.organizationId}` })).id;
      const mapped = await db.from("account_subscription_plans").update({ stripe_customer_id: customer, stripe_account_id: stripeAccount, livemode: live }).eq("organization_id", viewer.organizationId).is("stripe_customer_id", null);
      if (mapped.error) throw new Error("Subscription ownership could not be saved.");
    }
    for await (const sub of stripe.subscriptions.list({ customer, status: "all", limit: 100 })) if (!["canceled", "incomplete_expired"].includes(sub.status)) throw new Error("A subscription already exists. Use Manage subscription.");
    if (plan.checkout_session_id && !["canceled", "incomplete_expired"].includes(plan.status)) {
      const existing = await stripe.checkout.sessions.retrieve(plan.checkout_session_id);
      if (existing.status === "open" && existing.url) redirect(existing.url);
      if (existing.status === "complete") throw new Error("Payment confirmation is pending. Refresh Billing shortly.");
    }
    const attempt = randomUUID();
    const expires = Math.floor(Date.now() / 1000) + 1800;
    const { data, error } = await db.from("account_subscription_plans").update({ checkout_attempt: attempt, checkout_expires_at: new Date(expires * 1000).toISOString() }).eq("organization_id", viewer.organizationId).or(`checkout_expires_at.is.null,checkout_expires_at.lt.${new Date().toISOString()}`).select("organization_id").maybeSingle();
    if (error || !data) throw new Error("Checkout is already being prepared. Try again shortly.");
    const suffix = Array.from(randomBytes(8), byte => String.fromCharCode(97 + byte % 26)).join("");
    const session = await stripe.checkout.sessions.create({ mode: "subscription", allow_promotion_codes: true, customer, line_items: [{ price: price.id, quantity: 1 }], expires_at: expires, success_url: `${billingOrigin()}/billing?checkout=returned`, cancel_url: `${billingOrigin()}/billing`, integration_identifier: `runfloor_solo_${suffix}` }, { idempotencyKey: `sales-solo-checkout:${viewer.organizationId}:${attempt}` });
    const saved = await db.from("account_subscription_plans").update({ checkout_session_id: session.id }).eq("organization_id", viewer.organizationId).eq("checkout_attempt", attempt);
    if (saved.error || !session.url) throw new Error("Checkout could not be saved.");
    destination = session.url;
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(`/billing?error=${encodeURIComponent(safeError(error))}`);
  }
  redirect(destination);
}
export async function manageSoloSubscription() {
  let destination: string;
  try {
    const { plan, stripe } = await account();
    if (!plan.stripe_customer_id) throw new Error("Activate your subscription first.");
    const id = process.env.STRIPE_SOLO_PORTAL_CONFIGURATION_ID;
    if (!id) throw new Error("Sales Solo subscription management is not activated yet.");
    const configuration = await stripe.billingPortal.configurations.retrieve(id);
    if (!configuration.active || !configuration.features.subscription_cancel.enabled || configuration.features.subscription_cancel.mode !== "at_period_end" || configuration.features.subscription_update.enabled) throw new Error("The subscription portal configuration requires review.");
    destination = (await stripe.billingPortal.sessions.create({ customer: plan.stripe_customer_id, return_url: `${billingOrigin()}/billing`, configuration: id })).url;
  } catch (error) { redirect(`/billing?error=${encodeURIComponent(safeError(error))}`); }
  redirect(destination);
}
export async function upgradeSolo() {
  try {
    const { viewer, plan, stripe, db } = await account();
    if (plan.plan_key !== "sales_solo" || !plan.stripe_subscription_id) throw new Error("An active Sales Solo subscription is required.");
    const { data: location } = await db.from("locations").select("id").eq("organization_id", viewer.organizationId).eq("is_active", true).limit(1).maybeSingle();
    if (!location) throw new Error("Ask the Platform Admin to set up your location before upgrading.");
    const price = await completePrice(stripe);
    const sub = await stripe.subscriptions.retrieve(plan.stripe_subscription_id);
    if (sub.items.data.length !== 1 || sub.status !== "active" || sub.pending_update) throw new Error("Resolve the pending subscription change first.");
    await stripe.subscriptions.update(sub.id, { items: [{ id: sub.items.data[0].id, price: price.id, quantity: 1 }], billing_cycle_anchor: { type: "now" }, proration_behavior: "always_invoice", payment_behavior: "pending_if_incomplete" }, { idempotencyKey: `solo-upgrade:${sub.id}:${sub.items.data[0].current_period_start}` });
  } catch (error) { redirect(`/billing?error=${encodeURIComponent(safeError(error))}`); }
  redirect("/billing?checkout=upgrade-pending");
}
