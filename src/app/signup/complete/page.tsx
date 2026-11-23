import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripeClient } from "@/lib/billing/stripe";
import "../signup.css";

export default async function PaidSignupComplete({ searchParams }: { searchParams: Promise<{ intent?: string; session_id?: string; cancelled?: string }> }) {
  const params = await searchParams;
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/login?next=" + encodeURIComponent("/signup/complete"));
  const intentId = params.intent || "";
  if (!/^[0-9a-f-]{36}$/i.test(intentId)) return <main className="rv-signup"><section><h1>We couldn’t find this checkout.</h1><Link href="/signup/activate?plan=complete">Return to RunFloor signup</Link></section></main>;
  const { data: intent } = await createAdminClient().from("rv_paid_signup_intents").select("id,status,organization_id,owner_user_id,stripe_customer_id,checkout_session_id").eq("id", intentId).eq("owner_user_id", user.id).maybeSingle();
  if (!intent) return <main className="rv-signup"><section><h1>We couldn’t find this checkout.</h1><Link href="/signup/activate?plan=complete">Return to RunFloor signup</Link></section></main>;
  if (intent.status === "provisioned") redirect("/dashboard");

  let paid = false;
  if (params.session_id && params.session_id === intent.checkout_session_id) {
    try {
      const session = await (await stripeClient()).checkout.sessions.retrieve(params.session_id);
      paid = session.status === "complete" && session.payment_status === "paid" && session.metadata?.signup_intent_id === intent.id && session.customer === intent.stripe_customer_id;
    } catch { /* The signed webhook remains the authority for workspace creation. */ }
  }

  return <main className="rv-signup"><section>
    <p className="lp-kicker">RUNFLOOR COMPLETE</p>
    <h1>{params.cancelled ? "Checkout canceled" : paid ? "Payment received" : "Checkout status"}</h1>
    <p>{params.cancelled ? "No workspace was created. You can return to checkout when you’re ready." : paid ? "Stripe received your payment. RunFloor is verifying it and setting up your dealership workspace. Your account will be its administrator." : "Your workspace is created only after Stripe confirms the $99 payment. If you just completed checkout, refresh this page in a moment."}</p>
    {!params.cancelled && <p role="status">Setup status: {intent.status === "provisioned" ? "complete" : "waiting for Stripe confirmation"}</p>}
    <div className="hero-actions"><Link className="btn btn-primary" href={`/signup/complete?intent=${intent.id}`}>Refresh setup status</Link><Link className="btn btn-ghost" href="/signup/activate?plan=complete">Return to signup</Link></div>
  </section></main>;
}
