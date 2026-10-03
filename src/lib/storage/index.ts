import { randomUUID } from "node:crypto";
import path from "node:path";
import { LocalDiskStorage } from "./local";

// Blob storage for listing photos and verification documents. Only local disk for now; a
// cloud implementation can replace it behind the same interface.
//
// This module reads STORAGE_DIR from process.env itself (not through src/lib/env.ts) so the
// seed script and test setup can use it outside Next.js.

export interface Storage {
  put(key: string, data: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

export const DEFAULT_STORAGE_DIR = ".data/storage";

export type KeyPrefix = "photos" | "documents";

const KEY_PATTERN = /^(photos|documents)\/[a-z0-9][a-z0-9/_.-]*$/;

// photos/... and documents/... only, lowercase, no "..", no "//", no trailing slash.
export function isValidKey(key: string): boolean {
  return (
    typeof key === "string" &&
    key.length <= 512 &&
    KEY_PATTERN.test(key) &&
    !key.includes("..") &&
    !key.includes("//") &&
    !key.endsWith("/")
  );
}

// photos/2026/10/<uuid>.jpg
export function newKey(prefix: KeyPrefix, ext: string, now: Date = new Date()): string {
  const extension = ext.replace(/^\./, "").toLowerCase();
  if (!/^[a-z0-9]{1,8}$/.test(extension)) throw new Error(`Invalid file extension: ${ext}`);
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${prefix}/${yyyy}/${mm}/${randomUUID()}.${extension}`;
}

let current: { root: string; storage: Storage } | undefined;

export function storage(): Storage {
  const root = path.resolve(process.env.STORAGE_DIR || DEFAULT_STORAGE_DIR);
  if (current?.root !== root) current = { root, storage: new LocalDiskStorage(root) };
  return current.storage;
}

export { LocalDiskStorage };
