"use client";
import { useActionState } from "react";
import { activateTrial, signupTrial } from "@/app/signup/actions";

export function TrialSignupForm({ activate = false, dealership = "", fullName = "" }: { activate?: boolean; dealership?: string; fullName?: string }) {
  const [state, action, pending] = useActionState(activate ? activateTrial : signupTrial, { message: "" });
  return <form action={action} className="rv-signup-form">
    <label>Dealership name<input name="dealership" autoComplete="organization" defaultValue={dealership} minLength={2} maxLength={120} required/></label>
    <label>Primary contact name<input name="fullName" autoComplete="name" defaultValue={fullName} minLength={2} maxLength={120} required/></label>
    {!activate && <><label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required/></label><label>Password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/><small>At least 12 characters.</small></label></>}
    {state.message && <p role="status">{state.message}</p>}
    <button className="btn btn-primary" disabled={pending} type="submit">{pending ? "Please wait…" : activate ? "Activate My 7-Day Free Trial" : "Start Your 7-Day Free Trial"}</button>
    <p>No credit card required. No automatic charges.</p>
  </form>;
}
