import { ArrowRight, ChevronDown } from "lucide-react";
import { FeatureLink as Link } from "@/components/feature-link";
import { BrandLogo } from "@/components/brand-logo";
import "@/app/home-account-actions.css";

export function PublicHeader({ home = false, sticky = false }: { home?: boolean; sticky?: boolean }) {
  const section = (id: string) => `${home ? "" : "/"}#${id}`;
  return <header className={`lp-nav${sticky ? " lp-nav-sticky" : ""}`}>
    <Link href="/" aria-label="RunFloor home"><BrandLogo priority/></Link>
    <nav aria-label="Main navigation">
      <details><summary>Platform <ChevronDown/></summary><div><a href={section("platform")}>Platform overview</a><a href={section("solutions")}>Solutions</a></div></details>
      <details><summary>Solutions <ChevronDown/></summary><div><Link href="/assistant">Sales Assistant</Link><Link href="/operations">Operations</Link><Link href="/coach">Coaching</Link><Link href="/executive">Executive</Link></div></details>
      <a href={section("resources")}>Resources</a><a href={section("pricing")}>Pricing</a>
    </nav>
    <div className="lp-account-actions"><Link href="/demo">View Demo</Link><Link className="lp-button lp-login" href="/login">Log In <ArrowRight/></Link><Link className="lp-button" href="/signup">Sign Up</Link></div>
  </header>;
}
