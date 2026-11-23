import Link from "next/link";
import { cookies } from "next/headers";
import { TrialSignupForm } from "@/components/trial-signup-form";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import "../signup.css";
export default async function Activate({ searchParams }: { searchParams: Promise<{ plan?: string; error?: string }> }) {
  const selected = await searchParams;
  if (!isSupabaseConfigured()) return <main className="rv-signup"><h1>Account setup is not yet available.</h1><Link href="/demo">Explore the demo</Link></main>;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user || !user.email_confirmed_at) {
    const plan = selected.plan || "sales_solo";
    const next = "/signup/activate?plan=" + encodeURIComponent(plan);
    return <main className="rv-signup"><h1>Verify your email to get started.</h1><p>After verification, RunFloor Solo continues to $25/month checkout. Your Sales workspace is created after payment confirmation.</p><Link href={"/login?next="+encodeURIComponent(next)}>Sign in</Link></main>;
  }
  let draft: { dealership?: string; fullName?: string; phone?: string; plan?: string } = {};
  try { draft = JSON.parse((await cookies()).get("rf-trial-draft")?.value || "{}"); } catch { /* Defaults can be entered again on another device. */ }
  if (selected.plan === "sales_solo_free" || selected.plan === "sales_solo" || selected.plan === "complete") draft.plan = selected.plan;
  const phone = typeof draft.phone === "string" ? draft.phone : typeof user.user_metadata?.contact_phone === "string" ? user.user_metadata.contact_phone : "";
  const plan = draft.plan === "sales_solo_free" ? "sales_solo_free" : draft.plan === "complete" ? "complete" : "sales_solo";
  return <main className="rv-signup"><section><h1>Welcome to RunFloor.</h1>{selected.error && <p role="alert">{selected.error.slice(0,200)}</p>}<p>{plan === "sales_solo_free" ? "Confirm your free account to browse inventory and compare specifications without AI or payment." : plan === "sales_solo" ? "Next, pay $25/month through Stripe Checkout. RunFloor creates your personal one-user Sales workspace and applies your 500 monthly AI credits only after Stripe confirms the first payment." : "Choose the 7-day free trial, or pay $99 today. RunFloor creates your dealership workspace and makes you its administrator only after Stripe confirms payment."}</p><TrialSignupForm activate plan={plan} soloEnabled={process.env.RUNFLOOR_SALES_SOLO_ENABLED === "true"} freeEnabled={process.env.RUNFLOOR_SALES_SOLO_FREE_ENABLED === "true"} dealership={typeof draft.dealership === "string" ? draft.dealership : ""} fullName={typeof draft.fullName === "string" ? draft.fullName : ""} phone={phone}/><Link href="/dashboard">Return to an existing workspace</Link></section></main>;
}
