"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { billingStripe } from "@/lib/ai-billing/stripe";
import { soloPrice } from "@/lib/plans/stripe";

const validIntent = (value: string) => /^[0-9a-f-]{36}$/i.test(value);
const safeMessage = "We couldn’t finish account setup. Check the payment and account details, then try again.";

export async function completePaidSoloSignup(_state: { message: string }, form: FormData) {
  const intentId = String(form.get("intent") || "");
  const sessionId = String(form.get("session_id") || "");
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  if (!validIntent(intentId) || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return { message: safeMessage };

  const admin = createAdminClient();
  const { data: intent, error: intentError } = await admin.from("sales_solo_signup_intents")
    .select("id,status,signup_email,owner_user_id,stripe_customer_id,stripe_account_id,livemode,checkout_session_id")
    .eq("id", intentId).maybeSingle();
  if (intentError || !intent || intent.status !== "pending" || intent.checkout_session_id !== sessionId || intent.signup_email !== email) return { message: safeMessage };

  try {
    const { stripe, account, live } = await billingStripe();
    if (account !== intent.stripe_account_id || live !== intent.livemode) return { message: safeMessage };
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    const checkoutEmail = (session.customer_details?.email || session.customer_email || "").toLowerCase();
    if (session.mode !== "subscription" || session.status !== "complete" || session.payment_status !== "paid" ||
      session.livemode !== live || session.metadata?.application !== "runfloor" ||
      session.metadata?.billing_scope !== "sales_solo" ||
      session.metadata?.sales_solo_signup_intent_id !== intent.id ||
      customerId !== intent.stripe_customer_id || checkoutEmail !== intent.signup_email) return { message: safeMessage };

    const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (!subId) return { message: safeMessage };
    const [subscription, price] = await Promise.all([
      stripe.subscriptions.retrieve(subId),
      soloPrice(stripe, account, live),
    ]);
    const item = subscription.items.data.length === 1 ? subscription.items.data[0] : null;
    if (subscription.status !== "active" || subscription.livemode !== live ||
      subscription.metadata.sales_solo_signup_intent_id !== intent.id ||
      (typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id) !== intent.stripe_customer_id ||
      !item || item.quantity !== 1 || item.price.id !== price.id) return { message: safeMessage };

    const auth = await createClient();
    const { data: { user: signedIn } } = await auth.auth.getUser();
    let owner = signedIn;
    if (owner) {
      if (owner.email?.toLowerCase() !== intent.signup_email || !owner.email_confirmed_at) {
        return { message: "Sign in with the verified email address used at Stripe Checkout." };
      }
    } else {
      if (email !== intent.signup_email) return { message: "Use the same email address you entered at checkout." };
      if (password.length < 12 || password.length > 128) return { message: "Create a password with at least 12 characters." };
      const origin = process.env.RUNFLOOR_BILLING_ORIGIN;
      if (!origin) return { message: "Account setup is temporarily unavailable." };
      const next = `/signup/solo-complete?intent=${encodeURIComponent(intent.id)}&session_id=${encodeURIComponent(sessionId)}`;
      const { data, error } = await auth.auth.signUp({
        email: intent.signup_email,
        password,
        options: {
          data: { full_name: String(form.get("fullName") || "").trim(), contact_phone: String(form.get("phone") || "").trim() || null },
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error || !data.user || data.user.identities?.length === 0) {
        return { message: "That email may already have a RunFloor account. Sign in with the checkout email to link your payment and finish setup." };
      }
      owner = data.user;
    }

    if (intent.owner_user_id && intent.owner_user_id !== owner.id) {
      return { message: "This checkout is already linked to a different RunFloor account. Contact support to finish setup." };
    }
    const { data: linked, error: linkError } = await admin.from("sales_solo_signup_intents")
      .update({ owner_user_id: owner.id })
      .eq("id", intent.id).eq("status", "pending").eq("signup_email", intent.signup_email)
      .or(`owner_user_id.is.null,owner_user_id.eq.${owner.id}`)
      .select("id").maybeSingle();
    if (linkError || !linked) return { message: "Your account was created, but we couldn’t link the paid checkout yet. Sign in and try again." };

    redirect(`/signup/solo-complete?intent=${encodeURIComponent(intent.id)}&session_id=${encodeURIComponent(sessionId)}&account_created=1`);
  } catch (error) {
    if (error instanceof Error && (error.message === "NEXT_REDIRECT" || error.message.startsWith("NEXT_REDIRECT;"))) throw error;
    return { message: safeMessage };
  }
}
