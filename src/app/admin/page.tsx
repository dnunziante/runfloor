import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronRight,
  Circle,
  GraduationCap,
  Settings,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { getExecutiveReadiness } from "@/lib/executive/readiness-repository";
import { buildExecutiveSetupSequence } from "@/lib/executive/setup-sequence";

export default async function Admin() {
  const readiness = await getExecutiveReadiness();
  const setupSteps = buildExecutiveSetupSequence(readiness.checks);
  const currentStep = setupSteps.find((step) => step.state === "current");
  const setupHref = `/admin/executive/setup?period=${readiness.reportingPeriod}`;
  const readinessHref = `/executive/readiness?period=${readiness.reportingPeriod}`;
  const items = [
    [Boxes, "Products & pricing", "Manage models, positioning, prices, and visibility.", "/admin/products"],
    [Boxes, "Competitor sources", "Check public competitor product pages and review updates before importing them.", "/admin/competitor-sources"],
    [BarChart3, "Sales results", "Review and approve monthly results used by the Executive Advisor.", "/admin/sales-results"],
    [GraduationCap, "Coach scenarios", "Create and publish tenant-specific practice conversations.", "/admin/coach"],
    [GraduationCap, "Training modules", "Combine knowledge lessons into ordered learning paths.", "/admin/training"],
    [BookOpen, "Sales content", "Manage scripts, objections, templates, and training.", "/admin/content"],
    [Building2, "Locations", "Manage BGC storefront details and local information.", "/admin/settings"],
    [Users, "Team members", "Invite users and assign BGC roles and locations.", "/admin/users"],
    [Settings, "Workspace settings", "Control branding and assistant behavior.", "/admin/settings"],
  ] as const;

  return (
    <AppShell title="Admin">
      <PageHeader eyebrow="Workspace administration" title="Manage the BGC experience" description="A simple control center for approved content, users, and workspace settings." />

      {readiness.canManageSetup ? (
        <section className="card admin-launch-card" aria-labelledby="executive-launch-title">
          <div className="admin-launch-summary">
            <div>
              <span className={`badge ${readiness.score === 100 ? "" : "amber"}`}>Executive launch</span>
              <h2 id="executive-launch-title">Reporting foundation</h2>
              <p>{readiness.readyRequired} of {readiness.requiredTotal} required setup steps are ready for {readiness.reportingPeriod}.</p>
            </div>
            <strong aria-label={`${readiness.score} percent ready`}>{readiness.score}%</strong>
          </div>

          <div className="progress admin-launch-progress" aria-hidden="true">
            <span style={{ width: `${readiness.score}%` }} />
          </div>

          {readiness.error ? (
            <div className="admin-launch-alert" role="status">
              <AlertTriangle size={18} />
              <span>Some live setup checks are temporarily unavailable. Open the setup guide for details.</span>
            </div>
          ) : null}

          <div className="admin-launch-steps" aria-label="Executive setup progress">
            {setupSteps.map((step) => (
              <span className={step.ready ? "ready" : ""} key={step.id}>
                {step.ready ? <CheckCircle2 size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
                {step.title}
              </span>
            ))}
          </div>

          <div className="admin-launch-next">
            <div>
              <small>{currentStep ? "Next blocking step" : "Foundation ready"}</small>
              <strong>{currentStep?.title ?? "Continue to the monthly leadership review"}</strong>
              <p>{currentStep?.explanation ?? "All required source checks are complete for this reporting period."}</p>
            </div>
            <div className="admin-launch-actions">
              <Link className="btn btn-primary" href={currentStep ? setupHref : `/executive/review?period=${readiness.reportingPeriod}`}>
                {currentStep ? "Continue setup" : "Open review"}
                <ChevronRight size={17} />
              </Link>
              <Link className="btn btn-ghost" href={readinessHref}>View readiness</Link>
            </div>
          </div>
        </section>
      ) : null}

      <div className="card admin-settings-list">
        {items.map(([Icon, title, copy, href]) => (
          <Link className="activity-row" href={href} key={title}>
            <span className="metric-icon"><Icon size={18} /></span>
            <div style={{ flex: 1 }}><strong>{title}</strong><p style={{ margin: 2, fontSize: 12 }}>{copy}</p></div>
            <ChevronRight size={18} />
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
