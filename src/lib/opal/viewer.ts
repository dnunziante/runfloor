import "server-only";
import { getViewer, type Viewer } from "@/lib/auth/viewer";
import { opalPreview } from "./preview";
export async function helpViewer(): Promise<Viewer|null> { if(opalPreview())return {id:"opal-preview",email:"",fullName:"Preview",initials:"OP",organizationId:"opal-preview",organizationName:"RunFloor preview",role:"platform_owner",demo:true};return getViewer(); }
export function canEditHelp(viewer: Viewer|null) { return !!viewer && viewer.role==="platform_owner" && (!viewer.demo||opalPreview()); }
