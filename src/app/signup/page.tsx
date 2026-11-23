import Link from "next/link";
import { TrialSignupForm } from "@/components/trial-signup-form";
import "./signup.css";
export default async function Signup({ searchParams }: { searchParams: Promise<{ plan?: string; error?: string }> }) {
 const params=await searchParams;
 const value=params.plan;
 const plan=value === "free" || value === "sales_solo_free" ? "sales_solo_free" : value === "complete" ? "complete" : "sales_solo";
 return <main className="rv-signup"><section><p className="lp-kicker">{plan === "sales_solo_free" ? "RUNFLOOR FREE" : plan === "sales_solo" ? "RUNFLOOR SOLO" : "RUNFLOOR COMPLETE"}</p><h1>{plan === "complete" ? "A stronger dealership. 7 days on us." : plan === "sales_solo_free" ? "Start with the essentials." : "Your personal sales workspace."}</h1>{params.error && <p role="alert">{params.error.slice(0,200)}</p>}<p>{plan === "complete" ? "Unlimited users. 100 shared AI credits during your 7-day trial. Then $99/month per location, only if you choose to subscribe." : plan === "sales_solo_free" ? "$0/month. Browse the preloaded model library and compare specifications. No AI included." : "$25/month. Complete Stripe Checkout first, then create your account. Your personal Sales workspace opens after payment is confirmed."}</p><p>Preloaded with over 1,500 models.</p><TrialSignupForm plan={plan} soloEnabled={process.env.RUNFLOOR_SALES_SOLO_ENABLED === "true"} freeEnabled={process.env.RUNFLOOR_SALES_SOLO_FREE_ENABLED === "true"}/><p>Already have an account? <Link href={"/login?next="+encodeURIComponent("/signup/activate?plan="+plan)}>Sign in</Link></p><Link href="/#pricing">Compare all plans</Link></section></main>;
}
