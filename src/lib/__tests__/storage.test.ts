import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isValidKey, LocalDiskStorage, newKey } from "../storage";

describe("LocalDiskStorage", () => {
  let root: string;
  let store: LocalDiskStorage;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "chirunama-storage-"));
    store = new LocalDiskStorage(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("round-trips put, get and delete", async () => {
    const key = "documents/2026/10/a1b2.pdf";
    const data = new TextEncoder().encode("%PDF-1.4 test");

    await store.put(key, data);
    expect(Array.from((await store.get(key))!)).toEqual(Array.from(data));
    expect((await stat(path.join(root, key))).isFile()).toBe(true);

    await store.delete(key);
    expect(await store.get(key)).toBeNull();
  });

  it("overwrites an existing key and leaves no temp files behind", async () => {
    const key = "photos/2026/10/x.jpg";
    await store.put(key, new Uint8Array([1, 2, 3]));
    await store.put(key, new Uint8Array([4, 5]));
    expect(Array.from((await store.get(key))!)).toEqual([4, 5]);
    expect(await readdir(path.join(root, "photos/2026/10"))).toEqual(["x.jpg"]);
  });

  it("returns null for a missing key or a directory, and deleting a missing key is fine", async () => {
    expect(await store.get("photos/none.jpg")).toBeNull();
    await store.put("photos/dir/x.jpg", new Uint8Array([1]));
    expect(await store.get("photos/dir")).toBeNull();
    await expect(store.delete("photos/none.jpg")).resolves.toBeUndefined();
  });

  it("refuses keys that resolve outside its root", async () => {
    await expect(store.put("../escape.txt", new Uint8Array([1]))).rejects.toThrow(/outside/);
    await expect(store.get("documents/../../etc/passwd")).rejects.toThrow(/outside/);
    await expect(store.get("/etc/passwd")).rejects.toThrow(/outside/);
    await expect(store.delete("")).rejects.toThrow(/outside/);
  });
});

describe("isValidKey", () => {
  it.each(["../x", "documents/../../etc/passwd", "/abs", "other/x", "documents//x", "documents/", "documents", "Documents/x.pdf", "photos/.hidden", "photos/a b.jpg", "photos/x.jpg\0"])(
    "rejects %j",
    (key) => {
      expect(isValidKey(key)).toBe(false);
    },
  );

  it.each(["documents/seed/tc-1004-title.pdf", "photos/2026/10/0f8a.jpg", "documents/a_b.c-d/e.pdf"])("accepts %j", (key) => {
    expect(isValidKey(key)).toBe(true);
  });
});

describe("newKey", () => {
  it("files keys under prefix/yyyy/mm with a random name, using the given date", () => {
    const now = new Date("2026-10-03T12:00:00Z");
    const key = newKey("photos", ".JPG", now);
    expect(key).toMatch(/^photos\/2026\/10\/[0-9a-f-]{36}\.jpg$/);
    expect(isValidKey(key)).toBe(true);
    expect(newKey("photos", "jpg", now)).not.toBe(key);
  });

  it("rejects odd extensions", () => {
    expect(() => newKey("documents", "../pdf", new Date("2026-10-03T00:00:00Z"))).toThrow();
  });
});
