"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProductFamily } from "@/app/admin/products/actions";

export function CompetitorFamilyForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <form className="card form-stack" style={{ marginBottom: 18 }} onSubmit={async (event) => {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") || "");
    setPending(true); setError("");
    try {
      const result = await createProductFamily(name, true);
      if (result.error) setError(result.error);
      else { router.push(`/admin/competitors?family=${result.familyId}`); router.refresh(); }
    } catch { setError("The brand family could not be created. Please try again."); }
    finally { setPending(false); }
  }}>
    <h2>Add competitor brand family</h2>
    <label><span className="label">Brand name</span><input className="input" name="name" required minLength={2} maxLength={120} placeholder="Enter competitor brand"/></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="btn btn-primary" disabled={pending}>{pending ? "Creating…" : "Create brand family"}</button>
  </form>;
}
