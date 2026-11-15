import "server-only";
import type Stripe from "stripe";
import { billingStripe, billingOrigin as existingOrigin } from "@/lib/ai-billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
export async function stripeClient() { return (await billingStripe()).stripe; }
export function billingOrigin() { return existingOrigin(); }
export async function completePrice(stripe: Stripe) {
 const {data: catalog,error}=await createAdminClient().from("runfloor_billing_catalog").select("stripe_price_id,active").eq("id",true).single();
 if(error || !catalog?.active || !catalog.stripe_price_id) throw new Error("The subscription plan is not activated yet.");
 const price=await stripe.prices.retrieve(catalog.stripe_price_id);
 if(!price.active || price.currency!=="usd" || price.unit_amount!==9900 || price.recurring?.interval!=="month" || price.recurring.interval_count!==1 || price.recurring.usage_type!=="licensed") throw new Error("The approved plan must be $99 USD monthly.");
 return price;
}
