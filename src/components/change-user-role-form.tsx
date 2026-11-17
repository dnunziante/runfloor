"use client";

import { useActionState } from "react";
import { changeUserRole, type ChangeRoleState } from "@/app/admin/users/actions";

const initialState: ChangeRoleState = { error: "", success: "" };

export function ChangeUserRoleForm({ membershipId, currentRole }: { membershipId: string; currentRole: string }) {
  const [state, action, pending] = useActionState(changeUserRole, initialState);
  return <form action={action} className="user-assignment-form">
    <input type="hidden" name="membershipId" value={membershipId} />
    <select className="input" name="role" defaultValue={currentRole} aria-label="User role">
      <option value="tenant_admin">Admin</option><option value="manager">Manager</option><option value="salesperson">Sales</option>
    </select>
    <button className="btn btn-ghost" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
    {state.error ? <span className="form-error">{state.error}</span> : null}
  </form>;
}
