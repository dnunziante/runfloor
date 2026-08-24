"use client";

import { useActionState, useMemo, useState } from "react";
import { removeUserFromWorkspace, updateUserCredentials, type RemoveUserState, type UpdateCredentialsState } from "@/app/admin/users/actions";
import { ChangeUserLocationForm } from "@/components/change-user-location-form";
import { ChangeUserRoleForm } from "@/components/change-user-role-form";

export type UserRow = {
  id: string;
  kind: "member" | "invitation";
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  organizationId: string;
  organizationName: string;
  locationId: string | null;
  locationName: string;
  role: string;
  status: string;
};
type Location = { id: string; name: string; organizationId: string };
type Tenant = { id: string; name: string };

const roleLabel = (role: string) => role === "tenant_admin" ? "Admin" : role === "manager" ? "Manager" : "Employee";
const statusLabel = (status: string) => status === "pending" || status === "invited" ? "Invitation Pending" : status === "suspended" ? "Disabled" : "Active";
const initialCredentialsState: UpdateCredentialsState = { error: "", success: "" };
const initialRemoveState: RemoveUserState = { error: "", success: "" };

function RemoveUserForm({ membershipId }: { membershipId: string }) {
  const [state, action, pending] = useActionState(removeUserFromWorkspace, initialRemoveState);
  return <form action={action} onSubmit={(event) => { if (!window.confirm("Remove this user from the workspace? Their account will not be deleted.")) event.preventDefault(); }}><input type="hidden" name="membershipId" value={membershipId}/><button className="btn btn-ghost" type="submit" disabled={pending}>{pending ? "Removing…" : "Remove"}</button>{state.error && <span className="form-error">{state.error}</span>}</form>;
}

function EditCredentialsForm({ user, close }: { user: UserRow; close: () => void }) {
  const [state, action, pending] = useActionState(updateUserCredentials, initialCredentialsState);
  return <form action={action} className="edit-credentials-form">
    <input name="membershipId" type="hidden" value={user.id} />
    <div className="edit-credentials-heading"><div><span className="eyebrow">User credentials</span><h2>Edit {user.name}</h2></div><button aria-label="Close credential editor" className="credential-close" onClick={close} type="button">×</button></div>
    <div className="grid grid-2">
      <label><span className="label">First name</span><input className="input" defaultValue={user.firstName} name="firstName" required /></label>
      <label><span className="label">Last name</span><input className="input" defaultValue={user.lastName} name="lastName" /></label>
    </div>
    <label><span className="label">Email</span><input autoComplete="off" className="input" defaultValue={user.email} name="email" required type="email" /></label>
    <label><span className="label">Phone</span><input autoComplete="off" className="input" defaultValue={user.phone} name="phone" type="tel" /></label>
    <label><span className="label">New password <small>Optional</small></span><input autoComplete="new-password" className="input" minLength={8} name="password" placeholder="Leave blank to keep the current password" type="password" /></label>
    <p className="credential-warning">Changing the email changes the address this user enters at sign-in. Setting a password takes effect immediately.</p>
    {state.error ? <p aria-live="polite" className="form-error">{state.error}</p> : null}
    {state.success ? <p aria-live="polite" className="form-success">{state.success}</p> : null}
    <div className="edit-credentials-actions"><button className="btn btn-ghost" onClick={close} type="button">Cancel</button><button className="btn btn-primary" disabled={pending} type="submit">{pending ? "Saving..." : "Save credentials"}</button></div>
  </form>;
}

