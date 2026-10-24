"use client";

import { useState } from "react";

function filenameFromDisposition(header: string | null) {
  const match = /filename="([^"]+)"/.exec(header ?? "");
  return match?.[1] ?? null;
}

export function BackupDownload() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/pandemic/backup");
      const type = response.headers.get("content-type") ?? "";
      if (!response.ok || !type.includes("application/zip")) {
        let message = "Zálohu se nepodařilo stáhnout.";
        if (type.includes("application/json")) {
          const payload = (await response.json()) as { error?: string };
          if (payload.error) message = payload.error;
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        filenameFromDisposition(response.headers.get("content-disposition")) ??
        "pandemic-zaloha.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Zálohu se nepodařilo stáhnout.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        onClick={() => void download()}
        disabled={pending}
        className="inline-flex h-9 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:text-white disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Připravuji zálohu…" : "Stáhnout zálohu"}
      </button>
      {error ? <p className="max-w-xs text-xs text-red-300 sm:text-right">{error}</p> : null}
    </div>
  );
}
