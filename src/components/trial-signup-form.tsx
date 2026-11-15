"use client";
import { useActionState } from "react";
import { activateTrial, signupTrial } from "@/app/signup/actions";

export function TrialSignupForm({ activate = false, dealership = "", fullName = "", phone = "" }: { activate?: boolean; dealership?: string; fullName?: string; phone?: string }) {
  const [state, action, pending] = useActionState(activate ? activateTrial : signupTrial, { message: "" });
  return <form action={action} className="rv-signup-form">
    <p><small>* Required fields</small></p>
    <label><span>Dealership name <span aria-hidden="true">*</span></span><input name="dealership" autoComplete="organization" defaultValue={dealership} minLength={2} maxLength={120} required/></label>
    <label><span>Primary contact name <span aria-hidden="true">*</span></span><input name="fullName" autoComplete="name" defaultValue={fullName} minLength={2} maxLength={120} required/></label>
    {!activate && <label><span>Email address <span aria-hidden="true">*</span></span><input name="email" type="email" autoComplete="email" maxLength={254} required/></label>}
    <label>Phone number (optional)<input name="phone" type="tel" autoComplete="tel" defaultValue={phone} maxLength={40}/></label>
    {!activate && <label><span>Password <span aria-hidden="true">*</span></span><input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/><small>At least 12 characters.</small></label>}
    {state.message && <p role="status">{state.message}</p>}
    <button className="btn btn-primary" disabled={pending} type="submit">{pending ? "Please wait…" : activate ? "Activate My 7-Day Free Trial" : "Start Your 7-Day Free Trial"}</button>
    <p>No credit card required. No automatic charges.</p>
  </form>;
}
