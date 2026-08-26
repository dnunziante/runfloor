import { AppShell } from "@/components/app-shell";
import { InviteUserForm } from "@/components/invite-user-form";
import { PageHeader } from "@/components/page-header";
import { UsersManagementTable, type UserRow } from "@/components/users-management-table";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

type Profile = { full_name: string | null; first_name: string | null; last_name: string | null; phone: string | null; email: string | null } | null;
type Relation = { name: string } | null;

export default async function UsersPage() {
  const viewer = await getViewer();
  const supabase = await createClient();
  const isPlatformOwner = viewer?.role === "platform_owner";
  const organizationId = viewer?.organizationId || "";
  const canManage = Boolean(viewer && !viewer.demo && ["tenant_admin", "platform_owner"].includes(viewer.role));
  const membershipQuery = supabase.from("organization_memberships").select("id, organization_id, role, status, location_id, profiles(full_name, first_name, last_name, phone, email), locations(name), organizations(name)").order("created_at");
  const invitationQuery = supabase.from("organization_invitations").select("id, organization_id, email, first_name, last_name, phone, role, status, location_id, locations(name), organizations(name)").eq("status", "pending").order("created_at", { ascending: false });
  const locationQuery = supabase.from("locations").select("id, organization_id, name").eq("is_active", true).order("sort_order").order("name");
  const tenantQuery = supabase.from("organizations").select("id, name").eq("status", "active").order("name");
  const [{ data: memberships }, { data: invitations }, { data: locations }, { data: tenants }] = isPlatformOwner
    ? await Promise.all([membershipQuery, invitationQuery, locationQuery, tenantQuery])
    : organizationId ? await Promise.all([membershipQuery.eq("organization_id", organizationId), invitationQuery.eq("organization_id", organizationId), locationQuery.eq("organization_id", organizationId), tenantQuery.eq("id", organizationId)])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const users: UserRow[] = [
    ...(memberships || []).map((member) => {
      const profile = member.profiles as unknown as Profile;
      const location = member.locations as unknown as Relation;
      const organization = member.organizations as unknown as Relation;
      const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.full_name || "Team member";
      const [fallbackFirstName = "", ...fallbackLastName] = name.split(/\s+/);
      return { id: member.id, kind: "member" as const, firstName: profile?.first_name || fallbackFirstName, lastName: profile?.last_name || fallbackLastName.join(" "), name, email: profile?.email || "—", phone: profile?.phone || "", organizationId: member.organization_id, organizationName: organization?.name || "Tenant", locationId: member.location_id, locationName: location?.name || "No location", role: member.role, status: member.status };
    }),
    ...(invitations || []).map((invitation) => {
      const location = invitation.locations as unknown as Relation;
      const organization = invitation.organizations as unknown as Relation;
      return { id: invitation.id, kind: "invitation" as const, firstName: invitation.first_name || "", lastName: invitation.last_name || "", name: [invitation.first_name, invitation.last_name].filter(Boolean).join(" ") || "Invited user", email: invitation.email, phone: invitation.phone || "", organizationId: invitation.organization_id, organizationName: organization?.name || "Tenant", locationId: invitation.location_id, locationName: location?.name || "No location", role: invitation.role, status: invitation.status };
    }),
  ];
  const locationOptions = (locations || []).map((location) => ({ id: location.id, name: location.name, organizationId: location.organization_id }));
  const tenantOptions = (tenants || []).map((tenant) => ({ id: tenant.id, name: tenant.name }));

  return <AppShell title="Admin · Users"><PageHeader eyebrow={isPlatformOwner ? "Platform administration" : "Team access"} title={isPlatformOwner ? "Manage RunFloor users" : "Manage BGC users"} description="User identity, access, and invitations are stored securely in the shared RunFloor workspace." />
    <InviteUserForm locations={locationOptions} tenants={tenantOptions} canInvite={canManage} isPlatformOwner={isPlatformOwner} />
    <UsersManagementTable users={users} locations={locationOptions} tenants={tenantOptions} canManage={canManage} isPlatformOwner={isPlatformOwner} />
  </AppShell>;
}
