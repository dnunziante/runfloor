"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Bot, Send, Sparkles } from "lucide-react";

type Message = { role: "user" | "ai"; text: string };

export default function AssistantPage() {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("Your workspace");
  const [messages, setMessages] = useState<Message[]>([{ role: "ai", text: "Ask a product or sales question and I’ll answer from your approved Refyntra knowledge." }]);
  const prompts = ["Compare two products", "Explain a key feature", "Help respond to a price objection"];

  useEffect(() => {
    fetch("/api/auth/context").then((response) => response.ok ? response.json() : null).then((viewer) => {
      if (viewer?.organizationName) setWorkspaceName(viewer.organizationName);
    }).catch(() => undefined);
  }, []);

  async function send(question = input) {
    if (!question.trim() || sending) return;
    setMessages((current) => [...current, { role: "user", text: question }]);
    setInput(""); setSending(true);
    try {
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      const result = await response.json().catch(() => ({}));
      setMessages((current) => [...current, { role: "ai", text: response.ok ? result.answer : (result.error || "The Sales Assistant could not complete the request.") }]);
    } finally { setSending(false); }
  }

  return <AppShell title="Ask the Assistant"><PageHeader eyebrow={workspaceName + " sales copilot"} title="What can I help you sell today?" description="Answers are grounded in approved product knowledge for this workspace."/><div className="chat-layout"><aside className="card chat-sidebar"><h2>Suggested questions</h2><p style={{fontSize:12}}>Try a common sales question for this workspace.</p>{prompts.map((prompt) => <button className="prompt" style={{width:"100%",background:"white",textAlign:"left"}} key={prompt} onClick={() => send(prompt)} disabled={sending}>{prompt}</button>)}<div className="callout" style={{marginTop:18}}><Sparkles size={18}/><h3 style={{marginTop:8}}>Grounded answers</h3><p style={{fontSize:11,margin:0}}>Product answers use approved workspace knowledge only.</p></div></aside><section className="card chat-window"><header className="chat-head"><span className="bot-icon"><Bot size={20}/></span><div><strong>Sales Assistant</strong><small style={{display:"block",color:"#16825d"}}>● Knowledge search enabled</small></div></header><div className="messages">{messages.map((message, index) => <div className={"message " + message.role} key={index}>{message.text}</div>)}</div><form className="composer" onSubmit={(event) => { event.preventDefault(); send(); }}><input className="input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask a question about a customer or product…" aria-label="Message" disabled={sending}/><button className="btn btn-primary" aria-label="Send" disabled={sending}><Send size={17}/><span>{sending ? "Searching…" : "Send"}</span></button></form></section></div></AppShell>;
}
