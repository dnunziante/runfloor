import Link from "next/link";
import { ArrowRight, BarChart3, BookOpenCheck, Bot, BriefcaseBusiness, CheckCircle2, ChevronDown, CirclePlay, ClipboardCheck, Gauge, GraduationCap, MapPin, MessageSquareText, ShieldCheck, Target, TrendingUp, UsersRound } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

const pillars = [
  { icon: MessageSquareText, title: "Sales Assistant", copy: "Instant answers. Confident conversations. More deals.", href: "/assistant", items: ["RV specs, features, and comparisons","Objection handling for real shoppers","Email and text templates","Deal structure guidance"] },
  { icon: ClipboardCheck, title: "Operations Assistant", copy: "Turn processes into performance.", href: "/operations", items: ["Standardized procedures","Task management","Operational checklists","Accountability"] },
  { icon: GraduationCap, title: "Sales Coach", copy: "Practice. Improve. Close more.", href: "/coach", items: ["Role-play real RV scenarios","Personalized coaching","Team training and development","Track progress and performance"] },
  { icon: BarChart3, title: "Executive Advisor", copy: "Data. Insights. Growth.", href: "/executive", items: ["Performance dashboards","Leadership priorities","Location visibility","Clear next actions"] },
] as const;
const platform = [
  [BookOpenCheck,"Product Knowledge","Specs, comparisons, and approved answers.","/knowledge-base"],
  [MessageSquareText,"Conversations","Consistent, approved messaging.","/text"],
  [GraduationCap,"Coaching","Role-play, training, and development.","/coach"],
  [Target,"Opportunities","Track, manage, and grow revenue.","/growth/opportunities"],
  [ClipboardCheck,"Operations","Checklists, procedures, and tasks.","/operations"],
  [BarChart3,"Reports","Clear performance insights.","/executive"],
] as const;
const roles = [
  [UsersRound,"Sales Representatives","Sell smarter. Be more confident. Close more.","/assistant"],
  [GraduationCap,"Sales Managers","Coach effectively. Keep teams on track.","/coach"],
  [BriefcaseBusiness,"General Managers","Run a more efficient, profitable dealership.","/operations"],
  [MapPin,"Multi-Location Leaders","Get visibility. Drive accountability.","/executive/readiness"],
  [Gauge,"Ownership / Executives","See what matters. Make smarter decisions.","/executive"],
] as const;

