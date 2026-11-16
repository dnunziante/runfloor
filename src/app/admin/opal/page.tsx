import {redirect} from "next/navigation";
import {AppShell} from "@/components/app-shell";
import {OpalAdmin} from "@/components/opal-admin";
import {helpViewer,canEditHelp} from "@/lib/opal/viewer";
import {versions,helpEvents} from "@/lib/opal/store";
import {opalPreview} from "@/lib/opal/preview";
export const dynamic="force-dynamic";
export default async function Admin(){if(!canEditHelp(await helpViewer()))redirect('/help');let error="";let articles:Awaited<ReturnType<typeof versions>>=[];let events:{kind:string;topic:string;helpful:boolean|null}[]=[];try{articles=await versions();events=(await helpEvents()).filter(e=>e.kind==="unanswered"||e.kind==="search_empty"||e.helpful===false);}catch{error="Article storage is unavailable. Apply the reviewed Opal schema to the test environment before using administration.";}return <AppShell title="Opal & Help Center" industry="rv">{error?<p role="alert">{error}</p>:<OpalAdmin versions={articles} events={events} preview={opalPreview()}/>}</AppShell>;}
