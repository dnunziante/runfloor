import type { KnowledgeAnswer } from "./types.ts";
export async function consumeKnowledgeStream(response: Response, update?: (text: string, metadata: KnowledgeAnswer["metadata"] | null) => void): Promise<KnowledgeAnswer> {
  if (!response.body) throw new Error("Missing answer stream");
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let result: KnowledgeAnswer | null = null; let text = ""; let metadata: KnowledgeAnswer["metadata"] | null = null;
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let end: number;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        const event = frame.match(/^event: (.+)$/m)?.[1]; const raw = frame.match(/^data: (.+)$/m)?.[1];
        if (!raw) continue;
        const data = JSON.parse(raw);
        if (event === "metadata") metadata = data;
        if (event === "delta" && typeof data.text === "string") { text += data.text; update?.(text, metadata); }
        if (event === "error") throw new Error("Answer unavailable");
        if (event === "complete") result = data;
      }
      if (done) break;
    }
  } finally { reader.releaseLock(); }
  if (!result?.metadata || typeof result.answer !== "string") throw new Error("Incomplete answer");
  return result;
}
