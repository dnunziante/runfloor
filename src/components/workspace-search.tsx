"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";

const destinations = [["Home", "/dashboard"],["Performance dashboard", "/dashboard/performance"],["Ask the Assistant", "/assistant"],["Products", "/products"],["Competitors", "/competitors"],["Comparisons", "/comparisons"],["Procedures", "/operations/procedures"],["Tasks and checklists", "/operations/checklists"],["Training", "/training"],["Knowledge Base", "/knowledge-base"],["Sales Coach", "/coach"],["Write an Email", "/email"],["Write a Text", "/text"],["Business Growth", "/growth"]];
export function WorkspaceSearch() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  useEffect(() => { const listener = (event: KeyboardEvent) => {if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase()==="k") {event.preventDefault(); dialog.current?.showModal();}}; window.addEventListener("keydown",listener); return ()=>window.removeEventListener("keydown",listener); }, []);
  return <><button className="search-btn" onClick={()=>dialog.current?.showModal()}><Search size={17}/><span>Search workspace</span><kbd>⌘ K</kbd></button><dialog ref={dialog} aria-labelledby="workspace-search-title" style={{border:"1px solid #dce3ed",borderRadius:14,width:"min(520px, calc(100vw - 32px))",padding:22,maxHeight:"80vh"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:15}}><h2 id="workspace-search-title">Find a tool or resource</h2><button className="icon-btn" aria-label="Close search" onClick={()=>dialog.current?.close()}><X size={18}/></button></div><input className="input" aria-label="Search workspace tools" placeholder="Products, procedures, training..." value={query} onChange={(event)=>setQuery(event.target.value)}/><div style={{display:"grid",gap:5,marginTop:14}}>{destinations.filter(([label])=>label.toLowerCase().includes(query.toLowerCase())).map(([label,href])=><Link className="btn btn-ghost" style={{justifyContent:"flex-start"}} href={href} key={href} onClick={()=>dialog.current?.close()}>{label}</Link>)}</div>{!destinations.some(([label])=>label.toLowerCase().includes(query.toLowerCase())) && <p>No matching tools. Try a different search.</p>}</dialog></>;
}
