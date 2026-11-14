import "server-only";
import Stripe from "stripe";
export async function billingStripe() {
  const key = process.env.RUNFLOOR_STRIPE_SECRET_KEY;
  const account = process.env.RUNFLOOR_STRIPE_ACCOUNT_ID;
  if (!key || !account)
    throw new Error("RunFloor payments are not configured.");
  const live = /^[sr]k_live_/.test(key);
  if (
    !(/^(?:sk|rk)_live_/.test(key) || /^(?:sk|rk|rkcs)_test_/.test(key)) ||
    (live && process.env.RUNFLOOR_STRIPE_LIVE_ENABLED !== "true")
  )
    throw new Error("Live RunFloor payments are disabled.");
  const stripe = new Stripe(key, { maxNetworkRetries: 2 });
  const verified = await stripe.accounts.retrieve(null);
  if (verified.id !== account)
    throw new Error("Wrong RunFloor Stripe account.");
  return { stripe, account, live };
}
export function billingOrigin() {
  const value = process.env.RUNFLOOR_BILLING_ORIGIN;
  if (!value) throw new Error("Trusted billing origin is missing.");
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost")
    throw new Error("Invalid billing origin.");
  return url.origin;
}
