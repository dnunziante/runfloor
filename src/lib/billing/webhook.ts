import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { completePrice } from "./stripe";
import { handlePaidRvSignupEvent } from "./paid-signup";
const ref = (value: string | { id: string } | null | undefined) => typeof value === "string" ? value : value?.id;
const iso = (value: number | null | undefined) => value ? new Date(value * 1000).toISOString() : null;

// Called only after the existing webhook verifies signature, Stripe account, and mode.
// Return false for legacy customers so their established handler remains authoritative.
export async function handleRvBillingEvent(event: Stripe.Event, stripe: Stripe): Promise<boolean> {
  if (await handlePaidRvSignupEvent(event, stripe)) return true;
  const db = createAdminClient();
  if (["charge.dispute.created", "charge.refunded", "radar.early_fraud_warning.created"].includes(event.type)) {
    const object = event.data.object as Stripe.Charge | Stripe.Dispute | Stripe.Radar.EarlyFraudWarning;
    const charge = object.object === "charge" ? object : await stripe.charges.retrieve(ref(object.charge)!);
    const customer = ref(charge.customer);
    if (!customer) return false;
    const { data: row, error } = await db.from("rv_location_billing").select("organization_id").eq("stripe_customer_id",customer).maybeSingle();
    if (error) throw error;
    if (!row) return false;
    const flag = await db.from("rv_location_billing").update({ risk_review_required: true }).eq("stripe_customer_id",customer);
    if (flag.error) throw flag.error;
    const freeze = await db.from("ai_billing_settings").update({ frozen: true }).eq("organization_id",row.organization_id);
    if (freeze.error) throw freeze.error;
    const audit = await db.from("runfloor_billing_events").upsert({ id:event.id,event_type:event.type },{onConflict:"id",ignoreDuplicates:true});
    if (audit.error) throw audit.error;
    return true;
  }
  let subscriptionId: string | undefined;
  let invoice: Stripe.Invoice | undefined;
  if (event.type.startsWith("customer.subscription.")) subscriptionId = (event.data.object as Stripe.Subscription).id;
  else if (["invoice.paid","invoice.payment_failed"].includes(event.type)) {
    const source = event.data.object as Stripe.Invoice;
    subscriptionId = ref(source.parent?.subscription_details?.subscription);
    if (event.type === "invoice.paid") invoice = await stripe.invoices.retrieve(source.id);
  } else if (event.type.startsWith("checkout.session.")) subscriptionId = ref((event.data.object as Stripe.Checkout.Session).subscription);
  if (!subscriptionId) return false;
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const customer = ref(sub.customer);
  if (!customer) return false;
  const { data: row, error } = await db.from("rv_location_billing").select("location_id").eq("stripe_customer_id",customer).maybeSingle();
  if (error) throw error;
  if (!row) return false;
  const price = await completePrice(stripe);
  const item = sub.items.data[0];
  if (!item || sub.items.data.length !== 1 || item.quantity !== 1 || item.price.id !== price.id) throw new Error("Wrong RV subscription plan.");
  const paid = !!invoice && invoice.status === "paid" && invoice.id === ref(sub.latest_invoice) && ["subscription_create","subscription_cycle"].includes(invoice.billing_reason || "") && invoice.currency === "usd" && invoice.amount_paid >= 9900;
  const result = await db.rpc("apply_rv_stripe_event",{event_key:event.id,event_kind:event.type,event_created:event.created,customer_key:customer,subscription_key:sub.id,price_key:price.id,billing_status:sub.status === "incomplete_expired" ? "expired" : sub.status,starts:iso(item.current_period_start),ends:iso(item.current_period_end),cancels:iso(sub.cancel_at || (sub.cancel_at_period_end ? item.current_period_end : null)),paid_period:paid});
  if (result.error) throw result.error;
  return true;
}
