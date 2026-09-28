"use client";

import { useState } from "react";

// Copies text, or a site path resolved against the current origin.
export function CopyButton({ text, path, label, done }: { text?: string; path?: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const value = path ? new URL(path, window.location.origin).toString() : (text ?? "");
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt(label, value);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-lg border border-line px-2 py-1 text-xs hover:bg-brand-soft"
    >
      {copied ? done : label}
    </button>
  );
}
