"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Play } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";

const scenarios = [
  { title: "The price comparison", level: "Intermediate", copy: "A shopper found a lower advertised price and wants to know why BGC costs more.", opening: "I like the cart, but another dealer has one online for less. Why should I pay more here?", focus: "Validate the concern, ask what the comparison includes, and relate BGC’s included value to the shopper’s priorities." },
  { title: "I need to think about it", level: "Beginner", copy: "Uncover the uncertainty without adding pressure.", opening: "I need to think about it before making a decision.", focus: "Ask an open question to understand what is still uncertain, then agree on a helpful next step." },
  { title: "Premium cart skeptic", level: "Advanced", copy: "Connect Nexus features to a customer focused only on basic transportation.", opening: "I only need a cart to get around. Why would I pay more for the Nexus?", focus: "Confirm the customer’s priorities, then connect only the approved features that matter to their use." },
];

export function LegacyRolePlay() {
  const [active, setActive] = useState<number | null>(null);
  const [response, setResponse] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const startScenario = (index: number) => { setActive(index); setResponse(""); setSubmitted(false); };
  const chooseAnother = () => { setActive(null); setResponse(""); setSubmitted(false); };
  const submitResponse = () => { if (response.trim()) setSubmitted(true); };
  const practiceNext = () => startScenario(active === null ? 0 : (active + 1) % scenarios.length);

  return <AppShell title="Role Play">
    <PageHeader eyebrow="Practice studio" title="Build confidence before the customer arrives" description="Work through realistic dealership conversations and receive simulated coaching."/>
    {active === null ? <div className="grid grid-3">{scenarios.map((scenario, index) => <div className="card scenario" key={scenario.title}><span className="number">0{index + 1}</span><span className="badge blue">{scenario.level}</span><h2 style={{ marginTop: 18 }}>{scenario.title}</h2><p>{scenario.copy}</p><button className="btn btn-primary" onClick={() => startScenario(index)}><Play size={15}/> Start scenario</button></div>)}</div> : <div className="grid grid-2">
      <div className="card"><span className="badge amber">Live practice</span><h2 style={{ marginTop: 15 }}>{scenarios[active].title}</h2><div className="message ai" style={{ maxWidth: "100%", marginTop: 20 }}>{scenarios[active].opening}</div><textarea className="input" rows={7} value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Type how you would respond…" style={{ marginTop: 18 }} disabled={submitted}/>{!submitted ? <><button className="btn btn-primary" style={{ marginTop: 12 }} onClick={submitResponse} disabled={!response.trim()}><ArrowRight size={16}/> Submit response</button>{!response.trim() && <p style={{ fontSize: 12, marginTop: 8 }}>Write a response before submitting.</p>}</> : <div className="output" style={{ marginTop: 14 }}><CheckCircle2 color="#16825d"/><h3>Response submitted</h3><p>You acknowledged the concern and kept the conversation moving. Review the coaching focus, then continue practicing.</p><button className="btn btn-primary" onClick={practiceNext}><ArrowRight size={16}/> Practice next scenario</button></div>}</div>
      <div className="card"><CheckCircle2 color="#16825d"/><h2 style={{ marginTop: 12 }}>{submitted ? "Coaching feedback" : "Coaching focus"}</h2><p>{scenarios[active].focus}</p>{submitted && <p><strong>Next step:</strong> Use a question that keeps the shopper talking before offering a recommendation.</p>}<button className="btn btn-ghost" onClick={chooseAnother}>Choose another scenario</button></div>
    </div>}
  </AppShell>;
}
