import Link from "next/link";
import { TrialSignupForm } from "@/components/trial-signup-form";
import "./signup.css";
export default function Signup() {
  return <main className="rv-signup"><section><p className="lp-kicker">YOUR NEXT CHAPTER STARTS HERE</p><h1>A stronger dealership.<br/><em>7 days on us.</em></h1><p>RunFloor Complete. Unlimited users. 100 shared AI credits.<br/>Then $99/month per location, only if you choose to subscribe.</p><TrialSignupForm/><p>Already have an account? <Link href="/login?next=/signup/activate">Sign in</Link></p><Link href="/demo">Explore the demo</Link></section></main>;
}
