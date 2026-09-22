"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, Bookmark, Check, CircleAlert, DollarSign, Info, RotateCcw, Save, Settings2, Target, TrendingUp, Trophy, Users, ClipboardCheck } from "lucide-react";
import { saveExecutiveTargets, saveExecutiveEscalationSettings } from "@/app/admin/executive/actions";
import { defaultExecutiveTargets, type ExecutiveTargets } from "@/lib/executive/data";
import { defaultExecutiveEscalationSettings, type ExecutiveEscalationSettings } from "@/lib/executive/escalations";
import styles from "./rv-executive-targets.module.css";

const targetFields = [
  { key: "salesPace", label: "Sales pace target", range: "1–200", max: 200, icon: DollarSign, tone: "orange", help: "Monthly revenue achieved as a percentage of target." },
  { key: "coachingCompletion", label: "Coaching completion", range: "1–100", max: 100, icon: Users, tone: "green", help: "Completed coaching sessions as a percentage of recorded sessions." },
  { key: "growthCompletion", label: "Growth task completion", range: "1–100", max: 100, icon: TrendingUp, tone: "orange", help: "Completed growth-plan tasks as a percentage of recorded tasks." },
  { key: "operationsCompletion", label: "Operations completion", range: "1–100", max: 100, icon: ClipboardCheck, tone: "purple", help: "Completed checklist steps as a percentage of recorded steps." },
  { key: "highRiskLimit", label: "Open high-risk limit", range: "0–100", max: 100, icon: CircleAlert, tone: "red", help: "Open high or critical alerts allowed before an Act now priority appears." },
] as const;

