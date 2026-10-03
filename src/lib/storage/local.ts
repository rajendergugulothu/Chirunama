import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Storage } from "./index";

// Files on local disk under one root directory. Keys are validated by callers with isValidKey;
// this class also refuses any key that would resolve outside the root.
export class LocalDiskStorage implements Storage {
  private readonly root: string;

  constructor(rootDir: string) {
    this.root = path.resolve(rootDir);
  }

  private pathFor(key: string): string {
    const full = path.resolve(this.root, key);
    if (!key || !full.startsWith(this.root + path.sep)) throw new Error("Storage key resolves outside the storage root");
    return full;
  }

  async put(key: string, data: Uint8Array): Promise<void> {
    const full = this.pathFor(key);
    await mkdir(path.dirname(full), { recursive: true });
    // Write to a temp file and rename, so readers never see a half-written file.
    const temp = `${full}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp, data);
      await rename(temp, full);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
  }

  async get(key: string): Promise<Uint8Array | null> {
    const full = this.pathFor(key);
    try {
      return new Uint8Array(await readFile(full));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "EISDIR" || code === "ENOTDIR") return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}
