"use client";
import { useRef, useState, type FormEvent } from "react";

export function useSaveFeedback(setError: (message: string) => void) {
 const pending = useRef(false);
 const [saving, setSaving] = useState(false);
 async function submit(event: FormEvent<HTMLFormElement>, action: (event: FormEvent<HTMLFormElement>) => Promise<void>) {
  event.preventDefault();
  if (pending.current) return;
  pending.current = true; setSaving(true);
  try { await action(event); }
  catch { setError("Could not save. Your edits are still here. Check the connection and try again."); }
  finally { pending.current = false; setSaving(false); }
 }
 return { saving, submit };
}
