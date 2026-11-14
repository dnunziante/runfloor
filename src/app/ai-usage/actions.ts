"use server";
import { redirect } from "next/navigation";
import { createCreditCheckout } from "@/lib/ai-billing/checkout";
import { billingStripe, billingOrigin } from "@/lib/ai-billing/stripe";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
export async function purchaseCredits(form: FormData) {
  let url = "/ai-usage?error=Unable+to+open+checkout.";
  try {
    url = await createCreditCheckout(
      form.get("kind") === "subscription" ? "subscription" : "credits",
      String(form.get("pack") ?? ""),
      String(form.get("request") ?? ""),
    );
  } catch (e) {
    url = `/ai-usage?error=${encodeURIComponent(e instanceof Error ? e.message : "Checkout unavailable.")}`;
  }
  redirect(url);
}
export async function openBillingPortal() {
  let url = "/ai-usage?error=Billing+portal+unavailable.";
  try {
    const viewer = await getViewer();
    if (!viewer || viewer.demo) throw new Error("Sign in");
    const db = await createClient();
    const { data: summary } = await db.rpc("get_ai_credit_summary", {
      target_org: viewer.organizationId,
    });
    if (!summary?.can_manage) throw new Error("Billing admin required");
    const { data: customer } = await db
      .from("runfloor_billing_customers")
      .select("stripe_customer_id,stripe_account_id,livemode")
      .eq("organization_id", viewer.organizationId)
      .single();
    const { stripe, account, live } = await billingStripe();
    if (
      !customer ||
      customer.stripe_account_id !== account ||
      customer.livemode !== live
    )
      throw new Error("Wrong account");
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: `${billingOrigin()}/ai-usage`,
    });
    url = session.url;
  } catch {}
  redirect(url);
}
