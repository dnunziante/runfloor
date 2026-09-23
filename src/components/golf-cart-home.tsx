import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Bot,
  Boxes,
  Building2,
  Check,
  ClipboardCheck,
  DollarSign,
  GraduationCap,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import type { DashboardData } from "@/lib/dashboard/data";

const focusAreas = [
  { icon: Boxes, title: "Golf Carts & LSVs", copy: "Move more units", href: "/products", tone: "green" },
  { icon: Wrench, title: "Service & Parts", copy: "Keep customers rolling", href: "/operations/procedures", tone: "blue" },
  { icon: Megaphone, title: "Marketing", copy: "Bring in more buyers", href: "/email", tone: "orange" },
  { icon: Settings, title: "Operations", copy: "Run more efficiently", href: "/operations", tone: "purple" },
  { icon: DollarSign, title: "Finance", copy: "Increase profitability", href: "/pricing-calculator", tone: "red" },
] as const;

const tools = [
  { icon: Boxes, title: "Product Library", copy: "Compare golf carts and LSVs", href: "/products", tone: "teal" },
  { icon: BookOpenCheck, title: "Procedure Library", copy: "Service, delivery, and setup guides", href: "/operations/procedures", tone: "blue" },
  { icon: Mail, title: "Email & Text Generator", copy: "Create customer-ready messages", href: "/email", tone: "purple" },
  { icon: ClipboardCheck, title: "Checklists & Templates", copy: "Sales, service, and operations", href: "/operations/checklists", tone: "red" },
  { icon: BarChart3, title: "Data & Analytics", copy: "Track performance and trends", href: "/analytics", tone: "green" },
] as const;

const topics = [
  { icon: TrendingUp, title: "Increase Sales", copy: "Proven strategies for golf carts and LSVs", href: "/assistant", tone: "green" },
  { icon: Wrench, title: "Improve Service", copy: "Boost retention and parts revenue", href: "/operations/procedures", tone: "blue" },
  { icon: Megaphone, title: "Marketing Ideas", copy: "Attract customers in your local market", href: "/email", tone: "orange" },
  { icon: Users, title: "Fleet & Community Sales", copy: "HOAs, rentals, and commercial accounts", href: "/training", tone: "purple" },
  { icon: DollarSign, title: "Profitability Tips", copy: "Improve margins across departments", href: "/growth", tone: "green" },
] as const;

export function GolfCartHome({
  firstName,
  organizationName,
  data,
}: {
  firstName: string;
  organizationName: string;
  data: DashboardData;
}) {
  return (
    <div className="gc-home">
      <section className="gc-hero" aria-labelledby="gc-home-title">
        <div className="gc-hero-copy">
          <span>RunFloor AI Assistant</span>
          <h1 id="gc-home-title">Powering Golf Cart &amp; LSV Dealerships for <em>What&apos;s Next.</em></h1>
          <p>Expert guidance for sales, service, marketing, finance, and operations—powered by your approved workspace knowledge.</p>
          <div className="gc-hero-actions">
            <Link href="/assistant" className="gc-primary"><MessageCircle size={18} /> Start a conversation <ArrowRight size={17} /></Link>
            <Link href="/training"><GraduationCap size={18} /> Explore training</Link>
          </div>
        </div>
        <aside className="gc-hero-promise" aria-label="Golf cart dealership focus">
          <strong>Street legal.<br />Community ready.<br />Lifestyle driven.</strong>
          <div>
            <span><Building2 /> Neighborhoods</span>
            <span><MapPin /> Communities</span>
            <span><Users /> Lifestyle</span>
          </div>
        </aside>
      </section>

      <nav className="gc-focus-strip" aria-label="Business focus areas">
        {focusAreas.map(({ icon: Icon, title, copy, href, tone }) => (
          <Link href={href} key={title} className={`gc-focus ${tone}`}>
            <span><Icon /></span><div><strong>{title}</strong><small>{copy}</small></div><ArrowRight />
          </Link>
        ))}
      </nav>

      <div className="gc-main-grid">
        <main className="gc-main-column">
          <section className="gc-assistant-card">
            <header><span><Bot /></span><div><h2>RunFloor Golf Cart Assistant</h2><p><i /> Online <b /> Powered by {organizationName} knowledge</p></div><em><ShieldCheck /> Workspace certified</em></header>
            <div className="gc-assistant-body">
              <div className="gc-assistant-message"><span><Bot /></span><p>Hi {firstName}—I&apos;m here to help with sales, service, marketing, operations, finance, and more.<strong>What would you like to work on today?</strong></p></div>
              <div className="gc-prompt-row">
                <Link href="/comparisons"><Boxes /> Compare models</Link>
                <Link href="/email"><Mail /> Create a sales email</Link>
                <Link href="/coach"><Users /> Build a training plan</Link>
                <Link href="/dashboard/performance"><BarChart3 /> Analyze performance</Link>
              </div>
              <Link href="/assistant" className="gc-question-box"><span><MessageCircle /> Ask a question or describe what you need…</span><i><ArrowRight /></i></Link>
            </div>
          </section>

          <section className="gc-topics">
            <header><div><Zap /><span><h2>Popular Topics for Golf Cart Dealerships</h2><p>Quick access to what dealership teams ask most</p></span></div><Link href="/knowledge-base">View all topics <ArrowRight /></Link></header>
            <div>
              {topics.map(({ icon: Icon, title, copy, href, tone }) => (
                <Link href={href} key={title} className={tone}><span><Icon /></span><strong>{title}</strong><small>{copy}</small><ArrowRight /></Link>
              ))}
            </div>
          </section>

          <section className="gc-performance">
            <div><span><Sparkles /></span><div><small>Workspace momentum</small><strong>{data.metrics.questions + data.metrics.messages} assisted actions</strong><p>{data.metrics.training}% training completion across the current view.</p></div></div>
            <Link href="/dashboard/performance">Open performance <ArrowRight /></Link>
          </section>
        </main>

        <aside className="gc-side-column">
          <section className="gc-tools-card">
            <header><h2>Your Tools</h2><Link href="/dashboard">View all <ArrowRight /></Link></header>
            {tools.map(({ icon: Icon, title, copy, href, tone }) => (
              <Link href={href} key={title}><span className={tone}><Icon /></span><div><strong>{title}</strong><small>{copy}</small></div><ArrowRight /></Link>
            ))}
          </section>
          <section className="gc-promo-card">
            <div><span>Built for local growth</span><h2>More freedom.<br />Brighter communities.<br />A better tomorrow.</h2></div>
            <ul>
              <li><Check /> Street-legal guidance</li>
              <li><Check /> Neighborhood-ready expertise</li>
              <li><Check /> Connected dealership workflows</li>
              <li><Check /> Clearer paths to profit</li>
            </ul>
            <Link href="/growth">Explore growth tools <ArrowRight /></Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
