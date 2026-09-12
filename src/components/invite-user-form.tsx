"use client";

import { useActionState, useState } from "react";
import { inviteUser, type InviteUserState } from "@/app/admin/users/actions";

type Location = { id: string; name: string; organizationId: string };
type Tenant = { id: string; name: string };
const initialState: InviteUserState = { error: "", success: "" };

export function InviteUserForm({ locations, tenants, canInvite, isPlatformOwner }: { locations: Location[]; tenants: Tenant[]; canInvite: boolean; isPlatformOwner: boolean }) {
  const [state, action, pending] = useActionState(inviteUser, initialState);
  const [organizationId, setOrganizationId] = useState("");
  const [role, setRole] = useState("salesperson");
  if (!canInvite) return null;

  return <form action={action} className="card" style={{ marginTop: 18 }}>
    <h2>Invite a team member</h2>
    <p>New users receive a secure invitation. Existing RunFloor users are added directly to the selected tenant without creating another account.</p>
    <div className="form-grid">
      <label>First Name<input className="input" name="firstName" required /></label>
      <label>Last Name<input className="input" name="lastName" required /></label>
      <label>Phone<input className="input" name="phone" type="tel" required placeholder="843-555-1234" /></label>
      <label>Email Address<input className="input" name="email" type="email" required placeholder="name@company.com" /></label>
      {isPlatformOwner ? <label>Tenant<select className="input" name="organizationId" required value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="" disabled>Select a tenant</option>{tenants.map((tenant) => <option value={tenant.id} key={tenant.id}>{tenant.name}</option>)}</select></label> : null}
      <label>Role<select className="input" name="role" value={role} onChange={(event) => setRole(event.target.value)}>{isPlatformOwner ? <option value="tenant_admin">Admin</option> : null}<option value="manager">Manager</option><option value="salesperson">Employee</option></select></label>
      <label>Location<select className="input" name="locationId" required={role !== "tenant_admin"} defaultValue="" disabled={isPlatformOwner && !organizationId}><option value="">{isPlatformOwner && !organizationId ? "Select a tenant first" : role === "tenant_admin" ? "No location (all locations)" : "Select a location"}</option>{locations.filter((location) => !isPlatformOwner || location.organizationId === organizationId).map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}</select></label>
    </div>
    {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
    {state.success ? <p className="form-success" role="status">{state.success}</p> : null}
    <button className="btn btn-primary" type="submit" disabled={pending || locations.length === 0}>{pending ? "Sending invitation…" : "Send invitation"}</button>
  </form>;
}
