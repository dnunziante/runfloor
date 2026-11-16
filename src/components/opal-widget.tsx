"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { X, Send, BookOpen, Mail, Plus, ArrowUpRight, ThumbsUp, ThumbsDown } from "lucide-react";
import { safePage, supportLink } from "@/lib/opal/policy";
import "./opal.css";

type Turn = { question: string; answer: string; sources: { slug: string; title: string }[]; feedback?: boolean; mode?: string };
type Context = { id?: string; organizationId: string; demo: boolean };


export function OpalWidget() {
  const pathname = usePathname();
  const session = useRef<{ key: string; turns: Turn[] }>({ key: "", turns: [] });
  const [revision, setRevision] = useState(0);
  const [context, setContext] = useState<Context | null>(null);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [support, setSupport] = useState(false);
  const [include, setInclude] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const panel = useRef<HTMLElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const controller = useRef<AbortController | null>(null);
  const requestKey = useRef("");
  const allowed = pathname.startsWith("/help") || pathname.startsWith("/admin") || /^\/(dashboard|assistant|products|competitors|comparisons|messages|knowledge-base|pricing-calculator|ai-usage|billing|operations|executive|growth|analytics)(\/|$)/.test(pathname);

  useEffect(() => {
    let active = true;
    fetch("/api/opal/context", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then((data: Context | null) => {
      if (!active) return;
      const key = data ? `${data.id}:${data.organizationId}` : "";
      requestKey.current = key;
      if (key !== session.current.key || !allowed) { controller.current?.abort(); session.current = { key, turns: [] }; setTurns([]); setBusy(false); setOpen(false); setSupport(false); setInclude(false); }
      else setTurns(session.current.turns);
      setContext(data);
    }).catch(() => { if (active) setContext(null); });
    return () => { active = false; };
  }, [pathname, allowed, revision]);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const shell=document.querySelector<HTMLElement>(".shell"); if(shell)shell.inert=true;
    const overflow=document.body.style.overflow; document.body.style.overflow="hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); launcher.current?.focus(); }
      if (e.key === "Tab") {
        const items = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], textarea, input');
        if (!items?.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); if(shell)shell.inert=false; document.body.style.overflow=overflow; };
  }, [open, pathname]);

  useEffect(() => {
    const reset = () => { controller.current?.abort(); session.current = {key:"",turns:[]}; requestKey.current=""; setTurns([]); setContext(null); setOpen(false); setSupport(false); setInclude(false); setRevision(n=>n+1); };
    window.addEventListener("opal:reset",reset);
    const ask = (event: Event) => { setOpen(true); setQuestion((event as CustomEvent<string>).detail); };
    window.addEventListener("opal:ask", ask);
    return () => { window.removeEventListener("opal:ask", ask); window.removeEventListener("opal:reset",reset); };
  }, []);

  if (!allowed || !context) return null;
  const page = safePage(pathname);
  const suggestions = pathname === "/ai-usage" ? ["How do AI credits work?", "Where can I see usage history?"] : pathname.startsWith("/operations") ? ["How do I find a procedure?", "How does the task calendar work?"] : ["How do I find my way around?", "What can Opal help with?"];

  async function ask(value: string) {
    const q = value.trim(); if (busy || q.length < 3) return;
    setBusy(true); setError(""); setQuestion("");
    const key = requestKey.current;
    controller.current = new AbortController();
    try {
      const response = await fetch("/api/opal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, page: page.key, workspace: context?.organizationId }), signal: controller.current.signal });
      const data = await response.json();
      if (key !== requestKey.current) return;
      if (!response.ok) throw new Error(data.error || "Opal could not answer. Try a guide below.");
      const next = [...session.current.turns, { question: q, answer: data.answer, sources: data.sources, mode: data.mode }].slice(-8);
      session.current = { key, turns: next }; setTurns(next);
    } catch (e) { if ((e as Error).name !== "AbortError") setError((e as Error).message); }
    finally { if (key === requestKey.current) setBusy(false); }
  }
  async function feedback(index: number, helpful: boolean) {
    const turn = turns[index];
    try {
      const r = await fetch("/api/opal/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: turn.sources[0]?.slug, helpful }) });
      if (!r.ok) throw new Error();
      const next = turns.map((t, i) => i === index ? { ...t, feedback: helpful } : t); session.current.turns = next; setTurns(next);
    } catch { setError("Feedback could not be saved. Your conversation is still available."); }
  }
  return <>
    <button ref={launcher} className="opal-launcher" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="opal-panel"><Image src="/opal/opal.png" alt="" width={44} height={44}/><span>Ask Opal</span></button>
    {open && <section ref={panel} id="opal-panel" className="opal-panel" role="dialog" aria-modal="true" aria-label="Opal, your RunFloor guide">
      <header className="opal-panel-header"><Image src="/opal/opal.png" alt="Opal, a cream dog with tan ears" width={50} height={50}/><div><strong>Opal</strong><small>Your RunFloor guide</small></div><button aria-label="New conversation" title="New conversation" onClick={() => { controller.current?.abort(); session.current.turns = []; setTurns([]); setBusy(false); setError(""); setInclude(false); setSupport(false); }}><Plus size={18}/></button><button aria-label="Close Opal" onClick={() => { setOpen(false); launcher.current?.focus(); }}><X size={20}/></button></header>
      <div className="opal-context">Here to help with <strong>{page.label}</strong></div>
      <div className="opal-conversation">
        {!turns.length && <div className="opal-welcome"><Image src="/opal/opal.png" alt="" width={104} height={104}/><h2>Hi, I’m Opal!</h2><p>Tell me what you’re trying to do, and I’ll help you find your way around RunFloor.</p><div className="opal-suggestions">{suggestions.map(q => <button disabled={busy} key={q} onClick={() => ask(q)}>{q}<ArrowUpRight size={15}/></button>)}<button disabled={busy} onClick={() => ask("Help with this page")}>Help with this page<ArrowUpRight size={15}/></button></div></div>}
        <div aria-live="polite" aria-relevant="additions">{turns.map((t, i) => <article className="opal-turn" key={i}><p className="opal-question">{t.question}</p><div className="opal-answer"><strong>Opal</strong><p>{t.answer}</p>{t.mode === "guide" && <small>From a verified guide</small>}<div className="opal-sources">{t.sources.map(s => <Link key={s.slug} href={`/help/${s.slug}`}>{s.title}<ArrowUpRight size={14}/></Link>)}</div>{t.sources.length > 0 && <div className="opal-feedback">{t.feedback !== undefined ? <small>Thanks for helping me improve.</small> : <><span>Was this helpful?</span><button aria-label="Helpful" onClick={() => feedback(i, true)}><ThumbsUp size={14}/></button><button aria-label="Not helpful" onClick={() => feedback(i, false)}><ThumbsDown size={14}/></button></>}</div>}</div></article>)}</div>
        {busy && <p role="status">Opal is finding a guide…</p>}{error && <p role="alert" className="opal-error">{error}</p>}
      </div>
      {support && <div className="opal-support"><strong>Let’s get you some extra help.</strong><p>Your email app opens a draft for you to review and send.</p><label><input type="checkbox" checked={include} onChange={e => setInclude(e.target.checked)}/> Include this conversation</label><a href={supportLink(pathname, include ? turns.map(t => `You: ${t.question}\nOpal: ${t.answer}`).join("\n\n") : "")}>Email support@runfloorai.com</a></div>}
      <form className="opal-compose" onSubmit={e => { e.preventDefault(); ask(question); }}><label className="sr-only" htmlFor="opal-question">Ask Opal</label><textarea ref={input} id="opal-question" maxLength={1200} rows={2} placeholder="What are you trying to do?" value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(question); } }}/><button aria-label="Send question" disabled={busy || question.trim().length < 3}><Send size={18}/></button></form>
      <footer className="opal-panel-footer"><Link href="/help"><BookOpen size={15}/> Browse guides</Link><button onClick={() => setSupport(!support)}><Mail size={15}/> Contact support</button><small>Included help · No AI credits used</small></footer>
    </section>}
  </>;
}
