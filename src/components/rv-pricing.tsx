import Link from "next/link";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import "./rv-pricing.css";

const features = ["Unlimited Users — No Per-User Fees", "2,000 AI Credits Included Monthly", "AI Sales Assistant", "Operations & Task Management", "Product Knowledge & Comparisons", "Conversations & Messaging", "Reporting & Performance Insights"];
const faqs = [
  ["How much does RunFloor cost?", "RunFloor Complete costs $99 per month per dealership location."],
  ["How many employees can use RunFloor?", "Unlimited employees can access RunFloor at each subscribed location without additional per-user fees."],
  ["What's included in the free trial?", "The 7-day free trial includes access to RunFloor Complete features, unlimited users, and 100 AI credits shared by your location."],
  ["Do I need a credit card to start?", "No. You can start your 7-day trial without entering payment information. There are no automatic charges or automatic paid subscriptions."],
  ["What happens when my trial ends?", "Your trial access ends unless you choose to subscribe. Your dealership information is preserved so you can upgrade without starting over."],
  ["How many AI credits are included?", "Paid subscriptions include 2,000 AI credits per month per location. Additional credit packs are a separate purchase when available in billing."],
  ["Can I cancel anytime?", "Yes. RunFloor is billed monthly with no long-term commitment. Cancellation takes effect at the end of the current paid billing period."],
  ["Do unused monthly credits roll over?", "No. Included monthly credits expire at the end of each billing period. Purchased credit packs are managed separately."],
];

export function RvPricing() {
  return <section className="rv-pricing" id="pricing" aria-labelledby="pricing-title">
    <header><p className="lp-kicker">SIMPLE. TRANSPARENT. BUILT TO SCALE.</p><h2 id="pricing-title">One location.<br/><em>Unlimited potential.</em></h2><p>Everything your dealership needs. One predictable monthly price.</p></header>
    <article className="rv-price-card"><p className="rv-plan-name">RUNFLOOR COMPLETE</p><p className="rv-price"><strong>$99</strong><span>/ month<br/><small>per location</small></span></p><p className="rv-price-promise">Pay Monthly. Cancel Anytime.</p><ul>{features.map(feature => <li key={feature}><Check aria-hidden="true"/><span>{feature}</span></li>)}</ul><p className="rv-price-extra">Need more AI power? Additional credit packs are available.</p><Link className="lp-button rv-trial-link" href="/signup">Start Your 7-Day Free Trial <ArrowRight aria-hidden="true"/></Link><p className="rv-price-trust">No Credit Card Required • Unlimited Users • Cancel Anytime</p><Link className="rv-price-demo" href="/demo">Explore the platform demo <ArrowRight size={15}/></Link></article>
    <div className="rv-price-faq"><h3>A few things you might be wondering.</h3>{faqs.map(([question,answer]) => <details key={question}><summary>{question}<ChevronDown aria-hidden="true"/></summary><p>{answer}</p></details>)}</div>
  </section>;
}
