"use client";
import type { CSSProperties } from "react";
import { ArrowRight, BarChart3, Box, Crown, FileText, FolderOpen, Heart, MoreHorizontal, Settings, Truck, Trophy, Users, Wrench, Zap } from "lucide-react";
import styles from "./platform-procedure-template-library.module.css";
export const procedureCategoryStyles = [
  { name: "Sales Procedures", description: "From first contact to close.", icon: BarChart3, color: "#d83e48", tint: "#fff3f4" },
  { name: "Delivery & Post-Sale", description: "Ensure a smooth handoff and lasting relationships.", icon: Truck, color: "#4b9339", tint: "#f1f9ed" },
  { name: "Inventory", description: "Manage stock, intake, and inventory processes.", icon: Box, color: "#2682d9", tint: "#eff7ff" },
  { name: "Service", description: "Keep customers on the road and coming back.", icon: Wrench, color: "#d77a1e", tint: "#fff7ee" },
  { name: "Parts", description: "Ordering, receiving, and parts management.", icon: Settings, color: "#8a5bcc", tint: "#f7f2ff" },
  { name: "CRM & Lead Management", description: "Capture, follow up, and convert more leads.", icon: Users, color: "#008c82", tint: "#edf9f7" },
  { name: "Customer Experience", description: "Create raving fans at every touchpoint.", icon: Heart, color: "#cf5276", tint: "#fff1f6" },
  { name: "Management", description: "Lead effectively and drive results.", icon: Crown, color: "#a77b16", tint: "#fffae9" },
  { name: "Employee & Administrative", description: "HR, onboarding, and day-to-day operations.", icon: Users, color: "#4262d2", tint: "#f0f3ff" },
  { name: "Other", description: "Additional templates and resources.", icon: MoreHorizontal, color: "#64748b", tint: "#f3f5f8" },
  { name: "Uncategorized", description: "A home for templates awaiting a category.", icon: FolderOpen, color: "#78716c", tint: "#f7f5f2" },
];

export function procedureCategoryStyle(name: string) { return procedureCategoryStyles.find(item => item.name === name) ?? { name, description: "Your team's procedures and resources.", icon: FolderOpen, color: "#64748b", tint: "#f3f5f8" }; }
export function ProcedureCategoryCard({ name, count, noun = "templates", selected, disabled, onClick }: { name: string; count: number; noun?: string; selected: boolean; disabled?: boolean; onClick: () => void }) {
const { description, icon: Icon, color, tint } = procedureCategoryStyle(name);
return <button type="button" className={styles.category} style={{ "--accent": color, "--tint": tint } as CSSProperties} aria-expanded={selected} disabled={disabled} onClick={onClick}><span className={styles.categoryIcon}><Icon size={24} aria-hidden="true" /></span><span className={styles.categoryCopy}><strong>{name}</strong><span>{description}</span></span><span className={styles.categoryFooter}><span><FileText size={13} aria-hidden="true" />{count ? `${count} ${count === 1 ? noun.slice(0,-1) : noun}` : `Ready for your first ${noun.slice(0,-1)}`}</span><ArrowRight size={17} aria-hidden="true" /></span></button>;
}
export function ProcedureValueBanner({ templates = false }: { templates?: boolean }) { return <div className={styles.banner}><Trophy className={styles.trophy} size={29} aria-hidden="true" /><div className={styles.bannerCopy}><h3>Turn Knowledge Into Consistency</h3><p>Use these {templates ? "procedure templates" : "procedures"} to train your team, standardize operations, and deliver an exceptional customer experience.</p></div><div className={styles.values}>{[{ icon: Users, title: "Organized", text: "Find what you need fast" }, { icon: Zap, title: "Customizable", text: "Make it your own" }, { icon: BarChart3, title: "Built for Growth", text: "Stronger teams. Better results." }].map(({ icon: Icon, title, text }) => <div key={title}><Icon size={20} aria-hidden="true" /><span><strong>{title}</strong><small>{text}</small></span></div>)}</div></div>; }
