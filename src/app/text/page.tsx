import { redirect } from "next/navigation";

export default function TextPage() { redirect("/messages?kind=text"); }