export function UsersManagementTable({ users, locations, tenants, canManage, isPlatformOwner }: { users: UserRow[]; locations: Location[]; tenants: Tenant[]; canManage: boolean; isPlatformOwner: boolean }) {
  const [search, setSearch] = useState("");
  const [tenantId, setTenantId] = useState("all");
  const [locationId, setLocationId] = useState("all");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const visibleLocations = locations.filter((location) => !isPlatformOwner || tenantId === "all" || location.organizationId === tenantId);
  const results = useMemo(() => users.filter((user) => {
    const query = search.trim().toLowerCase();
    return (!query || `${user.name} ${user.email}`.toLowerCase().includes(query))
      && (!isPlatformOwner || tenantId === "all" || user.organizationId === tenantId)
      && (locationId === "all" || user.locationId === locationId)
      && (role === "all" || user.role === role)
      && (status === "all" || user.status === status);
  }), [users, search, tenantId, locationId, role, status, isPlatformOwner]);

  function changeTenant(value: string) { setTenantId(value); setLocationId("all"); }

  return <section className="card users-management-card" style={{ marginTop: 18 }}>
    <div className="users-management-heading"><div><h2>Users</h2><p>Search, filter, and manage access for {isPlatformOwner ? "every tenant" : "this workspace"}.</p></div><strong>{results.length} shown</strong></div>
    <div className="user-filters">
      <label className="user-search"><span>Search</span><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or email" /></label>
      {isPlatformOwner ? <label><span>Tenant</span><select className="input" value={tenantId} onChange={(event) => changeTenant(event.target.value)}><option value="all">All Tenants</option>{tenants.map((tenant) => <option value={tenant.id} key={tenant.id}>{tenant.name}</option>)}</select></label> : null}
      <label><span>Location</span><select className="input" value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="all">All Locations</option>{visibleLocations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}</select></label>
      <label><span>Role</span><select className="input" value={role} onChange={(event) => setRole(event.target.value)}><option value="all">All Roles</option><option value="tenant_admin">Admin</option><option value="manager">Manager</option><option value="salesperson">Employee</option></select></label>
      <label><span>Status</span><select className="input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All Users</option><option value="active">Active</option><option value="pending">Invitation Pending</option><option value="suspended">Disabled</option></select></label>
    </div>
    <div className="table-wrap users-table-wrap"><table className="table users-table"><thead><tr><th>Name</th>{isPlatformOwner ? <th>Tenant</th> : null}<th>Email</th><th>Phone</th><th>Location</th><th>Role</th><th>Status</th><th>Credentials</th><th>Access</th></tr></thead><tbody>{results.map((user) => <tr key={`${user.kind}-${user.id}`}><td data-label="Name"><strong>{user.name || "—"}</strong></td>{isPlatformOwner ? <td data-label="Tenant">{user.organizationName}</td> : null}<td data-label="Email"><a className="user-email" href={`mailto:${user.email}`}>{user.email}</a></td><td data-label="Phone">{user.phone || "—"}</td><td data-label="Location">{user.kind === "member" && canManage ? <ChangeUserLocationForm membershipId={user.id} currentLocationId={user.locationId} locations={locations.filter((location) => location.organizationId === user.organizationId)} /> : user.locationName}</td><td data-label="Role">{user.kind === "member" && canManage ? <ChangeUserRoleForm membershipId={user.id} currentRole={user.role} /> : roleLabel(user.role)}</td><td data-label="Status"><span className={`badge ${user.status === "pending" ? "amber" : user.status === "suspended" ? "disabled" : ""}`}>{statusLabel(user.status)}</span></td><td data-label="Credentials">{user.kind === "member" && canManage ? <button className="btn btn-ghost credential-edit-button" onClick={() => setEditingUser(user)} type="button">Edit</button> : "—"}</td><td data-label="Access">{user.kind === "member" && canManage && user.status === "active" ? <RemoveUserForm membershipId={user.id}/> : "—"}</td></tr>)}{results.length === 0 ? <tr><td colSpan={isPlatformOwner ? 9 : 8} className="users-empty">No users match these filters.</td></tr> : null}</tbody></table></div>
    {editingUser ? <div aria-label={`Edit credentials for ${editingUser.name}`} aria-modal="true" className="credential-modal" role="dialog"><button aria-label="Close credential editor" className="credential-modal-backdrop" onClick={() => setEditingUser(null)} type="button" /><div className="credential-modal-panel"><EditCredentialsForm close={() => setEditingUser(null)} key={editingUser.id} user={editingUser} /></div></div> : null}
  </section>;
}
