import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

export default async function CompetitorCandidatePreview({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  const id = (await params).id;
  const supabase = await createClient();
  const { data: candidate } = viewer?.organizationId
    ? await supabase
        .from("competitor_sync_candidates")
        .select("id,classification,source_url,extracted_product,field_changes,created_at")
        .eq("id", id)
        .eq("organization_id", viewer.organizationId)
        .maybeSingle()
    : { data: null };

  if (!candidate) notFound();
  const product = (candidate.extracted_product || {}) as Record<string, unknown>;
  const changes = (candidate.field_changes || {}) as Record<string, unknown>;

  const price = typeof product.priceCents === "number" ? `$${(product.priceCents / 100).toLocaleString()}` : "Not provided";
  const details = [["Price", price], ["Passenger capacity", product.seatsText], ["Powertrain", product.powertrainText], ["Range", product.rangeText]] as const;
  const highlights = Array.isArray(product.highlights) ? product.highlights.filter((value): value is string => typeof value === "string") : [];

  return <AppShell title="Preview competitor product"><PageHeader eyebrow="Competitor products" title={String(product.name || "Discovered product")} description="Preview only — this product is not in your catalog yet."/><section className="card form-stack"><div><strong>Competitor</strong><p>{String(product.brand || "Not identified")}</p></div><div><strong>Classification</strong><p><span className="badge amber">{candidate.classification.replace(/_/g, " ")}</span></p></div><div><strong>Discovered product name</strong><p>{String(product.name || "Not identified")}</p></div>{product.description ? <div><strong>Description</strong><p>{String(product.description)}</p></div> : null}<div className="grid grid-2">{details.map(([label, value]) => <div key={label}><strong>{label}</strong><p>{typeof value === "string" && value ? value : "Not provided"}</p></div>)}</div>{highlights.length ? <div><strong>Discovered features</strong><ul>{highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul></div> : null}{typeof product.sourceImageUrl === "string" && product.sourceImageUrl ? <div><strong>Source image</strong><p><a href={product.sourceImageUrl} target="_blank" rel="noreferrer">Open source image</a></p></div> : null}<div><strong>Source page</strong><p><a href={candidate.source_url} target="_blank" rel="noreferrer">Open the original page</a></p></div>{Object.keys(changes).length ? <div><strong>Detected changes</strong><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(changes, null, 2)}</pre></div> : null}<Link className="btn btn-secondary" href="/admin/competitor-sources/review">Back to review queue</Link></section></AppShell>;
}
