import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { isLocalDemoMode, isSupabaseConfigured } from "@/lib/supabase/config";

export default async function Login({ searchParams }: { searchParams?: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = searchParams ? await searchParams : {};
  const demoMode = isLocalDemoMode();
  const configured = isSupabaseConfigured();
  const nextPath = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return <main className="login-page">
    <section className="login-side">
      <Link className="login-logo" href="/" aria-label="RunFloor home"><strong>RunFloor</strong><small>Run your sales floor.</small></Link>
      <div><h1>Run your business with clarity.</h1><p><CheckCircle2 size={17}/> <span><strong>Sell smarter</strong> — Turn product knowledge and proven methodology into better customer conversations.</span></p><p><CheckCircle2 size={17}/> <span><strong>Develop your team</strong> — Coach, train, and build stronger performance.</span></p><p><CheckCircle2 size={17}/> <span><strong>Find opportunities</strong> — Use business and market intelligence to identify where to grow.</span></p></div>
      <small>Refine. Transform. Perform.</small>
    </section>
    <section className="login-form-wrap"><LoginForm configured={configured} demoMode={demoMode} nextPath={nextPath} initialError={error === "credentials" ? "The email or password is incorrect." : error === "network" ? "Sign-in could not reach the workspace. Please try again." : ""}/></section>
  </main>;
}
