import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authOrigin } from "@/lib/auth/redirects";
import Link from "next/link";
import { TrialSignupForm } from "@/components/trial-signup-form";
import "./signup.css";
export default async function Signup({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
 const value=(await searchParams).plan;
 const plan=value === "free" || value === "sales_solo_free" ? "sales_solo_free" : value === "solo" || value === "sales_solo" ? "sales_solo" : "complete";
 // PKCE's verifier cookie belongs to the signup host. Production aliases must
 // render this form on the same canonical host used by the confirmation link.
 if (process.env.VERCEL_ENV === "production") {
  let origin: string | undefined;
  try { origin = authOrigin(); } catch { /* The action reports unavailable configuration. */ }
  if (origin && (await headers()).get("host") !== new URL(origin).host) redirect(`${origin}/signup?plan=${plan}`);
 }

 return <main className="rv-signup"><section><p className="lp-kicker">{plan === "sales_solo_free" ? "RUNFLOOR FREE" : plan === "sales_solo" ? "RUNFLOOR SOLO" : "RUNFLOOR COMPLETE"}</p><h1>{plan === "complete" ? "A stronger dealership. 7 days on us." : "Your personal sales workspace."}</h1><p>{plan === "complete" ? "Unlimited users. 100 shared AI credits during your 7-day trial. Then $99/month per location, only if you choose to subscribe." : plan === "sales_solo_free" ? "$0/month. Browse the preloaded model library and compare specifications. No AI included." : "$25/month with 500 monthly AI credits after activation. Until payment is available and confirmed, your account keeps Free catalog and comparison access with no AI. Registration does not charge you."}</p><p>Preloaded with over 1,500 models.</p><TrialSignupForm plan={plan} soloEnabled={process.env.RUNFLOOR_SALES_SOLO_ENABLED === "true"} freeEnabled={process.env.RUNFLOOR_SALES_SOLO_FREE_ENABLED === "true"}/><p>Already have an account? <Link href={"/login?next="+encodeURIComponent("/signup/activate?plan="+plan)}>Sign in</Link></p><Link href="/#pricing">Compare all plans</Link></section></main>;
}
