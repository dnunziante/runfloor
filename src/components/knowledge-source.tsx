import { Globe, Layers, ShieldCheck, TriangleAlert } from "lucide-react";
import type { SourceMetadata } from "@/lib/knowledge-first/types";
import { sourceLabels } from "@/lib/knowledge-first/types";
import { validPublicUrl } from "@/lib/knowledge-first/policy";
import styles from "./knowledge-first.module.css";

export function KnowledgeSource({ metadata }: { metadata: SourceMetadata }) {
  const Icon = { internal: ShieldCheck, external: Globe, mixed: Layers, unverified: TriangleAlert }[metadata.classification];
  if (!Icon) return null;
  return <section className={`${styles.sources} ${styles[metadata.classification]}`} aria-label="Answer sources"><strong className={styles.badge}><Icon size={17}/>{sourceLabels[metadata.classification]}</strong>
    {metadata.classification === "external" && <p>This information was not available in your RunFloor knowledge base. The assistant used publicly available sources to provide this answer.</p>}
    {metadata.classification === "mixed" && <p>Each statement cites its source below. General public information does not establish dealership policy.</p>}
    {metadata.verification === "partial" && <p>Partial coverage: some requested information remains unverified.</p>}
    {metadata.warnings?.map((warning, index) => <p key={index}>{warning}</p>)}
    {Boolean(metadata.internalSources?.length || metadata.externalSources?.length) && <details open><summary>Source references</summary><ul>{metadata.internalSources?.map((source) => <li id={`source-${source.id}`} key={source.id}>[{source.id}] {source.title} <small>RunFloor Knowledge</small></li>)}{metadata.externalSources?.map((source) => <li key={source.id}>[{source.id}] {validPublicUrl(source.url) ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a> : source.title} <small>Public source · {new Date(source.retrievedAt).toLocaleDateString()}</small></li>)}</ul></details>}
    <small>{metadata.research?.cached ? "Cached public research · " : ""}{metadata.timestamp ? new Date(metadata.timestamp).toLocaleString() : ""}</small>
  </section>;
}
