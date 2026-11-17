"use client";

import { useActionState } from "react";
import { addLocation, type AddLocationState } from "@/app/admin/settings/actions";

const initialState: AddLocationState = { error: "", success: "" };

export function AddLocationForm({ canAdd }: { canAdd: boolean }) {
  const [state, action, pending] = useActionState(addLocation, initialState);
  if (!canAdd) return null;
  return <section className="card form-stack settings-section" id="add-location" style={{ marginTop: 18 }}>
    <div><span className="eyebrow">Workspace locations</span><h2>Add a location</h2><p>Only Admins can add locations. New locations are saved for this workspace and become available in team and operational controls.</p></div>
    <form action={action} className="form-grid">
      <label>Location name<input className="input" name="name" required minLength={2} maxLength={120} placeholder="Example: Main showroom" /></label>
      <label>City <span style={{ fontWeight: 400 }}>(optional)</span><input className="input" name="city" maxLength={120} placeholder="Greenville" /></label>
      <label>State <span style={{ fontWeight: 400 }}>(optional)</span><input className="input" name="state" maxLength={40} placeholder="SC" /></label>
      <div style={{ alignSelf: "end" }}><button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Adding…" : "Add location"}</button></div>
    </form>
    {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
    {state.success ? <p className="form-success" role="status">{state.success}</p> : null}
  </section>;
}
