import { isFeatureDestinationEnabled } from "@/lib/features";
import { FeatureLink as Link } from "@/components/feature-link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";

const sections = [
  ["Sales scripts", "Add approved talk tracks and discovery prompts.", "/admin/content/sales_script"],
  ["Objection responses", "Add approved answers to common buyer concerns.", "/admin/content/objection_response"],
  ["Email templates", "Add reusable customer follow-up emails.", "/admin/content/email_template"],
  ["Text templates", "Add reusable customer text messages.", "/admin/content/text_template"],
  ["Role-play scenarios", "Create practice scenarios and scoring rubrics.", "/admin/coach"],
  ["Training resources", "Build modules from approved training lessons.", "/admin/training"],
  ["AI instructions", "Set the shared company instructions for future AI testing.", "/admin/settings"],
  ["Knowledge documents", "Upload and organize the source documents your team approves.", "/knowledge-base"],
  ["Locations and settings", "Maintain location details and shared workspace settings.", "/admin/settings"],
];

export default function AdminContentPage() {
  return <AppShell title="Admin · Sales Content"><PageHeader eyebrow="Content manager" title="Sales content" description="Load approved BGC material now so it is ready for controlled AI testing later." />
    <div className="grid grid-3">{sections.filter(([, , href]) => isFeatureDestinationEnabled(href)).map(([title, description, href]) => <div className="card" key={title}><h2>{title}</h2><p>{description}</p><Link className="btn btn-secondary" href={href}>Manage</Link></div>)}</div>
  </AppShell>;
}
