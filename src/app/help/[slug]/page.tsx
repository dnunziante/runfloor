import Image from "next/image";
import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AskAboutGuide } from "@/components/help-library";
import { helpViewer } from "@/lib/opal/viewer";
import { published } from "@/lib/opal/store";
export const dynamic="force-dynamic";
export default async function ArticlePage({params}:{params:Promise<{slug:string}>}){const viewer=await helpViewer();if(!viewer)redirect("/login");const {slug}=await params;const articles=await published(viewer.role);const article=articles.find(a=>a.slug===slug);if(!article)notFound();return <AppShell title="Help Center" industry="rv"><div className="help-article"><Link href="/help">← All guides</Link><div className="help-eyebrow">{article.category}</div><h1>{article.title}</h1><div className="help-article-byline"><Image src="/opal/opal.png" alt="" width={38} height={38}/><span>Guidance from Opal · Verified {article.verifiedAt}</span></div><p className="help-article-intro">{article.body}</p><ol>{article.steps.map(s=><li key={s}>{s}</li>)}</ol>{article.route!=="/help"&&<Link className="opal-primary" href={article.route}>Open {article.route.split("/").pop()?.replaceAll("-"," ")} →</Link>}<hr/><AskAboutGuide title={article.title}/><p>Still need help? <a href="mailto:support@runfloorai.com">support@runfloorai.com</a></p><h2>Keep exploring</h2>{articles.filter(a=>a.category===article.category&&a.slug!==slug).slice(0,3).map(a=><p key={a.slug}><Link href={`/help/${a.slug}`}>{a.title} →</Link></p>)}</div></AppShell>;}
