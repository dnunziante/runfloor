"use client";
import { useActionState, useState } from "react";
import { activateTrial, signupTrial } from "@/app/signup/actions";
import { startPaidSignupCheckout } from "@/app/signup/paid-actions";

export function TrialSignupForm({ activate = false, dealership = "", fullName = "", phone = "", plan = "complete", soloEnabled = false, freeEnabled = false }: { activate?: boolean; dealership?: string; fullName?: string; phone?: string; plan?: string; soloEnabled?: boolean; freeEnabled?:boolean }) {
  const [selectedPlan, setSelectedPlan] = useState(plan);
  const [state, action, pending] = useActionState(activate ? activateTrial : signupTrial, { message: "" });
  return <form action={action} className="rv-signup-form">
    <p><small>* Required fields</small></p>
    <label>Plan<select className="input" name="plan" value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}><option value="sales_solo_free" disabled={!freeEnabled}>RunFloor Free — $0, inventory and comparisons{!freeEnabled ? " (not yet available)" : ""}</option><option value="complete">RunFloor Complete — 7-day trial, then $99/month per location</option><option value="sales_solo" disabled={!soloEnabled}>RunFloor Solo — $25/month, one user{!soloEnabled ? " (not yet available)" : ""}</option></select></label>
    {selectedPlan === "sales_solo_free" && <p>One user. Browse the shared catalog and compare stored specifications. No AI, card, subscription, or trial expiration.</p>}
    {selectedPlan === "sales_solo" && <p>Sales only. Includes 500 AI credits each paid month. Free catalog and comparison access remains available before payment. No automatic overages.</p>}
    <label><span>Dealership name <span aria-hidden="true">*</span></span><input name="dealership" autoComplete="organization" defaultValue={dealership} minLength={2} maxLength={120} required/></label>
    <label><span>Primary contact name <span aria-hidden="true">*</span></span><input name="fullName" autoComplete="name" defaultValue={fullName} minLength={2} maxLength={120} required/></label>
    {!activate && <label><span>Email address <span aria-hidden="true">*</span></span><input name="email" type="email" autoComplete="email" maxLength={254} required/></label>}
    <label>Phone number (optional)<input name="phone" type="tel" autoComplete="tel" defaultValue={phone} maxLength={40}/></label>
    {!activate && <label><span>Password <span aria-hidden="true">*</span></span><input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/><small>At least 12 characters.</small></label>}
    {state.message && <p role="status">{state.message}</p>}
    <button className="btn btn-primary" disabled={pending || (selectedPlan === "sales_solo_free" && !freeEnabled) || (selectedPlan === "sales_solo" && !soloEnabled)} type="submit">{pending ? "Please wait…" : selectedPlan === "sales_solo_free" ? "Create My Free RunFloor Account" : selectedPlan === "sales_solo" ? activate ? "Create My RunFloor Solo Account" : "Create My RunFloor Solo Login" : activate ? "Activate My 7-Day Free Trial" : "Start Your 7-Day Free Trial"}</button>
    {activate && selectedPlan === "complete" && <><button className="btn" type="submit" formAction={startPaidSignupCheckout}>Pay $99 now and create my workspace</button><p>Stripe charges $99 today. After payment is confirmed, RunFloor creates your dealership workspace and makes you its administrator.</p></>}
    <p>{selectedPlan === "sales_solo_free" ? "Free forever. No credit card required. No AI included." : selectedPlan === "sales_solo" ? "Paid Solo access starts only after confirmed payment. Live payments remain disabled." : "No credit card required for the 7-day trial. No automatic charges."}</p>
  </form>;
}
