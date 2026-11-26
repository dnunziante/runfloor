"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { billingOrigin, billingStripe } from "@/lib/ai-billing/stripe";
import { soloPrice } from "@/lib/plans/stripe";

const validName = (value: string) => value.length >= 2 && value.length <= 120;
const identity = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const validEmail = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validPhone = (value: string) => !value || (value.length <= 40 && /^[+\d\s().xet#-]+$/i.test(value) && (value.match(/\d/g)?.length ?? 0) >= 7);

export async function startPaidSoloSignupCheckout(form: FormData) {
  try {
    if (process.env.RUNFLOOR_SALES_SOLO_ENABLED !== "true") throw new Error("RunFloor Solo checkout is temporarily unavailable.");
    const company = String(form.get("dealership") || "").trim();
    const contact = String(form.get("fullName") || "").trim();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const phone = String(form.get("phone") || "").trim();
    const nameKey = identity(company);
    if (!validName(company) || !validName(contact) || !validEmail(email) || !validPhone(phone) || nameKey.length < 2) {
      throw new Error("Enter a valid workspace name, contact name, email, and phone number.");
    }

    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    if (user && user.email?.toLowerCase() !== email) throw new Error("Use the same email address as your signed-in RunFloor account.");
    if (user && !user.email_confirmed_at) throw new Error("Verify your account email before continuing.");
    if (user) {
      const { data: memberships, error: membershipError } = await auth.from("organization_memberships").select("id").eq("user_id", user.id).in("status", ["active", "invited"]).limit(1);
      if (membershipError) throw new Error("Workspace access could not be verified.");
      if (memberships?.length) throw new Error("This account already belongs to a workspace. Sign in or ask its administrator for access.");
    }

    const admin = createAdminClient();
    const { data: organizations, error: orgError } = await admin.from("organizations").select("name").limit(1000);
    if (orgError) throw new Error("Workspace name availability could not be verified.");
    if ((organizations ?? []).some(row => identity(row.name) === nameKey)) throw new Error("That workspace name is already in use. Choose another name.");

    const { stripe, account, live } = await billingStripe();
    const price = await soloPrice(stripe, account, live);
    const { data: loadedIntent, error: intentError } = await admin.from("sales_solo_signup_intents")
      .select("id,owner_user_id,signup_email,stripe_customer_id,checkout_session_id,status")
      .eq("signup_email", email).eq("status", "pending").maybeSingle();
    if (intentError) throw new Error("Solo checkout could not be loaded.");
    let intent = loadedIntent;
    if (intent && intent.owner_user_id && user && intent.owner_user_id !== user.id) throw new Error("This Solo checkout is already linked to another account.");
    if (intent?.checkout_session_id) {
      const previous = await stripe.checkout.sessions.retrieve(intent.checkout_session_id);
      if (previous.status === "open" && previous.url) redirect(previous.url);
      if (previous.status === "complete") redirect(`/signup/solo-complete?intent=${intent.id}&session_id=${previous.id}`);
      if (previous.status === "expired") {
        await admin.from("sales_solo_signup_intents").update({ status: "expired" }).eq("id", intent.id).eq("status", "pending");
        intent = null;
      }
    }

    const customer = intent?.stripe_customer_id ?? (await stripe.customers.create(
      { email, name: contact, metadata: { application: "runfloor", sales_solo_signup_email: email } },
      { idempotencyKey: `sales-solo-signup-customer:${email}` },
    )).id;
    if (!intent) {
      const { data, error } = await admin.from("sales_solo_signup_intents").insert({
        owner_user_id: user?.id ?? null, signup_email: email, workspace_name: company,
        workspace_identity: nameKey, contact_name: contact, phone: phone || null,
        stripe_customer_id: customer, stripe_account_id: account, livemode: live,
      }).select("id,owner_user_id,signup_email,stripe_customer_id,checkout_session_id,status").single();
      if (error || !data) throw new Error("Solo checkout could not be started. Refresh and try again.");
      intent = data;
    } else {
      const { error } = await admin.from("sales_solo_signup_intents").update({
        owner_user_id: intent.owner_user_id ?? user?.id ?? null, workspace_name: company,
        workspace_identity: nameKey, contact_name: contact, phone: phone || null,
        stripe_account_id: account, livemode: live,
      }).eq("id", intent.id).eq("status", "pending");
      if (error) throw new Error("Solo signup details could not be saved.");
    }
    const origin = billingOrigin();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      allow_promotion_codes: true,
      customer,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${origin}/signup/solo-complete?intent=${intent.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/signup/solo-complete?intent=${intent.id}&cancelled=1`,
      metadata: { application: "runfloor", billing_scope: "sales_solo", sales_solo_signup_intent_id: intent.id },
      subscription_data: { metadata: { application: "runfloor", billing_scope: "sales_solo", sales_solo_signup_intent_id: intent.id } },
    }, { idempotencyKey: `sales-solo-signup-checkout:${intent.id}:${randomUUID()}` });
    const { error: saveError } = await admin.from("sales_solo_signup_intents").update({ checkout_session_id: session.id }).eq("id", intent.id).eq("status", "pending");
    if (saveError || !session.url) throw new Error("Stripe Checkout could not be saved. Please try again.");
    redirect(session.url);
  } catch (error) {
    if (error instanceof Error && (error.message === "NEXT_REDIRECT" || error.message.startsWith("NEXT_REDIRECT;"))) throw error;
    const message = error instanceof Error && !/key|token|secret|sql/i.test(error.message) ? error.message : "Billing is temporarily unavailable.";
    redirect(`/signup?plan=solo&error=${encodeURIComponent(message)}`);
  }
}
