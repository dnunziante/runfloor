import type { KnowledgeDocumentDTO } from "@/lib/knowledge/types";
import type { TrainingLessonDTO, TrainingModuleDTO } from "@/lib/training/types";

const createdAt="2026-08-01T12:00:00.000Z";
const lessonSpecs=[
 ["10000000-0000-4000-8000-000000000001","Welcome to RunFloor","General","RunFloor Demo Orientation.pdf",8],
 ["10000000-0000-4000-8000-000000000002","Customer discovery fundamentals","Sales process","Customer Discovery Guide.pdf",12],
 ["10000000-0000-4000-8000-000000000003","Presenting value confidently","Sales process","Value Presentation Guide.pdf",10],
 ["10000000-0000-4000-8000-000000000004","ActivEV Pulse overview","Product knowledge","ActivEV Pulse Product Guide.pdf",10],
 ["10000000-0000-4000-8000-000000000005","Bintelli Beyond overview","Product knowledge","Bintelli Beyond Product Guide.pdf",10],
 ["10000000-0000-4000-8000-000000000006","Bintelli Nexus overview","Product knowledge","Bintelli Nexus Product Guide.pdf",10],
 ["10000000-0000-4000-8000-000000000007","SIVO Edge overview","Product knowledge","SIVO Edge Product Guide.pdf",10],
 ["10000000-0000-4000-8000-000000000008","Customer information handling","Policies","Customer Information Policy.pdf",9],
 ["10000000-0000-4000-8000-000000000009","Test-drive safety","Operations","Test Drive Safety Procedure.pdf",8],
 ["10000000-0000-4000-8000-000000000010","Daily showroom readiness","Operations","Showroom Readiness Checklist.pdf",7],
] as const;
export const demoTrainingLessons:TrainingLessonDTO[]=lessonSpecs.map(([id,title,collection,sourceFilename,estimatedMinutes])=>({id,knowledgeDocumentId:id.replace(/.$/,"f"),title,description:`${collection} demonstration lesson using sanitized sample content.`,estimatedMinutes,sourceFilename,mimeType:"application/pdf",collection,createdAt,content:{learningObjectives:[],sections:[],keyTakeaways:[],practicalApplication:"",scenario:null,knowledgeCheck:[]},isPublished:true,generationStatus:"ready",trainingType:"auto_detect",includeKnowledgeCheck:true,sourceReviewRequired:false}));
export const demoKnowledgeDocuments:KnowledgeDocumentDTO[]=demoTrainingLessons.map((lesson,index)=>({id:lesson.knowledgeDocumentId,title:lesson.title,filename:lesson.sourceFilename,collection:lesson.collection,mimeType:"application/pdf",sizeBytes:180000+index*24000,status:"Ready",createdAt,chunkCount:8+index,trainingLessonId:lesson.id}));
const modules=[
 ["20000000-0000-4000-8000-000000000001","Getting Started","General",[0]],
 ["20000000-0000-4000-8000-000000000002","Consultative Sales Process","Sales process",[1,2]],
 ["20000000-0000-4000-8000-000000000003","BGC Product Certification","Product knowledge",[3,4,5,6]],
 ["20000000-0000-4000-8000-000000000004","Customer and Dealership Policies","Policies",[7]],
 ["20000000-0000-4000-8000-000000000005","Daily Operations","Operations",[8,9]],
] as const;
export const demoTrainingModules:TrainingModuleDTO[]=modules.map(([id,title,category,indexes])=>({id,title,category,description:`A complete ${category.toLowerCase()} module for the RunFloor demo.`,isPublished:true,createdAt,lessons:indexes.map((index)=>demoTrainingLessons[index])}));

const rvLessonSpecs=[
 ["30000000-0000-4000-8000-000000000001","Welcome to the RV demo","General","RV Demo Orientation.pdf",8],
 ["30000000-0000-4000-8000-000000000002","RV customer discovery fundamentals","Sales process","RV Customer Discovery Guide.pdf",12],
 ["30000000-0000-4000-8000-000000000003","Presenting an RV walk-through","Sales process","RV Walk-Through Guide.pdf",10],
 ["30000000-0000-4000-8000-000000000004","Understanding RV categories","Product knowledge","RV Categories Guide.pdf",10],
 ["30000000-0000-4000-8000-000000000005","Tow vehicle and compatibility checks","Product knowledge","Tow Compatibility Checklist.pdf",10],
 ["30000000-0000-4000-8000-000000000006","RV delivery orientation","Product knowledge","RV Delivery Orientation.pdf",10],
 ["30000000-0000-4000-8000-000000000007","Customer information handling","Policies","Customer Information Policy.pdf",9],
 ["30000000-0000-4000-8000-000000000008","RV lot and walk-through safety","Operations","RV Safety Procedure.pdf",8],
 ["30000000-0000-4000-8000-000000000009","Daily RV lot readiness","Operations","RV Lot Readiness Checklist.pdf",7],
] as const;
export const publicRvDemoTrainingLessons:TrainingLessonDTO[]=rvLessonSpecs.map(([id,title,collection,sourceFilename,estimatedMinutes])=>({id,knowledgeDocumentId:id.replace(/.$/,"f"),title,description:`${collection} demonstration lesson for an RV dealership workflow.`,estimatedMinutes,sourceFilename,mimeType:"application/pdf",collection,createdAt,content:{learningObjectives:[],sections:[],keyTakeaways:[],practicalApplication:"",scenario:null,knowledgeCheck:[]},isPublished:true,generationStatus:"ready",trainingType:"auto_detect",includeKnowledgeCheck:true,sourceReviewRequired:false}));
export const publicRvDemoKnowledgeDocuments:KnowledgeDocumentDTO[]=publicRvDemoTrainingLessons.map((lesson,index)=>({id:lesson.knowledgeDocumentId,title:lesson.title,filename:lesson.sourceFilename,collection:lesson.collection,mimeType:"application/pdf",sizeBytes:180000+index*24000,status:"Ready",createdAt,chunkCount:8+index,trainingLessonId:lesson.id}));
const rvModules=[
 ["40000000-0000-4000-8000-000000000001","Getting Started","General",[0]],
 ["40000000-0000-4000-8000-000000000002","RV Sales Process","Sales process",[1,2]],
 ["40000000-0000-4000-8000-000000000003","RV Product and Delivery Readiness","Product knowledge",[3,4,5]],
 ["40000000-0000-4000-8000-000000000004","Customer and Dealership Policies","Policies",[6]],
 ["40000000-0000-4000-8000-000000000005","Daily RV Operations","Operations",[7,8]],
] as const;
export const publicRvDemoTrainingModules:TrainingModuleDTO[]=rvModules.map(([id,title,category,indexes])=>({id,title,category,description:`A complete ${category.toLowerCase()} module for the public RV demo.`,isPublished:true,createdAt,lessons:indexes.map((index)=>publicRvDemoTrainingLessons[index])}));
