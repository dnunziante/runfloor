"use client";

import { useActionState } from "react";
import { changeUserLocation, type ChangeLocationState } from "@/app/admin/users/actions";

type Location = { id: string; name: string };
const initialState: ChangeLocationState = { error: "", success: "" };

export function ChangeUserLocationForm({ membershipId, currentLocationId, locations }: { membershipId: string; currentLocationId: string | null; locations: Location[] }) {
  const [state, action, pending] = useActionState(changeUserLocation, initialState);
  return <form action={action} className="user-assignment-form">
    <input type="hidden" name="membershipId" value={membershipId} />
    <select className="input" name="locationId" defaultValue={currentLocationId || ""} aria-label="User location">
      <option value="">No location</option>
      {locations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}
    </select>
    <button className="btn btn-ghost" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
    {state.error ? <span className="form-error">{state.error}</span> : null}
  </form>;
}
