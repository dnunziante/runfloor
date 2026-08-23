"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CompetitorSourceScanButton({ sourceId }: { sourceId: string }) {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function scan() {
    setIsScanning(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/competitor-sources/${sourceId}/scan`, {
        method: "POST",
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "The source could not be checked.");
      }

      const discovered = Number(result?.discovered || 0);
      setMessage(
        discovered
          ? `${discovered} item${discovered === 1 ? "" : "s"} found for review.`
          : "No new product links were found.",
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The source could not be checked.");
    } finally {
      setIsScanning(false);
    }
  }

  return (
    <div>
      <button className="btn btn-secondary" type="button" disabled={isScanning} onClick={scan}>
        {isScanning ? "Checking…" : "Check for updates"}
      </button>
      {message ? <p className="text-sm mt-2" role="status">{message}</p> : null}
    </div>
  );
}
