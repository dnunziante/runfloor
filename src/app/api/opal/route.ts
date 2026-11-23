import { sameOrigin } from "@/lib/opal/request";
import { NextResponse } from "next/server";
import { helpViewer } from "@/lib/opal/viewer";
import { published, recordEvent } from "@/lib/opal/store";
import { rank, safePage, asksForBusinessRecords } from "@/lib/opal/policy";
import { answerFromGuides } from "@/lib/opal/provider";
import { opalPreview } from "@/lib/opal/preview";
import { createClient } from "@/lib/supabase/server";
export async function POST(request: Request) {
 const viewer=await helpViewer();if(!viewer?.organizationId||viewer.demo&&!opalPreview())return NextResponse.json({error:"Sign in to use Opal."},{status:401});
 if(!sameOrigin(request))return NextResponse.json({error:"Invalid origin."},{status:403});
 if(Number(request.headers.get("content-length")||0)>10000)return NextResponse.json({error:"Question is too long."},{status:413});
 const body=await request.json().catch(()=>null);const question=typeof body?.question==="string"?body.question.trim():"";
 if(body?.workspace!==viewer.organizationId)return NextResponse.json({error:"Workspace changed. Reopen Opal and ask again."},{status:409});
 if(question.length<3||question.length>1200)return NextResponse.json({error:"Enter a question between 3 and 1,200 characters."},{status:400});
 const requestId=request.headers.get("x-runfloor-opal-request")||"";
 if(!/^[0-9a-f-]{36}$/i.test(requestId))return NextResponse.json({error:"Reopen Opal and try again."},{status:400});
 try {
 if(!opalPreview()){const db=await createClient();const {data,error}=await db.rpc("opal_reserve_request");if(error||!data)return NextResponse.json({error:"Opal is busy. Please try again shortly. You can still browse the guides."},{status:429});}
 const articles=asksForBusinessRecords(question)?[]:rank(await published(viewer.role),question,safePage(typeof body.page==="string"?body.page:"").key,viewer.role);
 if(!articles.length){await recordEvent("unanswered",safePage(typeof body.page==="string"?body.page:"").label,[]).catch(()=>{});return NextResponse.json({answer:"I don’t have a verified guide for that yet. I can help explain RunFloor’s tools, but I cannot read dealership activity or change records. Try browsing the Help Center, or email support@runfloorai.com.",sources:[],mode:"unsupported"},{headers:{"Cache-Control":"no-store"}});}
 let result;try{result=await answerFromGuides(question,articles,requestId);}catch{result={answer:"My AI connection is unavailable right now, but this verified guide can help.\n\n"+articles[0].body+"\n\n"+articles[0].steps.map((s,i)=>`${i+1}. ${s}`).join("\n"),mode:"guide",allowance:null,budgetExhausted:false};}
 await recordEvent("answer",articles[0].category,articles.map(a=>a.slug)).catch(()=>{});
 if(typeof result.inputTokens==="number"&&!opalPreview()){const db=await createClient();await db.from("opal_platform_usage").insert({model:"gpt-5-mini",input_tokens:result.inputTokens,output_tokens:result.outputTokens});}
 return NextResponse.json({answer:result.answer,mode:result.mode,sources:articles.map(a=>({slug:a.slug,title:a.title})),allowance:result.allowance,budgetExhausted:result.budgetExhausted},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Opal’s guides are unavailable. Please email support@runfloorai.com."},{status:503});}
}
