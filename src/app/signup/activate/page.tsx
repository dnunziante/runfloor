import Link from "next/link";
import { cookies } from "next/headers";
import { TrialSignupForm } from "@/components/trial-signup-form";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import "../signup.css";
export default async function Activate({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const selected = (await searchParams).plan;
  if (!isSupabaseConfigured()) return <main className="rv-signup"><h1>Trial activation is not yet available.</h1><Link href="/demo">Explore the demo</Link></main>;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user || !user.email_confirmed_at) return <main className="rv-signup"><h1>Verify your email to get started.</h1><p>Then sign in to activate your dealership.</p><Link href={"/login?next="+encodeURIComponent("/signup/activate"+(selected ? "?plan="+selected : ""))}>Sign in</Link></main>;
  let draft: { dealership?: string; fullName?: string; phone?: string; plan?: string } = {};
  try { draft = JSON.parse((await cookies()).get("rf-trial-draft")?.value || "{}"); } catch { /* Defaults can be entered again on another device. */ }
  if (selected === "sales_solo_free" || selected === "sales_solo" || selected === "complete") draft.plan = selected;
  const phone = typeof draft.phone === "string" ? draft.phone : typeof user.user_metadata?.contact_phone === "string" ? user.user_metadata.contact_phone : "";
  return <main className="rv-signup"><section><h1>Welcome to RunFloor.</h1><p>{draft.plan === "sales_solo_free" ? "Confirm your free account to browse inventory and compare specifications without AI or payment." : draft.plan === "sales_solo" ? "Confirm your account, select RunFloor Solo for $25/month with 500 monthly AI credits after confirmed payment. Until then, Free access remains available. Live payments are disabled." : "Confirm your dealership to activate 7 days of access and 100 shared AI credits."}</p><TrialSignupForm activate plan={draft.plan === "sales_solo_free" ? "sales_solo_free" : draft.plan === "sales_solo" ? "sales_solo" : "complete"} soloEnabled={process.env.RUNFLOOR_SALES_SOLO_ENABLED === "true"} freeEnabled={process.env.RUNFLOOR_SALES_SOLO_FREE_ENABLED === "true"} dealership={typeof draft.dealership === "string" ? draft.dealership : ""} fullName={typeof draft.fullName === "string" ? draft.fullName : ""} phone={phone}/><Link href="/dashboard">Return to an existing workspace</Link></section></main>;
}
