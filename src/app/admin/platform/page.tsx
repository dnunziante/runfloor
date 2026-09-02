import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { PlatformProcedureTemplateLibrary } from "@/components/platform-procedure-template-library";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import {
  createTenant,
  copyPlatformProcedureTemplate,
  copyPlatformProcedureTemplateToAllTenants,
  copyTenantProcedureToPlatformTemplate,
  deleteEmptyTenant,
  enterTenantWorkspace,
  savePlatformProcedureTemplate,
  updateIndustryTemplateVisibility,
  updateTenant,
} from "./actions";
import "./platform.module.css";

type TenantRow = {
  id: string;
  name: string;
  status: string;
  is_internal_demo: boolean;
  subscription_status: string;
  industry_template: { id: string; name: string } | null;
};
type TemplateRow = {
  id: string;
  name: string;
  is_enabled: boolean;
  is_internal_only: boolean;
  is_public_demo_visible: boolean;
  is_available_during_signup: boolean;
};
const procedureCategories = ["Sales Procedures", "Delivery & Post-Sale", "Inventory", "Service", "Parts", "CRM & Lead Management", "Customer Experience", "Management", "Employee & Administrative", "Other", "Uncategorized"];

export default async function PlatformAdminPage() {
  const viewer = await getViewer();
  if (viewer?.role !== "platform_owner") redirect("/admin");
  const supabase = await createClient();
  const [
    { data: tenants },
    { data: templates },
    { data: procedureTemplates },
    { data: tenantProcedures },
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "id,name,status,is_internal_demo,subscription_status,industry_template:industry_templates!organizations_industry_template_id_fkey(id,name)",
      )
      .order("name"),
    supabase
      .from("industry_templates")
      .select(
        "id,name,is_enabled,is_internal_only,is_public_demo_visible,is_available_during_signup",
      )
      .order("name"),
    supabase
      .from("platform_procedure_templates")
      .select("id,title,category,owner,summary,version")
      .order("updated_at", { ascending: false }),
    supabase
      .from("operations_procedures")
      .select("id,title,organization_id,organizations(name)")
      .neq("status", "archived")
      .order("title")
      .limit(500),
  ]);
  const tenantRows = (tenants || []) as unknown as TenantRow[];
  const templateRows = (templates || []) as TemplateRow[];
  const procedureTemplateRows = procedureTemplates || [];
  const templatesByCategory = procedureCategories.map((category) => ({ category, templates: procedureTemplateRows.filter((template) => template.category === category) })).filter((group) => group.templates.length);
  const sourceProcedures = (tenantProcedures || []) as unknown as Array<{
    id: string;
    title: string;
    organization_id: string;
    organizations: { name: string } | null;
  }>;
  return (
    <AppShell title="Platform Admin">
      <PageHeader
        eyebrow="RunFloor platform"
        title="Tenants & Industry Templates"
        description={`Viewing: ${viewer.organizationName}. Platform changes are separate from tenant administration.`}
      />
      <section className="card">
        <h2>Create tenant</h2>
        <p>
          Create an isolated workspace from a selected industry template. This
          does not copy BGC data.
        </p>
        <form action={createTenant} className="grid grid-2">
          <input
            className="input"
            name="name"
            required
            minLength={2}
            maxLength={120}
            placeholder="Company or demo tenant name"
          />
          <select className="input" name="templateId" required defaultValue="">
            <option value="" disabled>
              Choose industry template
            </option>
            {templateRows
              .filter((template) => template.is_enabled)
              .map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
          </select>
          <label>
            <input type="checkbox" name="isInternalDemo" /> Internal demo tenant
          </label>
          <button className="btn btn-primary">Create tenant</button>
        </form>
      </section>
      <section className="card">
        <h2>Tenants</h2>
        <p>
          Archiving a tenant prevents it from being opened as the active
          platform workspace while preserving its users and business data.
          Reassigning an industry does not overwrite that tenant’s existing
          content.
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Industry</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Visibility</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenantRows.map((tenant) => (
                <tr key={tenant.id}>
                  <td>
                    <form
                      action={updateTenant}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <input type="hidden" name="tenantId" value={tenant.id} />
                      <input
                        className="input"
                        name="name"
                        defaultValue={tenant.name}
                        aria-label={`${tenant.name} name`}
                      />
                      <select
                        className="input"
                        name="templateId"
                        defaultValue={tenant.industry_template?.id || ""}
                        aria-label={`${tenant.name} industry template`}
                        required
                      >
                        <option value="" disabled>
                          Choose industry
                        </option>
                        {templateRows
                          .filter((template) => template.is_enabled)
                          .map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                      </select>
                      <select
                        className="input"
                        name="subscriptionStatus"
                        defaultValue={tenant.subscription_status}
                        aria-label={`${tenant.name} subscription`}
                      >
                        <option value="trial">Trial</option>
                        <option value="active">Active</option>
                        <option value="past_due">Past due</option>
                        <option value="suspended">Suspended</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <select
                        className="input"
                        name="status"
                        defaultValue={tenant.status}
                        aria-label={`${tenant.name} tenant status`}
                      >
                        <option value="active">Active</option>
                        <option value="suspended">Archived</option>
                      </select>
                      <button className="btn btn-ghost">Save tenant</button>
                    </form>
                  </td>
                  <td>{tenant.industry_template?.name || "Unassigned"}</td>
                  <td>{tenant.subscription_status}</td>
                  <td>
                    {tenant.status === "suspended" ? "Archived" : tenant.status}
                  </td>
                  <td>
                    {tenant.is_internal_demo
                      ? "Internal only"
                      : "Customer tenant"}
                  </td>
                  <td>
                    <form action={enterTenantWorkspace}>
                      <input
                        type="hidden"
                        name="organizationId"
                        value={tenant.id}
                      />
                      <button
                        className="btn btn-ghost"
                        disabled={tenant.status !== "active"}
                      >
                        Enter workspace
                      </button>
                    </form>
                    <details>
                      <summary>Delete empty tenant</summary>
                      <form action={deleteEmptyTenant}>
                        <input
                          type="hidden"
                          name="tenantId"
                          value={tenant.id}
                        />
                        <input
                          className="input"
                          name="confirmation"
                          placeholder={`Type ${tenant.name}`}
                          aria-label={`Confirm deletion of ${tenant.name}`}
                        />
                        <button className="btn btn-ghost">
                          Delete permanently
                        </button>
                      </form>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h2>Industry Templates</h2>
        <p>
          Internal-only templates are automatically excluded from public demos
          and signup.
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Template</th>
                <th>Enabled</th>
                <th>Internal only</th>
                <th>Public demo</th>
                <th>Signup</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {templateRows.map((template) => (
                <tr key={template.id}>
                  <td>
                    <Link href={`/admin/platform/templates/${template.id}`}>
                      {template.name}
                    </Link>
                  </td>
                  <td>{template.is_enabled ? "Yes" : "No"}</td>
                  <td>{template.is_internal_only ? "Yes" : "No"}</td>
                  <td>{template.is_public_demo_visible ? "Yes" : "No"}</td>
                  <td>{template.is_available_during_signup ? "Yes" : "No"}</td>
                  <td>
                    <form
                      action={updateIndustryTemplateVisibility}
                      style={{ display: "flex", gap: 8 }}
                    >
                      <input
                        type="hidden"
                        name="templateId"
                        value={template.id}
                      />
                      <label>
                        <input
                          type="checkbox"
                          name="isEnabled"
                          defaultChecked={template.is_enabled}
                        />{" "}
                        Enabled
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          name="isInternalOnly"
                          defaultChecked={template.is_internal_only}
                        />{" "}
                        Internal only
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          name="isPublicDemoVisible"
                          defaultChecked={template.is_public_demo_visible}
                        />{" "}
                        Public demo
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          name="isAvailableDuringSignup"
                          defaultChecked={template.is_available_during_signup}
                        />{" "}
                        Signup
                      </label>
                      <Link
                        className="btn btn-ghost"
                        href={`/admin/platform/templates/${template.id}`}
                      >
                        Edit content
                      </Link>
                      <button className="btn btn-ghost">Save</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h2>Procedure Templates</h2>
        <p>
          Create a platform procedure once, then copy it into a tenant’s
          independent procedure library.
        </p>
        <form
          action={copyTenantProcedureToPlatformTemplate}
          className="button-row"
          style={{ marginBottom: 16 }}
        >
          <select className="input" name="procedureId" required defaultValue="">
            <option value="" disabled>
              Copy an existing tenant procedure to templates
            </option>
            {sourceProcedures.map((procedure) => (
              <option key={procedure.id} value={procedure.id}>
                {procedure.organizations?.name || "Tenant"} — {procedure.title}
              </option>
            ))}
          </select>
          <button className="btn btn-secondary">
            Copy to template library
          </button>
        </form>
        <form action={savePlatformProcedureTemplate} className="form-stack">
          <div className="grid grid-3">
            <input
              className="input"
              name="title"
              required
              placeholder="Template title"
            />
            <select className="input" name="category" defaultValue="Uncategorized">{procedureCategories.map((category) => <option key={category}>{category}</option>)}</select>
            <input className="input" name="owner" placeholder="Owner" />
          </div>
          <textarea
            className="input"
            name="summary"
            rows={3}
            required
            placeholder="Purpose and scope"
          />
          <textarea
            className="input"
            name="steps"
            rows={6}
            required
            placeholder="Procedure steps. Separate main steps with a blank line; formatting is preserved."
          />
          <button className="btn btn-primary">Save procedure template</button>
        </form>
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Template</th>
                <th>Version</th>
                <th>Copy to tenant</th>
              </tr>
            </thead>
            <tbody>
              {templatesByCategory.flatMap((group) => [<tr key={`category-${group.category}`}><th colSpan={3}>{group.category}</th></tr>, ...group.templates.map((template) => (
                <tr key={template.id}>
                  <td>
                    <strong>{template.title}</strong>
                    <br />
                    <small>
                      {template.category} · {template.owner}
                    </small>
                  </td>
                  <td>v{template.version}</td>
                  <td>
                    <form
                      action={copyPlatformProcedureTemplate}
                      style={{ display: "flex", gap: 8 }}
                    >
                      <input
                        type="hidden"
                        name="templateId"
                        value={template.id}
                      />
                      <select
                        className="input"
                        name="organizationId"
                        required
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Choose tenant
                        </option>
                        {tenantRows
                          .filter((tenant) => tenant.status === "active")
                          .map((tenant) => (
                            <option key={tenant.id} value={tenant.id}>
                              {tenant.name}
                            </option>
                          ))}
                      </select>
                      <button className="btn btn-ghost">Copy to tenant</button>
                    </form>
                    <form action={copyPlatformProcedureTemplateToAllTenants} style={{ marginTop: 8 }}><input type="hidden" name="templateId" value={template.id}/><button className="btn btn-secondary">Add to all tenants</button></form>
                  </td>
                </tr>
              ))])}
            </tbody>
          </table>
        </div>
      </section>
      <PlatformProcedureTemplateLibrary templates={procedureTemplateRows} tenants={tenantRows.filter((tenant) => tenant.status === "active").map((tenant) => ({ id: tenant.id, name: tenant.name }))} />
    </AppShell>
  );
}
