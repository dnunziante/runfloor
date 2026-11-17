import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LocationQuoteFeeEditor } from "@/components/location-quote-fee-editor";
import { PageHeader } from "@/components/page-header";
import { getOrganizationLocations } from "@/lib/locations";

export default async function LocationFeesPage() {
  const locationResult = await getOrganizationLocations();
  return <AppShell title="Location details and sales tax">
    <PageHeader eyebrow="Quote Calculator" title="Location details and sales tax" description="Manage shared location details and sales tax rates. Destination and delivery are entered directly on each quote." action={<Link className="btn btn-ghost" href="/admin/settings"><ArrowLeft size={16}/> Settings</Link>} />
    {locationResult.error ? <div className="card error-card"><h2>Locations unavailable</h2><p>{locationResult.error}</p></div> : <LocationQuoteFeeEditor locations={locationResult.locations} />}
  </AppShell>;
}
