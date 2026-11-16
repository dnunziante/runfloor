"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, LockKeyhole } from "lucide-react";
import { savePositionPermissions } from "@/app/admin/settings/roles/actions";
import { canEditPosition, defaultPermissions, permissionDefinitions, positions, positionLabels, type PermissionMatrix, type Position } from "@/lib/auth/role-permissions";
import type { AppRole } from "@/lib/auth/viewer";
import styles from "./role-permissions-editor.module.css";

function PositionCard({ position, matrix, actor, readOnly }: { position: Position; matrix: PermissionMatrix; actor: AppRole; readOnly: boolean }) {
  const saved = matrix[position];
  const [selected, setSelected] = useState(saved.permissions);
  const [state, action, pending] = useActionState(savePositionPermissions, { error: "", success: "" });
  const router = useRouter();
  const defaults = defaultPermissions(position);
  const editable = !readOnly && canEditPosition(actor, position);
  const dirty = permissionDefinitions.some(p => selected[p.key] !== saved.permissions[p.key]);
  useEffect(() => { if (state.success) router.refresh(); }, [state.success, router]);
  return <form action={action} className={styles.card}>
    <header><ShieldCheck size={22}/><div><h2>{positionLabels[position]}</h2><small>{position === "tenant_admin" ? "Configure every position" : position === "manager" ? "Manage Manager and Sales access" : "Cannot change role permissions"}</small></div></header>
    <input type="hidden" name="position" value={position}/>
    <input type="hidden" name="revision" value={saved.revision}/>
    <input type="hidden" name="permissions" value={JSON.stringify(selected)}/>
    {permissionDefinitions.map((permission, index) => {
      const unavailable = !defaults[permission.key];
      const ceilingLocked = actor === "manager" && !matrix.manager.permissions[permission.key];
      const locked = !editable || unavailable || (ceilingLocked && !selected[permission.key]) || pending;
      return <div key={permission.key}>
        {(index === 0 || permissionDefinitions[index - 1].section !== permission.section) && <h3 className={styles.section}>{permission.section}</h3>}
        <label className={`${styles.permission} ${locked ? styles.locked : ""}`}>
          <input type="checkbox" checked={selected[permission.key]} disabled={locked} aria-label={`${positionLabels[position]}: ${permission.label}`} onChange={event => setSelected(current => ({ ...current, [permission.key]: event.target.checked }))}/>
          <span>{permission.label}{defaults[permission.key] && <span className={styles.asterisk} title="Included in this role by default"> *</span>}{unavailable && <small>{permission.key === "executive" ? "Admin or Manager access" : "Admin-only access"}</small>}</span>
          {(unavailable || ceilingLocked) && <LockKeyhole size={13} aria-hidden="true"/>}
        </label>
      </div>;
    })}
    <div className={styles.controls}>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {state.success && <p className="form-success" role="status">{state.success}</p>}
      {editable ? <><button className="btn btn-primary" disabled={pending || !dirty}>{pending ? "Saving…" : `Save ${positionLabels[position]} permissions`}</button><button className="btn btn-ghost" type="button" disabled={pending || !dirty} onClick={() => setSelected(saved.permissions)}>Discard changes</button></> : <p>{readOnly ? "Read-only preview" : "View only"}</p>}
    </div>
  </form>;
}

export function RolePermissionsEditor({ matrix, actor, readOnly, error }: { matrix: PermissionMatrix; actor: AppRole; readOnly: boolean; error: string }) {
  return <>
    <div className={styles.notice}><p><strong>* Included by default.</strong> Asterisks mark the standard role permissions, even after a checkbox is changed. Changes apply to everyone in that position within this workspace.</p><p>Admins can edit all positions. Managers can edit Manager and Sales permissions within their current access. Sales users can view this page but cannot make changes. Protected role limits and platform-owner controls stay in place.</p><p>Removing your own Manager access requires an Admin to restore it after saving. Role-management access itself cannot be revoked here.</p></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className={styles.grid}>{positions.map(position => <PositionCard key={`${position}-${matrix[position].revision}`} position={position} matrix={matrix} actor={actor} readOnly={readOnly}/>)}</div>
  </>;
}
