"use client";

import { useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Copy, LoaderCircle, Sparkles } from "lucide-react";

type Tone = "Professional" | "Friendly" | "Direct" | "Urgency" | "Re-engagement";
type EmailDraft = { subject: string; body: string; primaryCallToAction: string };
type TextDraft = { message: string; primaryCallToAction: string };
const tones: Tone[] = ["Professional", "Friendly", "Direct", "Urgency", "Re-engagement"];

export function MessageGenerator({ kind, productOptions = [] }: { kind: "email" | "text"; productOptions?: string[] }) {
  return kind === "email" ? <EmailGenerator productOptions={productOptions}/> : <TextGenerator productOptions={productOptions}/>;
}

function EmailGenerator({ productOptions }: { productOptions: string[] }) {
  const [form, setForm] = useState({ customerName: "", product: "", leadStage: "New lead", customerNeeds: "", previousConversation: "", objection: "", desiredNextAction: "", tone: "Professional" as Tone });
  const [draft, setDraft] = useState<EmailDraft | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [copied, setCopied] = useState(false);
  const update = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  async function generate(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError(""); setCopied(false);
    try { const response = await fetch("/api/email-generator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "The email could not be generated."); setDraft(data as EmailDraft); }
    catch (generationError) { setError(generationError instanceof Error ? generationError.message : "The email could not be generated."); }
    finally { setLoading(false); }
  }
  const copyDraft = () => { if (!draft) return; navigator.clipboard?.writeText(`Subject: ${draft.subject}\n\n${draft.body}`); setCopied(true); };
  return <AppShell title="Write an Email"><PageHeader eyebrow="AI message studio" title="Write a customer-ready sales email" description="Create a concise, personal follow-up grounded in your conversation and approved RunFloor data."/><div className="grid grid-2 email-generator-layout"><form className="card form-stack" onSubmit={generate}>
    <div className="grid grid-2"><label><span className="label">Customer name</span><input className="input" required value={form.customerName} onChange={(event) => update("customerName", event.target.value)} placeholder="e.g. Taylor Morgan"/></label><label><span className="label">Product or model</span><input className="input" list="approved-email-products" value={form.product} onChange={(event) => update("product", event.target.value)} placeholder="e.g. Beyond 4 Passenger"/><datalist id="approved-email-products">{productOptions.map((product) => <option value={product} key={product}/>)}</datalist></label></div>
    <div className="grid grid-2"><label><span className="label">Lead stage</span><select className="input" value={form.leadStage} onChange={(event) => update("leadStage", event.target.value)}><option>New lead</option><option>Contacted</option><option>Considering options</option><option>Appointment scheduled</option><option>Quote provided</option><option>Decision pending</option><option>Past customer</option></select></label><label><span className="label">Tone</span><select className="input" value={form.tone} onChange={(event) => update("tone", event.target.value)}>{tones.map((tone) => <option key={tone}>{tone}</option>)}</select></label></div>
    <label><span className="label">Customer needs</span><textarea className="input" rows={3} value={form.customerNeeds} onChange={(event) => update("customerNeeds", event.target.value)} placeholder="Passenger capacity, use case, comfort, range, timeline…"/></label>
    <label><span className="label">Previous conversation</span><textarea className="input" rows={4} value={form.previousConversation} onChange={(event) => update("previousConversation", event.target.value)} placeholder="What did you discuss, promise, or agree to follow up on?"/></label>
    <label><span className="label">Objection or concern</span><textarea className="input" rows={2} value={form.objection} onChange={(event) => update("objection", event.target.value)} placeholder="e.g. Comparing price and passenger capacity"/></label>
    <label><span className="label">Desired next action</span><input className="input" value={form.desiredNextAction} onChange={(event) => update("desiredNextAction", event.target.value)} placeholder="e.g. Choose between a Tuesday afternoon or Wednesday morning visit"/></label>
    {error && <p className="form-error" role="alert">{error}</p>}<button className="btn btn-primary" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={17}/> Writing email…</> : <><Sparkles size={17}/> Generate email</>}</button>
  </form><section className={`output email-draft-output ${!draft && !loading ? "empty" : ""}`} aria-live="polite">{loading ? <div style={{ textAlign: "center" }}><LoaderCircle className="spin"/><h2>Writing a concise, personalized draft…</h2></div> : draft ? <div><div className="metric-row"><div><span className="badge blue">Draft email</span><h2>{draft.subject}</h2></div><button className="btn btn-ghost" type="button" onClick={copyDraft}><Copy size={15}/> {copied ? "Copied" : "Copy"}</button></div><p className="email-draft-body">{draft.body}</p><div className="callout email-primary-cta"><span className="label">Primary next step</span><strong>{draft.primaryCallToAction}</strong></div></div> : <div><Sparkles size={30}/><h2>Your personalized draft will appear here</h2><p>Add the details you know. Dealership facts come only from approved RunFloor product and knowledge data.</p></div>}</section></div></AppShell>;
}

function TextGenerator({ productOptions }: { productOptions: string[] }) {
  const [form, setForm] = useState({ customerName: "", product: "", leadStage: "New lead", customerNeeds: "", previousConversation: "", objection: "", desiredNextAction: "", tone: "Professional" as Tone });
  const [draft, setDraft] = useState<TextDraft | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [copied, setCopied] = useState(false);
  const update = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  async function generate(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError(""); setCopied(false);
    try { const response = await fetch("/api/text-generator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "The text could not be generated."); setDraft(data as TextDraft); }
    catch (generationError) { setError(generationError instanceof Error ? generationError.message : "The text could not be generated."); }
    finally { setLoading(false); }
  }
  const copyDraft = () => { if (!draft) return; navigator.clipboard?.writeText(draft.message); setCopied(true); };
  return <AppShell title="Write a Text"><PageHeader eyebrow="AI message studio" title="Write a customer-ready sales text" description="Create a concise, personal message grounded in your conversation and approved RunFloor data."/><div className="grid grid-2 email-generator-layout"><form className="card form-stack" onSubmit={generate}>
    <div className="grid grid-2"><label><span className="label">Customer name</span><input className="input" required value={form.customerName} onChange={(event) => update("customerName", event.target.value)} placeholder="e.g. Taylor Morgan"/></label><label><span className="label">Product or model</span><input className="input" list="approved-text-products" value={form.product} onChange={(event) => update("product", event.target.value)} placeholder="e.g. Beyond 4 Passenger"/><datalist id="approved-text-products">{productOptions.map((product) => <option value={product} key={product}/>)}</datalist></label></div>
    <div className="grid grid-2"><label><span className="label">Lead stage</span><select className="input" value={form.leadStage} onChange={(event) => update("leadStage", event.target.value)}><option>New lead</option><option>Contacted</option><option>Considering options</option><option>Appointment scheduled</option><option>Quote provided</option><option>Decision pending</option><option>Past customer</option></select></label><label><span className="label">Tone</span><select className="input" value={form.tone} onChange={(event) => update("tone", event.target.value)}>{tones.map((tone) => <option key={tone}>{tone}</option>)}</select></label></div>
    <label><span className="label">Customer needs</span><textarea className="input" rows={3} value={form.customerNeeds} onChange={(event) => update("customerNeeds", event.target.value)} placeholder="Passenger capacity, use case, comfort, range, timeline…"/></label>
    <label><span className="label">Previous conversation</span><textarea className="input" rows={3} value={form.previousConversation} onChange={(event) => update("previousConversation", event.target.value)} placeholder="What did you discuss or agree to follow up on?"/></label>
    <label><span className="label">Objection or concern</span><textarea className="input" rows={2} value={form.objection} onChange={(event) => update("objection", event.target.value)} placeholder="e.g. Comparing price and passenger capacity"/></label>
    <label><span className="label">Desired next action</span><input className="input" value={form.desiredNextAction} onChange={(event) => update("desiredNextAction", event.target.value)} placeholder="e.g. Choose a time for a walkthrough"/></label>
    {error && <p className="form-error" role="alert">{error}</p>}<button className="btn btn-primary" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={17}/> Writing text…</> : <><Sparkles size={17}/> Generate text</>}</button>
  </form><section className={`output email-draft-output ${!draft && !loading ? "empty" : ""}`} aria-live="polite">{loading ? <div style={{ textAlign: "center" }}><LoaderCircle className="spin"/><h2>Writing a concise, personalized text…</h2></div> : draft ? <div><div className="metric-row"><span className="badge blue">Draft text</span><button className="btn btn-ghost" type="button" onClick={copyDraft}><Copy size={15}/> {copied ? "Copied" : "Copy"}</button></div><p className="email-draft-body">{draft.message}</p><div className="callout email-primary-cta"><span className="label">Primary next step</span><strong>{draft.primaryCallToAction}</strong></div></div> : <div><Sparkles size={30}/><h2>Your personalized text will appear here</h2><p>Add the details you know. Dealership facts come only from approved RunFloor product and knowledge data.</p></div>}</section></div></AppShell>;
}
