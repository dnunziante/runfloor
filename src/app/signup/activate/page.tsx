import Link from "next/link";
import { cookies } from "next/headers";
import { TrialSignupForm } from "@/components/trial-signup-form";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import "../signup.css";
export default async function Activate({ searchParams }: { searchParams: Promise<{ plan?: string; error?: string }> }) {
  const selected = await searchParams;
  if (!isSupabaseConfigured()) return <main className="rv-signup"><h1>Trial activation is not yet available.</h1><Link href="/demo">Explore the demo</Link></main>;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user || !user.email_confirmed_at) {
    const next = "/signup/activate" + (selected.plan ? "?plan=" + encodeURIComponent(selected.plan) : "");
    return <main className="rv-signup"><h1>Verify your email to get started.</h1><p>Then sign in to activate your dealership.</p><Link href={"/login?next="+encodeURIComponent(next)}>Sign in</Link></main>;
  }
  let draft: { dealership?: string; fullName?: string; phone?: string; plan?: string } = {};
  try { draft = JSON.parse((await cookies()).get("rf-trial-draft")?.value || "{}"); } catch { /* Defaults can be entered again on another device. */ }
  if (selected.plan === "sales_solo_free" || selected.plan === "sales_solo" || selected.plan === "complete") draft.plan = selected.plan;
  const phone = typeof draft.phone === "string" ? draft.phone : typeof user.user_metadata?.contact_phone === "string" ? user.user_metadata.contact_phone : "";
  const plan = draft.plan === "sales_solo_free" ? "sales_solo_free" : draft.plan === "sales_solo" ? "sales_solo" : "complete";
  return <main className="rv-signup"><section><h1>Welcome to RunFloor.</h1>{selected.error && <p role="alert">{selected.error.slice(0,200)}</p>}<p>{plan === "sales_solo_free" ? "Confirm your free account to browse inventory and compare specifications without AI or payment." : plan === "sales_solo" ? "Confirm your account, select RunFloor Solo for $25/month with 500 monthly AI credits after confirmed payment. Until then, Free access remains available. Live payments are disabled." : "Choose the 7-day free trial, or pay $99 today. With checkout-first signup, RunFloor creates your workspace and makes you its administrator only after Stripe confirms payment."}</p><TrialSignupForm activate plan={plan} soloEnabled={process.env.RUNFLOOR_SALES_SOLO_ENABLED === "true"} freeEnabled={process.env.RUNFLOOR_SALES_SOLO_FREE_ENABLED === "true"} dealership={typeof draft.dealership === "string" ? draft.dealership : ""} fullName={typeof draft.fullName === "string" ? draft.fullName : ""} phone={phone}/><Link href="/dashboard">Return to an existing workspace</Link></section></main>;
}
