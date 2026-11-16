import "server-only";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@/lib/supabase/server";
import seed from "./seed.json";
import { opalPreview } from "./preview";
import { visible, validArticle, type Article, type HelpRole } from "./policy";
const file = path.join(process.cwd(), ".opal-preview", "articles.json");
let queue: Promise<unknown> = Promise.resolve();
export async function versions(): Promise<Article[]> {
 if(opalPreview()){try{return JSON.parse(await readFile(file,"utf8")) as Article[];}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;return seed as Article[];}}
 const db=await createClient(); const {data,error}=await db.from("opal_article_versions").select("payload,status,version");
 if(error)throw new Error("Help articles are temporarily unavailable. Contact support@runfloorai.com.");
 return (data??[]).map(r=>({...r.payload,status:r.status,version:r.version})) as Article[];
}
export async function published(role: HelpRole) { return (await versions()).filter(a=>visible(a,role)); }
export async function saveArticle(article: Article) {
 if(!validArticle(article))throw new Error("Check the article fields.");
 if(article.status==="published"&&(!article.verified||article.needsReview||!article.evidence.trim()))throw new Error("Verify the guide, add evidence, and clear Needs review before publishing.");
 if(!opalPreview()){const db=await createClient();const {error}=await db.rpc("opal_save_article",{article: {...article,verifiedAt:article.verified?new Date().toISOString().slice(0,10):""}});if(error)throw new Error("The article could not be saved. Refresh and try again.");return;}
 const task=queue.then(async()=>{const all=await versions();const version=Math.max(0,...all.filter(a=>a.slug===article.slug).map(a=>a.version))+1;if(article.status!=="draft")for(const a of all)if(a.slug===article.slug&&a.status==="published")a.status="archived";all.push({...article,version,verifiedAt:article.verified?new Date().toISOString().slice(0,10):""});await mkdir(path.dirname(file),{recursive:true});await writeFile(file+".tmp",JSON.stringify(all));await rename(file+".tmp",file);});queue=task.catch(()=>{});await task;
}
export type HelpEvent = { kind: string; topic: string; source_slugs: string[]; helpful: boolean|null; created_at: string };
const eventFile=path.join(process.cwd(),".opal-preview","events.json");
export async function helpEvents():Promise<HelpEvent[]> { if(opalPreview()){try{return JSON.parse(await readFile(eventFile,"utf8"));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;return [];}}const db=await createClient();const {data,error}=await db.from("opal_events").select("kind,topic,source_slugs,helpful,created_at").or("kind.eq.unanswered,kind.eq.search_empty,helpful.eq.false").order("created_at",{ascending:false}).limit(100);if(error)throw new Error("Feedback unavailable");return data??[]; }
export async function recordEvent(kind: string, topic: string, sourceSlugs: string[], helpful: boolean|null = null) {
 if(opalPreview()){const task=queue.then(async()=>{const events=await helpEvents();events.push({kind,topic,source_slugs:sourceSlugs,helpful,created_at:new Date().toISOString()});await mkdir(path.dirname(eventFile),{recursive:true});await writeFile(eventFile,JSON.stringify(events.slice(-200)));});queue=task.catch(()=>{});await task;return;}
 const db=await createClient();const {error}=await db.from("opal_events").insert({kind,topic,source_slugs:sourceSlugs,helpful});if(error)throw new Error("Feedback unavailable");
}
