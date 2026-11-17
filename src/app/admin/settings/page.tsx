import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { OrganizationSettingsForm } from "@/components/organization-settings-form";
import { AddLocationForm } from "@/components/add-location-form";
import { PageHeader } from "@/components/page-header";
import { getViewer } from "@/lib/auth/viewer";
import { getOrganizationLocations } from "@/lib/locations";
import { getOrganizationSettings } from "@/lib/organizations/settings";

export default async function SettingsPage() {
  const [locationResult, settings, viewer] = await Promise.all([getOrganizationLocations(), getOrganizationSettings(), getViewer()]);
  const canSave = Boolean(viewer && !viewer.demo && ["tenant_admin", "platform_owner"].includes(viewer.role));

  return <AppShell title="Admin · Settings">
    <PageHeader eyebrow="Customization" title="Company branding and settings" description="Save organization settings for every authorized user and computer." />
    <section className="card" style={{ marginBottom: 18 }}><h2>Roles &amp; Permissions</h2><p>Review the default access for Admin, Manager, and Sales positions and configure their workspace permissions.</p><Link className="btn btn-secondary" href="/admin/settings/roles">Manage Roles &amp; Permissions</Link></section>
    <OrganizationSettingsForm settings={settings} locations={locationResult.locations} canSave={canSave} />
    <section className="card" style={{ marginTop: 18 }}><h2>AI Communication Standards</h2><p>Manage communication rules and style examples separately from factual company knowledge.</p><Link className="btn btn-secondary" href="/admin/ai-communication">Manage AI Communication Standards</Link></section>
    <AddLocationForm canAdd={canSave} />
    {locationResult.error ? <div className="card error-card" style={{ marginTop: 18 }}><h2>Locations unavailable</h2><p>{locationResult.error}</p></div> : <section className="card" style={{ marginTop: 18 }}><span className="eyebrow">Quote Calculator</span><h2>Location fees and details</h2><p>Update a workspace location name, city/state, shipping, delivery, and tax defaults used by the Quote Calculator.</p><Link className="btn btn-secondary" href="/admin/settings/location-fees">Location fees and details</Link></section>}
  </AppShell>;
}
