import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { billingStripe } from "@/lib/ai-billing/stripe";
import { PaidSoloAccountForm } from "@/components/paid-solo-account-form";
import "../signup.css";

export default async function SoloSignupComplete({ searchParams }: { searchParams: Promise<{ intent?: string; session_id?: string; cancelled?: string; account_created?: string }> }) {
  const params = await searchParams;
  const intentId = params.intent || "";
  if (!/^[0-9a-f-]{36}$/i.test(intentId)) return <main className="rv-signup"><section><h1>We couldn’t find this checkout.</h1><Link href="/signup?plan=solo">Return to RunFloor Solo</Link></section></main>;

  const { data: intent } = await createAdminClient().from("sales_solo_signup_intents")
    .select("id,status,organization_id,owner_user_id,signup_email,workspace_name,contact_name,phone,stripe_customer_id,stripe_account_id,livemode,checkout_session_id")
    .eq("id", intentId).maybeSingle();
  if (!intent) return <main className="rv-signup"><section><h1>We couldn’t find this checkout.</h1><Link href="/signup?plan=solo">Return to RunFloor Solo</Link></section></main>;
  if (intent.status === "provisioned") return <main className="rv-signup"><section><h1>Your Sales workspace is ready.</h1><p>RunFloor has confirmed your subscription and created your workspace.</p><Link className="btn btn-primary" href="/dashboard">Open RunFloor</Link></section></main>;

  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  const matchingUser = user?.email?.toLowerCase() === intent.signup_email;
  let paid = false;
  let verifiedSessionId = "";
  if (!params.cancelled && params.session_id && params.session_id === intent.checkout_session_id) {
    try {
      const { stripe, account, live } = await billingStripe();
      if (account === intent.stripe_account_id && live === intent.livemode) {
        const session = await stripe.checkout.sessions.retrieve(params.session_id);
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        const sessionEmail = (session.customer_details?.email || session.customer_email || "").toLowerCase();
        paid = session.mode === "subscription" && session.status === "complete" && session.payment_status === "paid" &&
          session.livemode === live && session.metadata?.application === "runfloor" &&
          session.metadata?.billing_scope === "sales_solo" &&
          session.metadata?.sales_solo_signup_intent_id === intent.id &&
          customerId === intent.stripe_customer_id && sessionEmail === intent.signup_email;
        if (paid) verifiedSessionId = session.id;
      }
    } catch { /* Stripe webhook remains the authority for workspace creation. */ }
  }
  const next = `/signup/solo-complete?intent=${encodeURIComponent(intent.id)}${params.session_id ? `&session_id=${encodeURIComponent(params.session_id)}` : ""}`;
  const signIn = "/login?next=" + encodeURIComponent(next);

  return <main className="rv-signup"><section>
    <p className="lp-kicker">RUNFLOOR SOLO</p>
    <h1>{params.cancelled ? "Checkout canceled" : paid ? "Payment received" : "Checkout status"}</h1>
    <p>{params.cancelled ? "No account or workspace was created. You can return to RunFloor Solo and try checkout again." : paid ? "Stripe confirmed your $25 payment. Create your account with the same email you used at checkout. We’ll open your Sales workspace after you verify your email and RunFloor confirms the payment." : "Your Solo workspace is created only after Stripe confirms the $25 payment. If you just completed checkout, refresh this page in a moment."}</p>

    {paid && intent.owner_user_id && !matchingUser && <><p>This checkout is linked to the account for {intent.signup_email}. Check that email for the verification link, or sign in with it to finish setup.</p><Link className="btn btn-primary" href={signIn}>Sign in to finish setup</Link></>}
    {paid && intent.owner_user_id && matchingUser && !user?.email_confirmed_at && <p role="status">Your account is created. Check {intent.signup_email} for the verification link. Verify it to activate the workspace.</p>}
    {paid && (!intent.owner_user_id || (matchingUser && user?.email_confirmed_at)) && <PaidSoloAccountForm intent={intent.id} sessionId={verifiedSessionId} email={intent.signup_email} fullName={intent.contact_name} phone={intent.phone || ""} requirePassword={!matchingUser}/>}
    {paid && !intent.owner_user_id && <p>Already have an account with this email? <Link href={signIn}>Sign in to link your paid checkout.</Link></p>}
    {paid && matchingUser && user?.email_confirmed_at && <p role="status">Account verified. RunFloor is waiting for Stripe’s payment webhook to finish creating your workspace.</p>}
    {!paid && !params.cancelled && <p role="status">Setup status: {intent.status === "provisioned" ? "complete" : "waiting for a completed payment"}</p>}
    <div className="hero-actions"><Link className="btn btn-ghost" href="/signup?plan=solo">{params.cancelled ? "Return to Solo checkout" : "Return to signup"}</Link>{!params.cancelled && <Link className="btn btn-ghost" href={`/signup/solo-complete?intent=${intent.id}${params.session_id ? `&session_id=${encodeURIComponent(params.session_id)}` : ""}`}>Refresh setup status</Link>}</div>
  </section></main>;
}
