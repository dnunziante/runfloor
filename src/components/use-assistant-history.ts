"use client";

import { useState, useSyncExternalStore } from "react";
import type { ConversationTurn } from "@/lib/assistant/workspaces";

export type AssistantMessage = ConversationTurn & { sources?: { documentName: string; section?: string | null; pageNumber?: number | null }[] };

// A component-owned store avoids sharing conversation contents across requests.
// The server snapshot is stable; browser storage is read only after subscription.
function createHistoryStore(key: string, greeting: AssistantMessage) {
  const initial = { messages: [greeting], ready: false, storageAvailable: true };
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (!snapshot.ready) {
        let messages = initial.messages;
        let storageAvailable = true;
        try {
          const saved: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null");
          if (Array.isArray(saved)) {
            const valid = saved.filter((turn) => turn && (turn.role === "ai" || turn.role === "user") && typeof turn.text === "string" && (!turn.sources || (Array.isArray(turn.sources) && turn.sources.every((source: { documentName?: unknown }) => source && typeof source.documentName === "string")))).slice(-60);
            if (valid.length) messages = valid;
          }
        } catch { storageAvailable = false; }
        snapshot = { messages, ready: true, storageAvailable };
        notify();
      }
      return () => { listeners.delete(listener); };
    },
    update(next: AssistantMessage[] | ((current: AssistantMessage[]) => AssistantMessage[])) {
      const messages = (typeof next === "function" ? next(snapshot.messages) : next).slice(-60);
      let storageAvailable = snapshot.storageAvailable;
      try { sessionStorage.setItem(key, JSON.stringify(messages)); } catch { storageAvailable = false; }
      snapshot = { messages, ready: true, storageAvailable };
      notify();
    },
  };
}

export function useAssistantHistory(key: string, greeting: AssistantMessage) {
  // The page keys the component by assistant + tenant + user, so each store has
  // exactly one scope for its lifetime, including in-flight responses.
  const [store] = useState(() => createHistoryStore(key, greeting));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return { ...state, setMessages: store.update };
}
