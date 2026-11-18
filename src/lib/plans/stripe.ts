import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { SALES_SOLO } from "./policy";
export async function soloPrice(stripe: Stripe, account: string, live: boolean) {
  const { data, error } = await createAdminClient().from("sales_solo_catalog").select("*").eq("id", true).single();
  if (error || !data?.active || data.stripe_account_id !== account || data.livemode !== live || !data.stripe_price_id) throw new Error("Sales Solo payments are not activated yet.");
  const price = await stripe.prices.retrieve(data.stripe_price_id);
  const product = typeof price.product === "string" ? price.product : price.product.id;
  if (!price.active || product !== data.stripe_product_id || price.currency !== "usd" || price.unit_amount !== SALES_SOLO.priceCents || price.recurring?.interval !== "month" || price.recurring.interval_count !== 1 || price.recurring.usage_type !== "licensed") throw new Error("Sales Solo requires its approved $25 USD monthly price.");
  return price;
}
