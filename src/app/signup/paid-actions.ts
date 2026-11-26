"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { billingOrigin, completePrice, stripeClient } from "@/lib/billing/stripe";

const validName = (value: string) => value.length >= 2 && value.length <= 120;
const validPhone = (value: string) => !value || (value.length <= 40 && /^[+\d\s().xet#-]+$/i.test(value) && (value.match(/\d/g)?.length ?? 0) >= 7);
const dealershipIdentity = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function startPaidSignupCheckout(form: FormData) {
  try {
    if (process.env.RUNFLOOR_RV_BILLING_ENABLED !== "true") throw new Error("Paid signup is temporarily unavailable.");
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user || !user.email_confirmed_at || !user.email) throw new Error("Verify your email and sign in before checkout.");
    const dealership = String(form.get("dealership") || "").trim();
    const contact = String(form.get("fullName") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const identity = dealershipIdentity(dealership);
    if (!validName(dealership) || !validName(contact) || !validPhone(phone) || identity.length < 2) throw new Error("Enter a valid dealership name, contact name, and phone number.");

    const { data: membership, error: membershipError } = await auth.from("organization_memberships").select("id").eq("user_id", user.id).in("status", ["active", "invited"]).limit(1);
    if (membershipError) throw new Error("Workspace access could not be verified.");
    if (membership?.length) throw new Error("This account already belongs to a workspace. Use Billing to upgrade it.");

    const admin = createAdminClient();
    const { data: claims, error: claimsError } = await admin.from("rv_trial_claims").select("organization_id").eq("dealership_identity", identity).maybeSingle();
    const { data: organizations, error: organizationsError } = await admin.from("organizations").select("name").limit(500);
    if (claimsError || organizationsError) throw new Error("Dealership availability could not be verified.");
    if (claims || (organizations ?? []).some(row => dealershipIdentity(row.name) === identity)) throw new Error("This dealership already exists. Ask its administrator for an invitation.");

    const stripe = await stripeClient();
    const price = await completePrice(stripe);
    const { data: loadedIntent, error: intentError } = await admin.from("rv_paid_signup_intents").select("id,stripe_customer_id,checkout_session_id,status").eq("owner_user_id", user.id).eq("status", "pending").maybeSingle();
    if (intentError) throw new Error("Paid signup could not be loaded.");
    let intent = loadedIntent;
    if (intent?.checkout_session_id) {
      const previous = await stripe.checkout.sessions.retrieve(intent.checkout_session_id);
      if (previous.status === "open" && previous.url) redirect(previous.url);
      if (previous.status === "complete") redirect(`/signup/complete?intent=${intent.id}`);
      if (previous.status === "expired") {
        await admin.from("rv_paid_signup_intents").update({ status: "expired" }).eq("id", intent.id).eq("status", "pending");
        intent = null;
      }
    }

    const customer = intent?.stripe_customer_id ?? (await stripe.customers.create(
      { email: user.email, name: contact, metadata: { application: "runfloor", paid_signup_user: user.id } },
      { idempotencyKey: `rv-paid-signup-customer:${user.id}` },
    )).id;
    if (!intent) {
      const { data, error } = await admin.from("rv_paid_signup_intents").insert({
        owner_user_id: user.id, dealership_name: dealership, dealership_identity: identity, contact_name: contact, phone: phone || null, stripe_customer_id: customer,
      }).select("id,stripe_customer_id").single();
      if (error || !data) throw new Error("Paid signup could not be started. Refresh and try again.");
      intent = { ...data, checkout_session_id: null, status: "pending" };
    } else {
      const { error } = await admin.from("rv_paid_signup_intents").update({ dealership_name: dealership, dealership_identity: identity, contact_name: contact, phone: phone || null }).eq("id", intent.id).eq("status", "pending");
      if (error) throw new Error("Paid signup details could not be saved.");
    }

    const origin = billingOrigin();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      allow_promotion_codes: true,
      customer,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${origin}/signup/complete?intent=${intent.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/signup/complete?intent=${intent.id}&cancelled=1`,
      metadata: { application: "runfloor", billing_scope: "organization", signup_intent_id: intent.id },
      subscription_data: { metadata: { application: "runfloor", billing_scope: "organization", signup_intent_id: intent.id } },
    }, { idempotencyKey: `rv-paid-signup-checkout:${intent.id}` });
    const { error: saveError } = await admin.from("rv_paid_signup_intents").update({ checkout_session_id: session.id }).eq("id", intent.id).eq("status", "pending");
    if (saveError || !session.url) throw new Error("Checkout could not be saved. Please contact support.");
    redirect(session.url);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    const message = error instanceof Error && !/key|token|secret|sql/i.test(error.message) ? error.message : "Billing is temporarily unavailable.";
    redirect(`/signup/activate?plan=complete&error=${encodeURIComponent(message)}`);
  }
}
