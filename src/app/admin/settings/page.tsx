import { isFreeSolo, isSoloPlan } from "@/lib/plans/policy";
import { SoloUpgradePrompt } from "@/components/solo-upgrade-prompt";
import { OwnProfileForm } from "@/components/own-profile-form";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { OrganizationSettingsForm } from "@/components/organization-settings-form";
import { AddLocationForm } from "@/components/add-location-form";
import { PageHeader } from "@/components/page-header";
import { getViewer } from "@/lib/auth/viewer";
import { getOrganizationLocations } from "@/lib/locations";
import { getOrganizationSettings } from "@/lib/organizations/settings";

export default async function SettingsPage() {
  const viewer = await getViewer();
  if (viewer && isSoloPlan(viewer.plan?.plan_key) && viewer.role !== "platform_owner") return <AppShell title="My account"><PageHeader title="My Sales Solo account" description={isFreeSolo(viewer.plan) ? "Manage your own profile and upgrade your plan." : "Manage your profile, sales materials, and subscription."}/><OwnProfileForm name={viewer.fullName} email={viewer.email}/>{isFreeSolo(viewer.plan) ? <SoloUpgradePrompt/> : <section className="card" style={{marginTop:18}}><h2>My sales materials</h2><div className="rv-billing-actions"><Link className="btn" href="/admin/products">Manage products</Link><Link className="btn" href="/knowledge-base">Manage documents</Link><Link className="btn" href="/admin/content">Manage sales templates</Link><Link className="btn" href="/billing">Subscription and AI allowance</Link></div><p>Your plan includes one user. Team permissions and location assignments are managed by the Platform Admin.</p></section>}</AppShell>;
  const [locationResult, settings] = await Promise.all([getOrganizationLocations(), getOrganizationSettings()]);
  const canSave = Boolean(viewer && !viewer.demo && ["tenant_admin", "platform_owner"].includes(viewer.role));

  return <AppShell title="Admin · Settings">
    <PageHeader eyebrow="Customization" title="Company branding and settings" description="Save organization settings for every authorized user and computer." />
    <section className="card" style={{ marginBottom: 18 }}><h2>Roles &amp; Permissions</h2><p>Review the default access for Admin, Manager, and Sales positions and configure their workspace permissions.</p><Link className="btn btn-secondary" href="/admin/settings/roles">Manage Roles &amp; Permissions</Link></section>
    <OrganizationSettingsForm settings={settings} locations={locationResult.locations} canSave={canSave} />
    <section className="card" style={{ marginTop: 18 }}><h2>AI Communication Standards</h2><p>Manage communication rules and style examples separately from factual company knowledge.</p><Link className="btn btn-secondary" href="/admin/ai-communication">Manage AI Communication Standards</Link></section>
    <AddLocationForm canAdd={canSave} />
    {locationResult.error ? <div className="card error-card" style={{ marginTop: 18 }}><h2>Locations unavailable</h2><p>{locationResult.error}</p></div> : <section className="card" style={{ marginTop: 18 }}><span className="eyebrow">Quote Calculator</span><h2>Location details and sales tax</h2><p>Update workspace location details and sales tax rates. Enter destination and delivery amounts directly on each quote.</p><Link className="btn btn-secondary" href="/admin/settings/location-fees">Location details and sales tax</Link></section>}
  </AppShell>;
}
