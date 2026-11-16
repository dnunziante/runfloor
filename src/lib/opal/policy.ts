export type HelpRole = "platform_owner" | "tenant_admin" | "manager" | "salesperson";
export const categories = ["Getting Started", "Sales", "Operations", "Executive", "Team & Administration", "Billing & AI Credits", "Troubleshooting"] as const;
export type Article = { slug: string; title: string; summary: string; category: string; body: string; steps: string[]; roles: HelpRole[]; route: string; verified: boolean; verifiedAt: string; evidence: string; status: "draft" | "published" | "archived"; version: number; needsReview: boolean };
export const allRoles: HelpRole[] = ["platform_owner", "tenant_admin", "manager", "salesperson"];
export const managerRoles: HelpRole[] = ["platform_owner", "tenant_admin", "manager"];
export const adminRoles: HelpRole[] = ["platform_owner", "tenant_admin"];
export function visible(article: Article, role: HelpRole) { return article.status === "published" && article.verified && !article.needsReview && article.roles.includes(role) && (!( /^\/(executive|growth)(\/|$)/.test(article.route)) || managerRoles.includes(role)) && (!/^\/admin(\/|$)/.test(article.route) || adminRoles.includes(role)); }
export function safePage(path: string) {
 const clean = path.split(/[?#]/)[0];
 const routes: Record<string,string> = { "/dashboard":"Home", "/assistant":"Sales AI Assistant", "/products":"RVs & Inventory", "/competitors":"Competitors", "/comparisons":"Product Comparisons", "/messages":"Message Center", "/knowledge-base":"Knowledge Base", "/pricing-calculator":"Quote & Loan Calculator", "/analytics":"Sales Analytics", "/operations":"Operations", "/operations/checklists":"Checklists", "/operations/procedures":"Procedures", "/operations/calendar":"Task Calendar", "/operations/schedules":"Recurring Schedules", "/executive":"Executive Dashboard", "/executive/trends":"Historical Trends", "/executive/review":"Monthly Review", "/growth/priorities":"Priority Scoring", "/billing":"Subscription & Billing", "/ai-usage":"AI Usage & Billing", "/admin/settings":"Settings", "/admin/users":"Team Members", "/help":"Help Center" };
 return routes[clean] ? { key: clean, label: routes[clean] } : {key: "/help", label: "RunFloor"};
}
const stop = new Set(["how","can","the","and","for","with","what","does","this","that","help","opal","runfloor","please","where","about","are","use","you","your","want","have"]);
export function rank(articles: Article[], question: string, page: string, role: HelpRole) {
 if (/what can opal|who is opal|meet opal/i.test(question)) return articles.filter(a=>a.slug==="meet-opal"&&visible(a,role));
 const words = [...new Set(question.toLowerCase().match(/[a-z0-9]+/g) ?? [])].filter(w=>w.length>2&&!stop.has(w));
 const here = /this page|this screen|help here/i.test(question);
 return articles.filter(a=>visible(a,role)).map(a=>{const title=(a.title+" "+a.summary).toLowerCase();const text=(a.body+" "+a.steps.join(" ")).toLowerCase();const matches=words.reduce((n,w)=>n+(title.includes(w)?4:0)+(text.includes(w)?1:0),0);return {a,score:matches+(a.route===safePage(page).key&&(matches>0||here)?(here?6:1):0)};}).filter(x=>x.score>=4).sort((a,b)=>b.score-a.score).slice(0,3).map(x=>x.a);
}
export function supportLink(page: string, transcript = "") { return "mailto:support@runfloorai.com?subject="+encodeURIComponent("RunFloor Support — "+safePage(page).label)+"&body="+encodeURIComponent("Page: "+safePage(page).label+"\n\nWhat were you trying to do?\n\nWhat happened?\n"+(transcript?"\nConversation (included by you):\n"+transcript.slice(-5000):"")); }
export function validArticle(value: unknown): value is Article {
 if(!value||typeof value!=="object")return false;const a=value as Article;
 return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug)&&a.slug.length<=100&&typeof a.title==="string"&&a.title.length>2&&a.title.length<=160&&typeof a.summary==="string"&&a.summary.length<=500&&categories.includes(a.category as typeof categories[number])&&typeof a.body==="string"&&a.body.length<=12000&&Array.isArray(a.steps)&&a.steps.length<=20&&a.steps.every(s=>typeof s==="string"&&s.length<=1000)&&Array.isArray(a.roles)&&a.roles.length>0&&a.roles.every(r=>allRoles.includes(r))&&typeof a.route==="string"&&a.route.startsWith("/")&&!a.route.startsWith("//")&&!/[?#\\]/.test(a.route)&&typeof a.evidence==="string"&&a.evidence.length<=1000&&typeof a.verified==="boolean"&&typeof a.needsReview==="boolean"&&["draft","published","archived"].includes(a.status);
}

export function asksForBusinessRecords(question:string) { return !/^(how do|how can|where|explain|what does|what is (?:a|the) (?:feature|tool|dashboard))/i.test(question.trim()) && /^(who|which|how many|what (?:is|are) (?:our|my|the current)|show|list|summari[sz]e|review (?:our|my))/i.test(question.trim()) && /employee|rep\b|checklist|overdue|revenue|sales|target|performance|customer|handoff|incident|activity|inventory|balance|our data/i.test(question); }
