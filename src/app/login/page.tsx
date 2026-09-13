import Link from "next/link";
import { BarChart3, BookOpen, Bolt, Cloud, Lightbulb, MessageCircleMore, MountainSnow, ShieldCheck, Users, UsersRound } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { BrandLogo } from "@/components/brand-logo";
import { isLocalDemoMode, isSupabaseConfigured } from "@/lib/supabase/config";

const benefits = [
  { icon: Users, title: "Develop Your Team", copy: "Train, coach, and build consistency." },
  { icon: Bolt, title: "Streamline Operations", copy: "Standardize processes and eliminate guesswork." },
  { icon: BarChart3, title: "Drive Performance", copy: "Turn knowledge into measurable results." },
  { icon: BookOpen, title: "Access Procedures", copy: "Get the right answer when your team needs it." },
  { icon: Lightbulb, title: "Make Smarter Decisions", copy: "Use your approved data to find opportunities." },
  { icon: MessageCircleMore, title: "Support Every Department", copy: "Bring sales, service, parts, F&I, and leadership together." },
];

export default async function Login({ searchParams }: { searchParams?: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = searchParams ? await searchParams : {};
  const demoMode = isLocalDemoMode();
  const configured = isSupabaseConfigured();
  const nextPath = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  return <main className="signin-page">
    <section className="signin-story" aria-labelledby="signin-story-title">
      <div className="signin-story-shade" />
      <header className="signin-story-header">
        <Link className="signin-logo" href="/" aria-label="RunFloor home"><BrandLogo priority /></Link>
      </header>
      <div className="signin-story-content">
        <p className="signin-story-kicker">A stronger RV dealership starts here.</p>
        <h1 id="signin-story-title">Better teams.<br />Smoother operations.<br /><strong>Happier campers.</strong></h1>
        <p className="signin-story-lede">RunFloor gives your dealership the tools, knowledge, and confidence to sell more RVs, serve more families, and grow a stronger business—every day.</p>
        <div className="signin-benefits">
          {benefits.map(({ icon: Icon, title, copy }) => <article key={title}><span className="signin-benefit-icon"><Icon aria-hidden="true" /></span><div><h2>{title}</h2><p>{copy}</p></div></article>)}
        </div>
        <blockquote><span aria-hidden="true">“</span><p>Same People. Bigger Results.</p><cite>RunFloor</cite></blockquote>
      </div>
      <footer className="signin-trust">
        <div><ShieldCheck aria-hidden="true" /><span><strong>Secure &amp; Reliable</strong>Organization-scoped access</span></div>
        <div><Cloud aria-hidden="true" /><span><strong>Built for RV Dealerships</strong>Sales and operations workflows</span></div>
        <div><UsersRound aria-hidden="true" /><span><strong>Trusted by Dealers</strong>People. RVs. Profit.</span></div>
      </footer>
    </section>
    <section className="signin-panel">
      <p className="signin-panel-motto">People <span /> Processes <span /> Profit</p>
      <div className="signin-card">
        <MountainSnow className="signin-mountain-mark" aria-hidden="true" />
        <LoginForm configured={configured} demoMode={demoMode} nextPath={nextPath} initialError={error === "credentials" ? "The email or password is incorrect." : error === "network" ? "Sign-in could not reach the workspace. Please try again." : ""} />
      </div>
      <p className="signin-script">More Adventures<br />Together.</p>
    </section>
  </main>;
}
