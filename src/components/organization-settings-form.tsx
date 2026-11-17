"use client";

import { useActionState } from "react";
import { saveOrganizationSettings, type OrganizationSettingsActionState } from "@/app/admin/settings/actions";
import type { OrganizationLocation } from "@/lib/locations";
import type { OrganizationSettings } from "@/lib/organizations/settings";

const initialState: OrganizationSettingsActionState = { error: "", success: "" };

export function OrganizationSettingsForm({ settings, locations, canSave }: { settings: OrganizationSettings; locations: OrganizationLocation[]; canSave: boolean }) {
  const [state, action, pending] = useActionState(saveOrganizationSettings, initialState);
  return <form className="card form-stack" style={{ maxWidth: 760 }} action={action}>
    <div className="grid grid-2">
      <label><span className="label">Company name</span><input className="input" name="displayName" defaultValue={settings.displayName} required minLength={2} maxLength={120} disabled={!canSave} /></label>
      <label><span className="label">Primary color</span><input className="input" name="primaryColor" defaultValue={settings.primaryColor} pattern="#[0-9A-Fa-f]{6}" maxLength={7} disabled={!canSave} /></label>
      <label><span className="label">Contact email</span><input className="input" name="contactEmail" type="email" defaultValue={settings.contactEmail} maxLength={254} disabled={!canSave} /></label>
      <label><span className="label">Default location</span><select className="input" name="defaultLocationId" defaultValue={settings.defaultLocationId} disabled={!canSave}><option value="">No default location</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
    </div>
    <section className="callout"><strong>Knowledge Base</strong><p>Information the AI can use as company facts. Manage documents in Knowledge Base. AI communication behavior is managed separately in AI Communication Standards.</p></section>
    {!canSave && <p className="demo-note">Sign in as a workspace administrator to save organization settings to the shared workspace.</p>}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    {state.success && <p className="form-success" role="status">{state.success}</p>}
    <button className="btn btn-primary" type="submit" disabled={!canSave || pending}>{pending ? "Saving…" : "Save shared settings"}</button>
  </form>;
}