export default function Home() {
  return <main className="lp">
    <section className="lp-hero">
      <header className="lp-nav"><Link href="/" aria-label="RunFloor home"><BrandLogo priority/></Link><nav><details><summary>Platform <ChevronDown/></summary><div><a href="#platform">Platform overview</a><a href="#solutions">Solutions</a></div></details><details><summary>Solutions <ChevronDown/></summary><div><Link href="/assistant">Sales Assistant</Link><Link href="/operations">Operations</Link><Link href="/coach">Coaching</Link><Link href="/executive">Executive</Link></div></details><a href="#resources">Resources</a><a href="#pricing">Pricing</a></nav><div><Link href="/demo">View Demo</Link><Link className="lp-button" href="/login">Get Started <ArrowRight/></Link></div></header>
      <div className="lp-hero-grid"><div><p className="lp-kicker">The AI-powered RV dealership platform</p><h1>Drive a<br/>Stronger<br/><em>Dealership.</em></h1><h2>Train your team. Standardize your operations.<br/>Close more units.</h2><p>Create unforgettable customer experiences and run a more profitable RV dealership—all in one platform.</p><div className="lp-actions"><Link className="lp-button" href="/demo">See It In Action <ArrowRight/></Link><Link className="lp-outline" href="/demo"><CirclePlay/> Watch Demo</Link></div></div><div className="lp-product-preview"><div className="lp-mini-nav"><BrandLogo compact/><span>Home</span><span>Sales Assistant</span><span>Inventory</span><span>Coaching</span><span>Operations</span><span>Reports</span></div><section><span className="lp-preview-logo"><BrandLogo compact/></span><h3>Good Morning, Team!</h3><p>Let&apos;s make today another great day at the dealership.</p><div><Link href="/assistant"><Bot/>Ask AI<small>Get instant answers</small></Link><Link href="/coach"><GraduationCap/>Role Play<small>Practice and improve</small></Link><Link href="/operations/checklists"><ClipboardCheck/>Checklists<small>Stay on track</small></Link><Link href="/executive"><BarChart3/>Reports<small>See what matters</small></Link></div></section></div></div>
      <div className="lp-hero-proof"><span><TrendingUp/>More Unit Sales</span><span><UsersRound/>Stronger Teams</span><span><ClipboardCheck/>Smoother Operations</span><span><BarChart3/>Measurable Growth</span></div>
    </section>

    <section className="lp-section lp-solutions" id="solutions"><div className="lp-heading"><div><p className="lp-kicker">Built for every RV dealership</p><h2>More than answers.<br/><em>A better way to run the floor.</em></h2><p>RunFloor combines AI, training, process management, and data into one user-friendly platform built for RV dealership teams.</p></div><aside><ShieldCheck/><strong>Built for multi-location RV dealerships.</strong></aside></div><div className="lp-pillar-grid">{pillars.map(({icon:Icon,title,copy,href,items},index)=><Link className={index===0?"featured":""} href={href} key={title}><Icon/><h3>{title}</h3><p>{copy}</p><ul>{items.map(item=><li key={item}><CheckCircle2/>{item}</li>)}</ul><ArrowRight/></Link>)}</div></section>
    <section className="lp-stats" aria-label="RunFloor platform strengths"><div><UsersRound/><strong>One team</strong><small>Connected and prepared</small></div><div><MapPin/><strong>Any location</strong><small>Consistent standards</small></div><div><TrendingUp/><strong>Visible growth</strong><small>Actionable performance</small></div><div><ShieldCheck/><strong>Approved knowledge</strong><small>Trustworthy guidance</small></div></section>
    <section className="lp-section lp-platform" id="platform"><div className="lp-heading"><div><p className="lp-kicker">One connected platform</p><h2>Everything your team needs to win.</h2><p>From the first conversation to the final handoff, RunFloor keeps your team aligned, informed, and performing at their best.</p></div></div><div className="lp-platform-layout"><div>{platform.map(([Icon,title,copy,href])=><Link href={href} key={title}><Icon/><span><strong>{title}</strong><small>{copy}</small></span><ArrowRight/></Link>)}</div><aside><p>Same People.<br/>Bigger Results.</p></aside></div></section>
    <section className="lp-section lp-roles"><div className="lp-heading"><div><p className="lp-kicker">Useful at every level</p><h2>Built for the people who move your business forward.</h2></div><a href="#roles">See All Use Cases <ArrowRight/></a></div><div className="lp-role-grid" id="roles">{roles.map(([Icon,title,copy,href])=><Link href={href} key={title}><div><Icon/></div><h3>{title}</h3><p>{copy}</p><ArrowRight/></Link>)}</div></section>
    <section className="lp-results" id="resources"><p className="lp-kicker">Real dealerships. Real results.</p><h2>Built for measurable dealership performance.</h2><div><article><Target/><h3>Knowledge into action</h3><p>Approved product knowledge becomes consistent customer conversations.</p><Link href="/knowledge-base">Explore knowledge <ArrowRight/></Link></article><article><UsersRound/><h3>Practice into confidence</h3><p>Coaching workflows help teams prepare for real sales-floor situations.</p><Link href="/coach">Explore coaching <ArrowRight/></Link></article><article><BarChart3/><h3>Activity into visibility</h3><p>Connected reporting gives leaders a clearer view of execution.</p><Link href="/executive">Explore reporting <ArrowRight/></Link></article></div></section>
    <section className="lp-cta" id="pricing"><div><p className="lp-kicker">Ready when your team is</p><h2>Run a better RV dealership today.</h2><p>See how RunFloor can help your dealership sell smarter, coach better, and grow faster.</p></div><div><Link className="lp-button light" href="/demo"><CirclePlay/>Watch a Demo</Link><Link className="lp-button dark" href="/login">Get Started <ArrowRight/></Link></div></section>
    <footer className="lp-footer"><BrandLogo/><nav><a href="#platform">Platform</a><a href="#solutions">Solutions</a><a href="#resources">Resources</a><a href="#pricing">Pricing</a></nav><div><Link href="/demo">Demo</Link><Link href="/login">Sign in</Link></div><p>People. RVs. Profit.</p></footer>
  </main>;
}
