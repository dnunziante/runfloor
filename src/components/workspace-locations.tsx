"use client";
import { createContext, useContext } from "react";
export const WorkspaceLocations = createContext<string[]>([]);
export function WorkspaceLocationOptions() {
 const names = useContext(WorkspaceLocations);
 return <>{names.map(name => <option key={name}>{name}</option>)}<option>All locations</option></>;
}

export function RecordLocationOptions({ recordNames }: { recordNames: string[] }) {
 const active = useContext(WorkspaceLocations);
 const names = Array.from(new Set([...active,...recordNames])).filter(name => name && name !== "All locations");
 return <>{names.map(name => <option value={name} key={name}>{name}{active.length && !active.includes(name) ? " (previous location)" : ""}</option>)}</>;
}
