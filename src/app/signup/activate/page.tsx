import Link from "next/link";
import { cookies } from "next/headers";
import { TrialSignupForm } from "@/components/trial-signup-form";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import "../signup.css";
export default async function Activate() {
  if (!isSupabaseConfigured()) return <main className="rv-signup"><h1>Trial activation is not yet available.</h1><Link href="/demo">Explore the demo</Link></main>;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user || !user.email_confirmed_at) return <main className="rv-signup"><h1>Verify your email to get started.</h1><p>Then sign in to activate your dealership.</p><Link href="/login?next=/signup/activate">Sign in</Link></main>;
  let draft: { dealership?: string; fullName?: string } = {};
  try { draft = JSON.parse((await cookies()).get("rf-trial-draft")?.value || "{}"); } catch { /* Defaults can be entered again on another device. */ }
  return <main className="rv-signup"><section><h1>Welcome to RunFloor.</h1><p>Confirm your dealership to activate 7 days of access and 100 shared AI credits.</p><TrialSignupForm activate dealership={typeof draft.dealership === "string" ? draft.dealership : ""} fullName={typeof draft.fullName === "string" ? draft.fullName : ""}/><Link href="/dashboard">Return to an existing workspace</Link></section></main>;
}
