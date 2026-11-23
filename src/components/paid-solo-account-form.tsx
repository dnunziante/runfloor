"use client";

import { useActionState } from "react";
import { completePaidSoloSignup } from "@/app/signup/solo-complete/actions";

export function PaidSoloAccountForm({ intent, sessionId, email, fullName = "", phone = "" }: {
  intent: string; sessionId: string; email: string; fullName?: string; phone?: string;
}) {
  const [state, action, pending] = useActionState(completePaidSoloSignup, { message: "" });
  return <form action={action} className="rv-signup-form">
    <input type="hidden" name="intent" value={intent}/>
    <input type="hidden" name="session_id" value={sessionId}/>
    <input type="hidden" name="email" value={email}/>
    <label><span>Name</span><input name="fullName" autoComplete="name" defaultValue={fullName} maxLength={120}/></label>
    <label><span>Email used at checkout</span><input value={email} readOnly autoComplete="email"/></label>
    <label><span>Create a password <span aria-hidden="true">*</span></span><input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/><small>At least 12 characters.</small></label>
    <input type="hidden" name="phone" value={phone}/>
    {state.message && <p role="alert">{state.message}</p>}
    <button className="btn btn-primary" disabled={pending} type="submit">{pending ? "Securing your account…" : "Create account and finish setup"}</button>
  </form>;
}
