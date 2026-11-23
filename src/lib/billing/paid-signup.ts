import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { completePrice } from "@/lib/billing/stripe";

const ref = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : value?.id ?? null;

async function pendingIntent(id: string, customerId: string) {
  const { data, error } = await createAdminClient()
    .from("rv_paid_signup_intents")
    .select("id,owner_user_id,status,organization_id,stripe_customer_id")
    .eq("id", id)
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) throw new Error("Paid signup could not be verified");
  return data;
}

// Called only after the webhook route verifies Stripe's signature, account, and mode.
export async function handlePaidRvSignupEvent(event: Stripe.Event, stripe: Stripe): Promise<boolean> {
  const db = createAdminClient();
  let intentId: string | null = null;
  let customerId: string | null = null;
  let subscription: Stripe.Subscription | null = null;
  let invoice: Stripe.Invoice | null = null;

  if (event.type.startsWith("checkout.session.")) {
    const changed = event.data.object as Stripe.Checkout.Session;
    const session = await stripe.checkout.sessions.retrieve(changed.id);
    if (session.metadata?.application !== "runfloor" || !session.metadata.signup_intent_id) return false;
    intentId = session.metadata.signup_intent_id;
    customerId = ref(session.customer);
  } else if (event.type.startsWith("customer.subscription.")) {
    subscription = await stripe.subscriptions.retrieve((event.data.object as Stripe.Subscription).id);
    if (subscription.metadata.application !== "runfloor" || !subscription.metadata.signup_intent_id) return false;
    intentId = subscription.metadata.signup_intent_id;
    customerId = ref(subscription.customer);
  } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    invoice = await stripe.invoices.retrieve((event.data.object as Stripe.Invoice).id);
    const subscriptionId = ref(invoice.parent?.subscription_details?.subscription);
    if (!subscriptionId) return false;
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (subscription.metadata.application !== "runfloor" || !subscription.metadata.signup_intent_id) return false;
    intentId = subscription.metadata.signup_intent_id;
    customerId = ref(subscription.customer);
  } else {
    return false;
  }

  if (!intentId || !customerId) return false;
  const intent = await pendingIntent(intentId, customerId);
  // Once provisioned, the normal RV billing handler owns all later subscription events.
  if (!intent || intent.status !== "pending") return false;

  if (event.type !== "invoice.paid") return true;
  if (!invoice || !subscription) return true;

  const price = await completePrice(stripe);
  const item = subscription.items.data[0];
  if (
    subscription.metadata.signup_intent_id !== intent.id ||
    ref(subscription.latest_invoice) !== invoice.id ||
    invoice.status !== "paid" ||
    invoice.billing_reason !== "subscription_create" ||
    invoice.currency !== "usd" ||
    invoice.amount_paid < 9900 ||
    subscription.status !== "active" ||
    !item ||
    subscription.items.data.length !== 1 ||
    item.quantity !== 1 ||
    item.price.id !== price.id
  ) throw new Error("Paid signup does not match the approved RunFloor plan.");

  const { error } = await db.rpc("provision_rv_paid_signup", {
    intent_key: intent.id,
    event_key: event.id,
    event_created: event.created,
    customer_key: customerId,
    subscription_key: subscription.id,
    price_key: item.price.id,
    period_starts: new Date(item.current_period_start * 1000).toISOString(),
    period_ends: new Date(item.current_period_end * 1000).toISOString(),
  });
  if (error) throw new Error("Paid workspace provisioning failed");
  return true;
}
