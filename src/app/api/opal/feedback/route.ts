import { sameOrigin } from "@/lib/opal/request";
import {NextResponse} from "next/server";
import {helpViewer} from "@/lib/opal/viewer";
import {published,recordEvent} from "@/lib/opal/store";
import {opalPreview} from "@/lib/opal/preview";
export async function POST(request:Request){const viewer=await helpViewer();if(!viewer||viewer.demo&&!opalPreview())return NextResponse.json({error:"Sign in."},{status:401});if(!sameOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403});const b=await request.json().catch(()=>null);if(typeof b?.helpful!=="boolean"||typeof b?.slug!=="string")return NextResponse.json({error:"Invalid feedback"},{status:400});try{const a=(await published(viewer.role)).find(a=>a.slug===b.slug);if(!a)return NextResponse.json({error:"Guide unavailable"},{status:404});await recordEvent("feedback",a.category,[a.slug],b.helpful);return NextResponse.json({ok:true});}catch{return NextResponse.json({error:"Feedback unavailable"},{status:503});}}
