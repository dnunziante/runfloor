import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { HelpLibrary } from "@/components/help-library";
import { helpViewer } from "@/lib/opal/viewer";
import { published } from "@/lib/opal/store";
import type { Article } from "@/lib/opal/policy";
export const dynamic="force-dynamic";
export default async function HelpPage(){const viewer=await helpViewer();if(!viewer)redirect("/login");let articles:Article[]=[];let error="";try{articles=await published(viewer.role);}catch{error="Guides are temporarily unavailable. Email support@runfloorai.com for help.";}return <AppShell title="Help Center" industry="rv"><HelpLibrary articles={articles} error={error}/></AppShell>;}
