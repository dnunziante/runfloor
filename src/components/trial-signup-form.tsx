"use client";
import { useActionState, useState } from "react";
import { activateTrial, signupTrial } from "@/app/signup/actions";
import { startPaidSignupCheckout } from "@/app/signup/paid-actions";
import { startPaidSoloSignupCheckout } from "@/app/signup/solo-paid-actions";

export function TrialSignupForm({ activate = false, dealership = "", fullName = "", phone = "", plan = "sales_solo", soloEnabled = false, freeEnabled = false }: { activate?: boolean; dealership?: string; fullName?: string; phone?: string; plan?: string; soloEnabled?: boolean; freeEnabled?:boolean }) {
  const [selectedPlan, setSelectedPlan] = useState(plan);
  const [state, action, pending] = useActionState(activate ? activateTrial : signupTrial, { message: "" });
  return <form action={action} className="rv-signup-form">
    <p><small>* Required fields</small></p>
    <label>Plan<select className="input" name="plan" value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}><option value="sales_solo_free" disabled={!freeEnabled}>RunFloor Free — $0, inventory and comparisons{!freeEnabled ? " (not yet available)" : ""}</option><option value="sales_solo" disabled={!soloEnabled}>RunFloor Solo — $25/month, one Sales user{!soloEnabled ? " (not yet available)" : ""}</option><option value="complete">RunFloor Complete — 7-day trial, then $99/month per location</option></select></label>
    {selectedPlan === "sales_solo_free" && <p>One user. Browse the shared catalog and compare stored specifications. No AI, card, subscription, or trial expiration.</p>}
    {selectedPlan === "sales_solo" && <p>RunFloor Solo is $25/month, charged at checkout. After payment is confirmed, your personal Sales workspace opens with 500 monthly AI credits. No free activation or trial on Solo.</p>}
    <label><span>Workspace or dealership name <span aria-hidden="true">*</span></span><input name="dealership" autoComplete="organization" defaultValue={dealership} minLength={2} maxLength={120} required/></label>
    <label><span>Primary contact name <span aria-hidden="true">*</span></span><input name="fullName" autoComplete="name" defaultValue={fullName} minLength={2} maxLength={120} required/></label>
    {!activate && <label><span>Email address <span aria-hidden="true">*</span></span><input name="email" type="email" autoComplete="email" maxLength={254} required/></label>}
    <label>Phone number (optional)<input name="phone" type="tel" autoComplete="tel" defaultValue={phone} maxLength={40}/></label>
    {!activate && <label><span>Password <span aria-hidden="true">*</span></span><input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/><small>At least 12 characters.</small></label>}
    {state.message && <p role="status">{state.message}</p>}
    {!(activate && selectedPlan === "sales_solo") && <button className="btn btn-primary" disabled={pending || (selectedPlan === "sales_solo_free" && !freeEnabled) || (selectedPlan === "sales_solo" && !soloEnabled)} type="submit">{pending ? "Please wait…" : selectedPlan === "sales_solo_free" ? "Create My Free RunFloor Account" : selectedPlan === "sales_solo" ? activate ? "Continue to Solo checkout" : "Create account to continue to checkout" : activate ? "Activate My 7-Day Free Trial" : "Start Your 7-Day Free Trial"}</button>}
    {activate && selectedPlan === "sales_solo" && <><button className="btn btn-primary" type="submit" formAction={startPaidSoloSignupCheckout} disabled={!soloEnabled}>Pay $25/month and create my Solo workspace</button><p>Stripe securely collects payment. The workspace opens only after payment is confirmed.</p></>}
    {activate && selectedPlan === "complete" && <><button className="btn" type="submit" formAction={startPaidSignupCheckout}>Pay $99 now and create my workspace</button><p>Stripe charges $99 today. After payment is confirmed, RunFloor creates your dealership workspace and makes you its administrator.</p></>}
    <p>{selectedPlan === "sales_solo_free" ? "Free forever. No credit card required. No AI included." : selectedPlan === "sales_solo" ? activate ? "Monthly subscription. Cancel anytime. Workspace access starts after confirmed payment." : "Verify your email first, then complete checkout for $25/month." : "No credit card required for the 7-day Complete trial. No automatic charges."}</p>
  </form>;
}
