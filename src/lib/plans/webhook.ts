import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { soloPrice } from "./stripe";
import { completePrice } from "@/lib/billing/stripe";
const ref = (v: string | { id: string } | null | undefined) => typeof v === "string" ? v : v?.id;
const iso = (v: number) => new Date(v * 1000).toISOString();
export async function handleSoloEvent(event: Stripe.Event, stripe: Stripe, account: string, live: boolean) {
  let subscription: string | undefined;
  let invoice: Stripe.Invoice | undefined;
  if (event.type.startsWith("customer.subscription.")) subscription = (event.data.object as Stripe.Subscription).id;
  else if (["invoice.paid", "invoice.payment_failed"].includes(event.type)) {
    const source = event.data.object as Stripe.Invoice;
    subscription = ref(source.parent?.subscription_details?.subscription);
    if (event.type === "invoice.paid") invoice = await stripe.invoices.retrieve(source.id);
  } else if (event.type.startsWith("checkout.session.")) subscription = ref((event.data.object as Stripe.Checkout.Session).subscription);
  if (!subscription) return false;
  const sub = await stripe.subscriptions.retrieve(subscription);
  if (sub.livemode !== live) throw new Error("Wrong subscription mode");
  const customer = ref(sub.customer);
  if (!customer) return false;
  const db = createAdminClient();
  const { data: plan, error } = await db.from("account_subscription_plans").select("*").eq("stripe_customer_id", customer).maybeSingle();
  if (error) throw error;
  if (!plan) return false;
  if (plan.stripe_account_id !== account || plan.livemode !== live) throw new Error("Wrong Solo billing environment");
  const item = sub.items.data[0];
  if (!item || sub.items.data.length !== 1 || item.quantity !== 1) throw new Error("Sales Solo requires one subscription item and one licensed account");
  let targetPlan = "sales_solo";
  let price: Stripe.Price;
  try { price = await soloPrice(stripe, account, live); } catch (e) { if (plan.plan_key === "sales_solo") throw e; price = await completePrice(stripe); targetPlan = "complete"; }
  if (item.price.id !== price.id) { price = await completePrice(stripe); targetPlan = "complete"; }
  if (item.price.id !== price.id) throw new Error("Unapproved subscription price");
  // Only an independently retrieved paid latest invoice can grant a period.
  const paid = invoice?.status === "paid" && invoice.id === ref(sub.latest_invoice) &&
    ["subscription_create", "subscription_cycle", "subscription_update"].includes(invoice.billing_reason || "") &&
    invoice.currency === "usd" && ref(invoice.customer) === customer &&
    ref(invoice.parent?.subscription_details?.subscription) === sub.id &&
    (invoice.amount_paid >= (price.unit_amount ?? Number.MAX_SAFE_INTEGER) ||
      (targetPlan === "complete" && plan.plan_key === "sales_solo" && invoice.billing_reason === "subscription_update" && invoice.amount_paid > 0)) &&
    invoice.lines.data.some(line => line.pricing?.price_details?.price === price.id && line.period.start === item.current_period_start && line.period.end === item.current_period_end && line.amount >= (price.unit_amount ?? Number.MAX_SAFE_INTEGER));
  const result = await db.rpc("apply_sales_solo_event", {
    event_key: event.id, event_kind: event.type, event_created: event.created, target_org: plan.organization_id,
    customer_key: customer, account_key: account, live, subscription_key: sub.id, price_key: price.id,
    billing_status: sub.status, starts: iso(item.current_period_start), ends: iso(item.current_period_end),
    cancels: sub.cancel_at ? iso(sub.cancel_at) : sub.cancel_at_period_end ? iso(item.current_period_end) : null,
    paid_invoice: paid ? invoice!.id : null, target_plan: targetPlan,
  });
  if (result.error) throw result.error;
  return true;
}
