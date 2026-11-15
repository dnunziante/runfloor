import { handleRvBillingEvent } from "@/lib/billing/webhook";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { billingStripe } from "@/lib/ai-billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
const ref = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : (value?.id ?? null);
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature"),
    secret = process.env.RUNFLOOR_STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret)
    return NextResponse.json(
      { error: "Webhook not configured." },
      { status: 400 },
    );
  let event: Stripe.Event;
  let payment: Awaited<ReturnType<typeof billingStripe>>;
  try {
    payment = await billingStripe();
    event = payment.stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook signature or billing environment." },
      { status: 400 },
    );
  }
  if (
    event.livemode !== payment.live ||
    (event.account && event.account !== payment.account)
  )
    return NextResponse.json(
      { error: "Wrong billing environment." },
      { status: 400 },
    );
  const { stripe, account, live } = payment,
    db = createAdminClient();
  const apply = async (parameters: Record<string, unknown>) => {
    const { error } = await db.rpc("apply_ai_credit_payment", {
      event_id: event.id,
      account_id: account,
      live,
      refund_cents: 0,
      is_disputed: false,
      ...parameters,
    });
    if (error) throw new Error("Payment accounting failed");
  };
  const reversalForCharge = async (charge: Stripe.Charge) => {
    let disputed = charge.disputed;
    if (disputed) {
      const disputes = await stripe.disputes.list({
        charge: charge.id,
        limit: 100,
      });
      disputed = disputes.data.some(
        (d) => !["won", "warning_closed"].includes(d.status),
      );
    }
    return { refund_cents: charge.amount_refunded, is_disputed: disputed };
  };
  const paymentReversal = async (id: string | null) => {
    if (!id) throw new Error("Payment intent is missing");
    const intent = await stripe.paymentIntents.retrieve(id);
    const chargeId = ref(intent.latest_charge);
    if (!chargeId) throw new Error("Confirmed charge is missing");
    return reversalForCharge(await stripe.charges.retrieve(chargeId));
  };
  const syncSubscription = async (id: string) => {
    const sub = await stripe.subscriptions.retrieve(id);
    if (sub.metadata.application !== "runfloor") return;
    const customerId = ref(sub.customer);
    const { data: customer } = await db
      .from("runfloor_billing_customers")
      .select("organization_id")
      .eq("stripe_customer_id", customerId)
      .eq("stripe_account_id", account)
      .eq("livemode", live)
      .maybeSingle();
    if (!customer) throw new Error("Unknown customer");
    const item = sub.items.data[0];
    if (!item || sub.items.data.length !== 1 || item.quantity !== 1)
      throw new Error("Wrong plan");
    const { error } = await db.rpc("apply_runfloor_subscription", {
      event_id: event.id,
      target_org: customer.organization_id,
      customer_id: customerId,
      subscription: sub.id,
      sub_status: sub.status,
      start_at: new Date(item.current_period_start * 1000).toISOString(),
      end_at: new Date(item.current_period_end * 1000).toISOString(),
      price_id: item.price.id,
      account_id: account,
      live,
    });
    if (error) throw new Error("Subscription accounting failed");
    const invoice = ref(sub.latest_invoice);
    if (invoice) {
      const payments = await stripe.invoicePayments.list({
        invoice,
        limit: 100,
      });
      for (const item of payments.data) {
        if (item.status !== "paid") continue;
        const pi = ref(item.payment.payment_intent);
        const chargeId = ref(item.payment.charge);
        const reversal = pi
          ? await paymentReversal(pi)
          : chargeId
            ? await reversalForCharge(await stripe.charges.retrieve(chargeId))
            : null;
        if (reversal && (reversal.refund_cents > 0 || reversal.is_disputed)) {
          const { error: reviewError } = await db.rpc(
            "review_runfloor_subscription_payment",
            {
              event_id: event.id + ":payment-review",
              customer_id: customerId,
              account_id: account,
              live,
            },
          );
          if (reviewError)
            throw new Error("Subscription reversal review failed");
        }
      }
    }
  };
  try {
    if (process.env.RUNFLOOR_RV_BILLING_ENABLED === "true" && await handleRvBillingEvent(event, stripe)) return NextResponse.json({ received: true });
    if (event.type.startsWith("checkout.session.")) {
      const changed = event.data.object as Stripe.Checkout.Session;
      const session = await stripe.checkout.sessions.retrieve(changed.id);
      if (session.metadata?.application !== "runfloor")
        return NextResponse.json({ received: true });
      if (session.mode === "subscription") {
        const subscription = ref(session.subscription);
        if (subscription) await syncSubscription(subscription);
      } else if (session.metadata.order_id) {
        const { data: order } = await db
          .from("ai_credit_orders")
          .select("id,organization_id")
          .eq("id", session.metadata.order_id)
          .eq("stripe_session_id", session.id)
          .maybeSingle();
        if (!order) throw new Error("Unknown order");
        const { data: customer } = await db
          .from("runfloor_billing_customers")
          .select("stripe_customer_id")
          .eq("organization_id", order.organization_id)
          .single();
        if (ref(session.customer) !== customer?.stripe_customer_id)
          throw new Error("Wrong customer");
        if (
          [
            "checkout.session.completed",
            "checkout.session.async_payment_succeeded",
          ].includes(event.type) &&
          session.payment_status === "paid"
        )
          await apply({
            ...(await paymentReversal(ref(session.payment_intent))),
            event_kind: "paid",
            order_id: order.id,
            session_id: session.id,
            payment_id: ref(session.payment_intent),
            paid_cents: session.amount_total,
            paid_currency: session.currency,
          });
        else if (
          [
            "checkout.session.async_payment_failed",
            "checkout.session.expired",
          ].includes(event.type)
        )
          await apply({
            event_kind: "failed",
            order_id: order.id,
            session_id: session.id,
            payment_id: null,
            paid_cents: 0,
            paid_currency: session.currency,
          });
      }
    } else if (event.type.startsWith("customer.subscription."))
      await syncSubscription((event.data.object as Stripe.Subscription).id);
    else if (["invoice.paid", "invoice.payment_failed"].includes(event.type)) {
      const invoice = event.data.object as Stripe.Invoice;
      const subscription = ref(
        invoice.parent?.subscription_details?.subscription,
      );
      if (subscription) await syncSubscription(subscription);
    } else if (
      event.type === "charge.refunded" ||
      event.type.startsWith("charge.dispute.")
    ) {
      let charge: Stripe.Charge;
      let disputed = false;
      if (event.type.startsWith("charge.dispute.")) {
        const dispute = await stripe.disputes.retrieve(
          (event.data.object as Stripe.Dispute).id,
        );
        charge = await stripe.charges.retrieve(ref(dispute.charge)!);
        disputed = !["won", "warning_closed"].includes(dispute.status);
      } else
        charge = await stripe.charges.retrieve(
          (event.data.object as Stripe.Charge).id,
        );
      const { data: order } = await db
        .from("ai_credit_orders")
        .select("id")
        .eq("payment_intent_id", ref(charge.payment_intent))
        .maybeSingle();
      if (!order && (charge.amount_refunded > 0 || disputed)) {
        const { error } = await db.rpc("review_runfloor_subscription_payment", {
          event_id: event.id,
          customer_id: ref(charge.customer),
          account_id: account,
          live,
        });
        if (error) throw new Error("Subscription payment review failed");
      }
      if (order)
        await apply({
          event_kind: event.type === "charge.refunded" ? "refund" : "dispute",
          order_id: order.id,
          session_id: null,
          payment_id: ref(charge.payment_intent),
          paid_cents: 0,
          paid_currency: charge.currency,
          refund_cents: charge.amount_refunded,
          is_disputed: disputed,
        });
    }
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: "Billing event could not be applied. Retry required." },
      { status: 500 },
    );
  }
}
