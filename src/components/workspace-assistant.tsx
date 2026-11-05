"use client";

import { FeatureLink as Link } from "@/components/feature-link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bot, ChevronDown, Send, Sparkles, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AssistantMarkdown } from "@/components/assistant-markdown";
import { assistantHistoryKey, assistantWorkspaces } from "@/lib/assistant/workspaces";
import { useAssistantHistory, type AssistantMessage as Message } from "@/components/use-assistant-history";
import { inventoryLabel, type WorkspaceId } from "@/lib/navigation";
import styles from "@/app/assistant/assistant-dashboard.module.css";

export function WorkspaceAssistant({ workspace, organizationId, userId, organizationName, industry, demo }: { workspace: WorkspaceId; organizationId: string; userId: string; organizationName: string; industry?: string; demo: boolean }) {
  const config = assistantWorkspaces[workspace];
  const key = assistantHistoryKey(workspace, organizationId, userId);
  const greeting: Message = { role: "ai", text: `I’m your RunFloor ${config.title}. ${config.description}\n\nWhat would you like to work on?` };
  const { messages, setMessages, ready, storageAvailable } = useAssistantHistory(key, greeting);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [promptsOpen, setPromptsOpen] = useState(true);
  const messagesRef = useRef<HTMLDivElement>(null);
  useEffect(() => { messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);
  async function send(question = input) {
    if (!question.trim() || sending || !ready) return;
    setMessages((current) => [...current, { role: "user", text: question }]);
    setInput(""); setSending(true);
    try {
      const response = await fetch(workspace === "sales" ? "/api/assistant" : `/api/workspace-assistant/${workspace}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, history: messages.slice(1).slice(-6) }) });
      const result = await response.json().catch(() => ({}));
      setMessages((current) => [...current, { role: "ai", text: response.ok ? result.answer : (result.error || "The assistant could not complete your request."), sources: response.ok && Array.isArray(result.sources) ? result.sources : [] }]);
    } catch { setMessages((current) => [...current, { role: "ai", text: "The connection was interrupted. Please try again." }]); }
    finally { setSending(false); }
  }
  return <AppShell title={config.title} industry={industry === "rv" || industry === "golf-cart" ? industry : undefined}><div className={`${styles.page} ${industry === "rv" ? styles.rvPage : ""} ${industry === "golf-cart" ? styles.golfCartPage : ""}`}>
    <section className={styles.hero}><div><span>RunFloor · {workspace}</span><h1>{config.tagline}</h1><p>{config.description}</p></div></section>
    {demo && <p className="callout">Demo preview uses sample data. Sign in to a connected workspace to ask AI questions using your approved records.</p>}
    <div className={styles.layout}><section className={styles.chatCard} aria-label={config.title}>
      <header className={styles.chatHeader}><span className={`${styles.icon} ${styles.brandIcon}`}><Bot/></span><div><strong>{config.title}</strong><small>{organizationName} · {demo ? "Demo preview" : "Approved workspace knowledge"}</small></div></header>
      <div className={styles.messages} ref={messagesRef} role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation">{messages.map((message, index) => <div className={`${styles.messageRow} ${message.role === "user" ? styles.userRow : ""}`} key={index}><div className={`${styles.message} ${message.role === "user" ? styles.userMessage : ""}`}>{message.role === "ai" ? <AssistantMarkdown content={message.text}/> : message.text}{Boolean(message.sources?.length) && <details><summary>Sources</summary><ul>{message.sources?.map((source, sourceIndex) => <li key={sourceIndex}>{source.documentName}{source.section ? ` — ${source.section}` : ""}{source.pageNumber ? `, page ${source.pageNumber}` : ""}</li>)}</ul></details>}</div></div>)}</div>
      <div className={styles.promptToggleRow}><button className={styles.promptToggle} type="button" onClick={() => setPromptsOpen((value) => !value)} aria-expanded={promptsOpen} aria-controls="suggested-prompts" aria-label={promptsOpen ? "Hide suggested prompts" : "Show suggested prompts"}><ChevronDown/></button></div>
      <div className={styles.prompts} id="suggested-prompts" hidden={!promptsOpen}>{promptsOpen && config.prompts.map((question) => <button type="button" key={question} onClick={() => send(question)} disabled={sending || !ready}><Sparkles/>{question}<ArrowRight/></button>)}</div>
      <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); void send(); }}><label className="sr-only" htmlFor="assistant-message">Message {config.title}</label><textarea id="assistant-message" value={input} maxLength={2000} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} placeholder={`Ask ${config.title}…`} disabled={sending || !ready} rows={2}/><div><small>{sending ? "Thinking…" : "Answers use approved workspace information."}</small><button type="submit" aria-label="Send message" disabled={sending || !ready || !input.trim()}><Send/></button></div></form>
    </section><aside className={styles.rail} id="assistant-tools"><section className={styles.railCard}><h2>{workspace === "executive" ? "Management" : workspace === "operations" ? "Operations" : "Sales"} Tools</h2><div className={styles.toolList}>{config.tools.map(([label, href]) => <Link href={href} key={href}><span><strong>{href === "/products" ? inventoryLabel(industry) : label}</strong></span><ArrowRight/></Link>)}</div></section><section className={styles.railCard}><h2>Current Conversation</h2><p>{storageAvailable ? "Saved for this browser tab, separately for this assistant, user, and dealership." : "Browser storage is unavailable. This conversation will reset when you leave the page."}</p><button className="btn btn-ghost" type="button" disabled={sending} onClick={() => setMessages([greeting])}><Trash2 size={16}/> New conversation</button></section></aside></div>
  </div></AppShell>;
}
