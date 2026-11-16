import { sameOrigin } from "@/lib/opal/request";
import {NextResponse} from "next/server";
import {helpViewer,canEditHelp} from "@/lib/opal/viewer";
import {saveArticle} from "@/lib/opal/store";
import {validArticle} from "@/lib/opal/policy";
export async function POST(request:Request){if(!canEditHelp(await helpViewer()))return NextResponse.json({error:"Platform owner access required."},{status:403});if(!sameOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403});const article=await request.json().catch(()=>null);if(!validArticle(article))return NextResponse.json({error:"Check the article fields."},{status:400});try{await saveArticle(article);return NextResponse.json({ok:true});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Save failed."},{status:400});}}
