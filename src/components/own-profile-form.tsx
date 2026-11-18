"use client";
import { useActionState } from "react";
import { saveOwnProfile } from "@/app/admin/settings/own-profile-actions";
export function OwnProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState(saveOwnProfile, { error: "", success: "" });
  return <form action={action} className="card form-stack"><h2>My profile</h2><p>Manage your own profile and password.</p><label>Name<input className="input" name="name" defaultValue={name} required minLength={2} maxLength={120}/></label><label>Sign-in email<input className="input" value={email} readOnly type="email"/></label><label>New password (optional)<input className="input" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128}/></label><p>Leave the password blank to keep it unchanged.</p>{state.error && <p role="alert" className="form-error">{state.error}</p>}{state.success && <p role="status" className="form-success">{state.success}</p>}<button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save my profile"}</button></form>;
}