export function RvExecutiveTargets({ initialTargets, initialSettings, persistence }: { initialTargets: ExecutiveTargets; initialSettings: ExecutiveEscalationSettings; persistence: "demo" | "supabase" }) {
  const [targets, setTargets] = useState(initialTargets);
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setNotice(""); setSaving(true);
    try {
      if (persistence === "demo") { setNotice("Changes are available in this prototype view only. Sign in to save organization settings."); return; }
      const targetResult = await saveExecutiveTargets(targets);
      if (targetResult.error) { setError(targetResult.error); return; }
      const settingsResult = await saveExecutiveEscalationSettings(settings);
      if (settingsResult.error) { setError(`Targets saved, but accountability rules could not be saved: ${settingsResult.error}`); return; }
      setNotice("Executive targets and accountability rules saved for this organization.");
    } catch { setError("Settings could not be saved. Please try again."); }
    finally { setSaving(false); }
  }

  function reset() { setTargets(defaultExecutiveTargets); setSettings(defaultExecutiveEscalationSettings); setNotice("Default values loaded. Save to apply them."); setError(""); }
  function cancel() { setTargets(initialTargets); setSettings(initialSettings); setNotice("Changes discarded."); setError(""); }
  function downloadTemplate() {
    const blob = new Blob([JSON.stringify({ targets, accountabilityRules: settings }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "executive-targets-template.json"; link.click(); URL.revokeObjectURL(url);
  }

  return <div className={styles.page}>
    <section className={styles.hero}><div><span>Administrator settings</span><h1>Define what needs<br/><em>leadership attention.</em></h1><p>Set organization-level targets and accountability rules used by<br/>the Executive Advisor’s transparent calculations.</p></div><blockquote>“Clear targets<br/>create confident<br/>leaders.”<small>— RunFloor</small></blockquote><div className={styles.motto}>Set Targets.<br/>Drive Results.</div></section>
    <form className={styles.layout} onSubmit={submit}>
      <div className={styles.main}>
        <section className={styles.card}><div className={styles.heading}><span className={styles.headingIcon}><Target/></span><div><h2>Leadership targets</h2><p>These thresholds control the scorecard and help identify what needs leadership attention.</p></div><button className={styles.recommended} type="button" onClick={() => { setTargets(defaultExecutiveTargets); setNotice("Recommended targets loaded. Save to apply them."); }}><TrendingUp size={15}/> Use recommended</button></div>
          <div className={styles.targetGrid}>{targetFields.map((field) => <label className={`${styles.field} ${field.key === "highRiskLimit" ? styles.wide : ""}`} key={field.key}><span className={styles.label}>{field.label}<small>{field.range}</small></span><span className={styles.inputRow}><span className={`${styles.fieldIcon} ${styles[field.tone]}`}><field.icon size={19}/></span><input type="number" min={field.key === "highRiskLimit" ? 0 : 1} max={field.max} required value={targets[field.key]} onChange={(event) => setTargets((current) => ({ ...current, [field.key]: Number(event.target.value) }))}/></span><small className={styles.help}>{field.help}</small></label>)}</div>
        </section>
        <section className={styles.card}><div className={styles.heading}><span className={styles.headingIcon}><Bell/></span><div><h2>Accountability rules</h2><p>These rules create an in-app notification queue from review due dates.</p></div></div>
          <label className={styles.toggleRow}><input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))}/><span><strong>Enable accountability notices</strong><small>Show due-soon, overdue, unassigned, and escalation notices.</small></span></label>
          <div className={styles.rulesGrid}><label className={styles.field}><span className={styles.label}>Remind before due date<small>0–30</small></span><span className={styles.unitInput}><input type="number" min="0" max="30" required value={settings.remindBeforeDays} onChange={(event) => setSettings((current) => ({ ...current, remindBeforeDays: Number(event.target.value) }))}/><span>days</span></span><small className={styles.help}>A reminder appears this many days before the due date.</small></label><label className={styles.field}><span className={styles.label}>Escalate after overdue<small>0–30</small></span><span className={styles.unitInput}><input type="number" min="0" max="30" required value={settings.escalateAfterDays} onChange={(event) => setSettings((current) => ({ ...current, escalateAfterDays: Number(event.target.value) }))}/><span>days</span></span><small className={styles.help}>An escalation replaces the reminder after this many overdue days.</small></label><label className={styles.field}><span className={styles.label}>Escalation recipient</span><input className={styles.recipient} maxLength={100} required value={settings.escalationRecipient} onChange={(event) => setSettings((current) => ({ ...current, escalationRecipient: event.target.value }))}/><small className={styles.help}>A role or team label, such as Tenant administrator.</small></label></div>
          {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
          <div className={styles.actions}><button className={styles.save} type="submit" disabled={saving}><Save size={16}/>{saving ? "Saving…" : "Save executive targets"}</button><button className={styles.cancel} type="button" onClick={cancel}>Cancel</button></div>
        </section>
      </div>
      <aside className={styles.aside}><section className={styles.card}><div className={styles.heading}><span className={`${styles.headingIcon} ${styles.green}`}><TrendingUp/></span><div><h2>Target preview <Info size={14}/></h2><p>How these targets appear in the Executive Advisor.</p></div></div><div className={styles.preview}><Trophy size={28}/><div><strong>On track for success</strong><p>These targets will highlight locations that need attention while keeping the focus on growth and accountability.</p></div></div><div className={styles.quick}><h3><Settings2 size={17}/> Quick actions</h3><button type="button" onClick={reset}><RotateCcw size={15}/> Reset to defaults</button><button type="button" onClick={downloadTemplate}><Bookmark size={15}/> Download as template</button></div></section><section className={`${styles.card} ${styles.impact}`}><h2>Higher standards.<br/>Bigger opportunities.</h2>{["Focus on the metrics that matter", "Identify risks early", "Drive accountability across locations", "Fuel smarter, data-driven decisions"].map((item) => <p key={item}><Check size={15}/>{item}</p>)}<blockquote>“Turn goals into momentum.”<small>— RunFloor</small></blockquote></section><Link className={styles.back} href="/executive">Back to Command Center</Link></aside>
    </form>
  </div>;
}
