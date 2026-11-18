import "server-only";
import { createHash } from "node:crypto";
const integrationIdentifier = (id: string) =>
  "runfloor_" +
  Array.from(createHash("sha256").update(id).digest().subarray(0, 8), (byte) =>
    String.fromCharCode(97 + (byte % 26)),
  ).join("");
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { billingStripe, billingOrigin } from "./stripe";
export async function createCreditCheckout(
  kind: "credits" | "subscription",
  packId: string,
  requestId: string,
) {
  if (!/^[0-9a-f-]{36}$/i.test(requestId))
    throw new Error("Invalid purchase request.");
  const viewer = await getViewer();
  if (!viewer || viewer.demo) throw new Error("Sign in to manage billing.");
  if (viewer.plan?.plan_key === "sales_solo") throw new Error("Sales Solo has a fixed monthly AI cost allowance. Credit purchases are not available.");
  const userDb = await createClient();
  const { data: summary, error: accessError } = await userDb.rpc(
    "get_ai_credit_summary",
    { target_org: viewer.organizationId },
  );
  if (accessError || !summary?.can_manage)
    throw new Error("A billing administrator must make this purchase.");
  const { stripe, account, live } = await billingStripe();
  const admin = createAdminClient();
  const origin = billingOrigin();
  let { data: customer } = await admin
    .from("runfloor_billing_customers")
    .select("*")
    .eq("organization_id", viewer.organizationId)
    .maybeSingle();
  if (
    customer &&
    (customer.stripe_account_id !== account || customer.livemode !== live)
  )
    throw new Error("Billing environment does not match this company.");
  if (!customer) {
    const created = await stripe.customers.create(
      {
        name: viewer.organizationName,
        metadata: {
          runfloor_organization: viewer.organizationId,
          application: "runfloor",
        },
      },
      {
        idempotencyKey: `runfloor:customer:${account}:${live}:${viewer.organizationId}`,
      },
    );
    const { data, error } = await admin
      .from("runfloor_billing_customers")
      .upsert(
        {
          organization_id: viewer.organizationId,
          stripe_customer_id: created.id,
          stripe_account_id: account,
          livemode: live,
        },
        { onConflict: "organization_id" },
      )
      .select("*")
      .single();
    if (error || !data) throw new Error("Unable to save billing customer.");
    customer = data;
  }
  if (kind === "subscription") {
    const { data: catalog } = await admin
      .from("runfloor_billing_catalog")
      .select("*")
      .eq("id", true)
      .single();
    if (!catalog?.active || !catalog.stripe_price_id)
      throw new Error("The subscription plan is not activated yet.");
    const { count, error } = await userDb
      .from("locations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", viewer.organizationId)
      .eq("is_active", true);
    if (error || count === null || count > 1)
      throw new Error(
        "This plan supports one active location. Review locations before subscribing.",
      );
    const existing = await stripe.subscriptions.list({
      customer: customer.stripe_customer_id,
      status: "all",
      limit: 100,
    });
    if (
      existing.data.some(
        (s) => !["canceled", "incomplete_expired"].includes(s.status),
      )
    )
      throw new Error(
        "This company already has a subscription or a pending subscription.",
      );
    const price = await stripe.prices.retrieve(catalog.stripe_price_id);
    if (
      price.unit_amount !== 9900 ||
      price.currency !== "usd" ||
      price.recurring?.interval !== "month" ||
      price.recurring.interval_count !== 1
    )
      throw new Error(
        "The configured plan price does not match the approved $99 monthly plan.",
      );
    let { data: slot, error: slotError } = await admin.rpc(
      "claim_runfloor_subscription_checkout",
      { org: viewer.organizationId, request_id: requestId },
    );
    if (slotError || !slot)
      throw new Error("Subscription checkout is unavailable.");
    if (slot.session_id) {
      const pending = await stripe.checkout.sessions.retrieve(slot.session_id);
      if (pending.status === "open" && pending.url) return pending.url;
      const linked =
        typeof pending.subscription === "string"
          ? pending.subscription
          : pending.subscription?.id;
      if (
        linked &&
        !["canceled", "incomplete_expired"].includes(
          (await stripe.subscriptions.retrieve(linked)).status,
        )
      )
        throw new Error("This subscription is already being processed.");
      if (!["complete", "expired"].includes(pending.status ?? ""))
        throw new Error("Checkout needs review before retrying.");
      const { error: releaseError } = await admin.rpc(
        "release_runfloor_subscription_checkout",
        {
          org: viewer.organizationId,
          expected_request: slot.request_id,
          expected_session: slot.session_id,
        },
      );
      if (releaseError) throw new Error("Checkout recovery is unavailable.");
      ({ data: slot, error: slotError } = await admin.rpc(
        "claim_runfloor_subscription_checkout",
        { org: viewer.organizationId, request_id: requestId },
      ));
      if (slotError || !slot)
        throw new Error("Checkout recovery is unavailable.");
      if (slot.session_id) {
        const recovered = await stripe.checkout.sessions.retrieve(
          slot.session_id,
        );
        if (recovered.status === "open" && recovered.url) return recovered.url;
        throw new Error("Checkout changed. Refresh usage before retrying.");
      }
    }
    if (Date.now() - Date.parse(slot.created_at) > 23 * 60 * 60 * 1000)
      throw new Error(
        "An unconfirmed checkout needs administrator review before another payment attempt.",
      );
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        integration_identifier: integrationIdentifier(slot.request_id),
        customer: customer.stripe_customer_id,
        line_items: [{ price: price.id, quantity: 1 }],
        client_reference_id: viewer.organizationId,
        metadata: {
          application: "runfloor",
          organization_id: viewer.organizationId,
        },
        subscription_data: {
          metadata: {
            application: "runfloor",
            organization_id: viewer.organizationId,
          },
        },
        success_url: `${origin}/ai-usage?payment=pending`,
        cancel_url: `${origin}/ai-usage?payment=canceled`,
      },
      {
        idempotencyKey: `runfloor:subscription:${viewer.organizationId}:${slot.request_id}`,
      },
    );
    const { error: save } = await admin
      .from("runfloor_subscription_checkouts")
      .update({
        session_id: session.id,
        expires_at: new Date(session.expires_at * 1000).toISOString(),
      })
      .eq("organization_id", viewer.organizationId);
    if (save || !session.url)
      throw new Error(
        "Checkout could not be saved. Retry to recover the same checkout.",
      );
    return session.url;
  }
  const { data: pack } = await admin
    .from("ai_credit_packs")
    .select("*")
    .eq("id", packId)
    .eq("active", true)
    .not("approved_by", "is", null)
    .maybeSingle();
  if (!pack) throw new Error("This credit pack is not available.");
  const { error: insertError } = await admin.from("ai_credit_orders").upsert(
    {
      id: requestId,
      organization_id: viewer.organizationId,
      user_id: viewer.id,
      pack_id: pack.id,
      credit_units: pack.credit_units,
      price_cents: pack.price_cents,
      currency: pack.currency,
      expires_days: pack.expires_days,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (insertError) throw new Error("Unable to create credit order.");
  const { data: order } = await admin
    .from("ai_credit_orders")
    .select("*")
    .eq("id", requestId)
    .eq("organization_id", viewer.organizationId)
    .eq("user_id", viewer.id)
    .single();
  if (!order || order.pack_id !== pack.id || order.status !== "pending")
    throw new Error(
      "This purchase has already been processed or does not match.",
    );
  if (order.stripe_session_id) {
    const pending = await stripe.checkout.sessions.retrieve(
      order.stripe_session_id,
    );
    if (pending.status === "open" && pending.url) return pending.url;
    throw new Error(
      "This checkout is complete or expired. Refresh usage to start a new purchase.",
    );
  }
  if (Date.now() - Date.parse(order.created_at) > 23 * 60 * 60 * 1000)
    throw new Error("An unconfirmed payment needs administrator review.");
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_intent_data: {
        metadata: {
          application: "runfloor",
          order_id: order.id,
          organization_id: viewer.organizationId,
        },
      },
      integration_identifier: integrationIdentifier(requestId),
      customer: customer.stripe_customer_id,
      line_items: [
        {
          price_data: {
            currency: order.currency,
            unit_amount: order.price_cents,
            product_data: {
              name: `RunFloor ${pack.name}`,
              metadata: { application: "runfloor" },
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        application: "runfloor",
        order_id: order.id,
        organization_id: viewer.organizationId,
      },
      success_url: `${origin}/ai-usage?payment=pending`,
      cancel_url: `${origin}/ai-usage?payment=canceled`,
    },
    { idempotencyKey: `runfloor:credits:${account}:${requestId}` },
  );
  const { error: saveError } = await admin
    .from("ai_credit_orders")
    .update({ stripe_session_id: session.id })
    .eq("id", order.id)
    .eq("organization_id", viewer.organizationId);
  if (saveError || !session.url)
    throw new Error("Unable to save checkout. Please retry this purchase.");
  return session.url;
}
