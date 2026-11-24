"use client";
import { useActionState, useEffect, useState } from "react";
import { activateTrial, signupTrial } from "@/app/signup/actions";
import { startPaidSignupCheckout } from "@/app/signup/paid-actions";
import { startPaidSoloSignupCheckout } from "@/app/signup/solo-paid-actions";

export function TrialSignupForm({ activate = false, dealership = "", fullName = "", phone = "", plan = "sales_solo", soloEnabled = false, freeEnabled = false }: { activate?: boolean; dealership?: string; fullName?: string; phone?: string; plan?: string; soloEnabled?: boolean; freeEnabled?: boolean }) {
  const [selectedPlan, setSelectedPlan] = useState(plan);
  const [state, action, pending] = useActionState(activate ? activateTrial : signupTrial, { message: "" });\n  useEffect(() => { if (state.analyticsEvent) window.dispatchEvent(new CustomEvent("runfloor:analytics", { detail: { name: state.analyticsEvent } })); }, [state.analyticsEvent]);
  return <form action={action} className="rv-signup-form">
    <p><small>* Required fields</small></p>
    <label>Plan<select className="input" name="plan" value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}>
      <option value="sales_solo_free" disabled={!freeEnabled}>RunFloor Free — $0, inventory and comparisons{!freeEnabled ? " (not yet available)" : ""}</option>
      <option value="sales_solo" disabled={!soloEnabled}>RunFloor Solo — $25/month, one Sales user{!soloEnabled ? " (not yet available)" : ""}</option>
      <option value="complete">RunFloor Complete — 7-day trial, then $99/month per location</option>
    </select></label>
    {selectedPlan === "sales_solo_free" && <p>One user. Browse the shared catalog and compare stored specifications. No AI, card, subscription, or trial expiration.</p>}
    {selectedPlan === "sales_solo" && <p>RunFloor Solo is $25/month. You’ll pay securely through Stripe first, then create your account. Your Sales workspace opens after payment is confirmed. No free activation or trial on Solo.</p>}
    <label><span>Workspace or dealership name <span aria-hidden="true">*</span></span><input name="dealership" autoComplete="organization" defaultValue={dealership} minLength={2} maxLength={120} required/></label>
    <label><span>Primary contact name <span aria-hidden="true">*</span></span><input name="fullName" autoComplete="name" defaultValue={fullName} minLength={2} maxLength={120} required/></label>
    {!activate && <label><span>Email address <span aria-hidden="true">*</span></span><input name="email" type="email" autoComplete="email" maxLength={254} required/></label>}
    <label>Phone number (optional)<input name="phone" type="tel" autoComplete="tel" defaultValue={phone} maxLength={40}/></label>
    {!activate && selectedPlan !== "sales_solo" && <label><span>Password <span aria-hidden="true">*</span></span><input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/><small>At least 12 characters.</small></label>}
    {state.message && <p role="status">{state.message}</p>}
    {!activate && selectedPlan === "sales_solo" && <button className="btn btn-primary" disabled={pending || !soloEnabled} type="submit" formAction={startPaidSoloSignupCheckout}>{pending ? "Opening Stripe Checkout…" : "Continue to secure $25/month checkout"}</button>}
    {!(activate && selectedPlan === "sales_solo") && !( !activate && selectedPlan === "sales_solo") && <button className="btn btn-primary" disabled={pending || (selectedPlan === "sales_solo_free" && !freeEnabled) || (selectedPlan === "sales_solo" && !soloEnabled)} type="submit">{pending ? "Please wait…" : selectedPlan === "sales_solo_free" ? "Create My Free RunFloor Account" : selectedPlan === "sales_solo" ? "Continue to Solo checkout" : activate ? "Activate My 7-Day Free Trial" : "Start Your 7-Day Free Trial"}</button>}
    {activate && selectedPlan === "sales_solo" && <><button className="btn btn-primary" type="submit" formAction={startPaidSoloSignupCheckout} disabled={!soloEnabled}>Pay $25/month and continue to checkout</button><p>Stripe securely collects payment first. Create your account after checkout; workspace access starts after payment is confirmed.</p></>}
    {activate && selectedPlan === "complete" && <><button className="btn" type="submit" formAction={startPaidSignupCheckout}>Pay $99 now and create my workspace</button><p>Stripe charges $99 today. After payment is confirmed, RunFloor creates your dealership workspace and makes you its administrator.</p></>}
    <p>{selectedPlan === "sales_solo_free" ? "Free forever. No credit card required. No AI included." : selectedPlan === "sales_solo" ? activate ? "Monthly subscription. Cancel anytime. Workspace access starts after confirmed payment." : "Stripe Checkout comes first; account creation follows payment." : "No credit card required for the 7-day Complete trial. No automatic charges."}</p>
  </form>;
}
