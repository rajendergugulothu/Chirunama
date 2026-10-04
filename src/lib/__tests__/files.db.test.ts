import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { CookieJar } from "./cookie-jar";

// GET /api/files/<key> against the test database and the seed's placeholder files, with
// next/headers' cookies() replaced by an in-memory jar holding the viewer's session.

const jar = vi.hoisted(() => ({ current: undefined as unknown as import("./cookie-jar").CookieJar }));
vi.mock("next/headers", () => ({ cookies: async () => jar.current, headers: async () => new Headers() }));

const { GET } = await import("@/app/api/files/[...key]/route");
const { canReadFile } = await import("../files");
const { insertSession, SESSION_COOKIE } = await import("../auth/session");

const DOCUMENT = "documents/seed/tc-1004-title.pdf";
const PHOTO = "photos/test/files-route-photo.jpg";
const PHOTO_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

async function signInAs(phone: string | null) {
  jar.current = new CookieJar();
  if (!phone) return;
  const user = await prisma.user.findUniqueOrThrow({ where: { phone }, select: { id: true } });
  const { token } = await insertSession(user.id);
  jar.current.set(SESSION_COOKIE, token);
}

async function get(key: string): Promise<Response> {
  const request = new NextRequest(`http://localhost:3100/api/files/${key}`);
  return GET(request, { params: Promise.resolve({ key: key.split("/") }) });
}

beforeAll(async () => {
  await storage().put(PHOTO, PHOTO_BYTES);
});

afterAll(async () => {
  await storage().delete(PHOTO);
});

beforeEach(() => {
  jar.current = new CookieJar();
});

describe("GET /api/files/documents/...", () => {
  it("is a 404 for signed-out visitors", async () => {
    await signInAs(null);
    const response = await get(DOCUMENT);
    expect(response.status).toBe(404);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toBeNull();
  });

  it("is a 404 for a buyer", async () => {
    await signInAs("919000000301");
    const response = await get(DOCUMENT);
    expect(response.status).toBe(404);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("is a 404 for a broker who did not upload it (someone else's document)", async () => {
    await signInAs("919000000001");
    expect((await get(DOCUMENT)).status).toBe(404);
  });

  it("is a 404 for a field executive", async () => {
    await signInAs("919000000902");
    expect((await get(DOCUMENT)).status).toBe(404);
  });

  it.each([
    ["the advocate", "919000000901"],
    ["the admin", "919000000900"],
    ["the uploader", "919000000102"],
  ])("serves the PDF to %s as a private attachment", async (_who, phone) => {
    await signInAs(phone);
    const response = await get(DOCUMENT);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="tc-1004-title\.pdf"/);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const body = new Uint8Array(await response.arrayBuffer());
    expect(new TextDecoder().decode(body.slice(0, 5))).toBe("%PDF-");
    expect(response.headers.get("content-length")).toBe(String(body.byteLength));
  });

  it("is a 404 for an unknown document, even for the admin", async () => {
    await signInAs("919000000900");
    const response = await get("documents/nope.pdf");
    expect(response.status).toBe(404);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("is a 404 when the database row exists but the file is missing", async () => {
    const document = await prisma.document.findFirstOrThrow({ where: { storageKey: DOCUMENT } });
    const missing = await prisma.document.create({
      data: {
        verificationId: document.verificationId,
        kind: "OTHER",
        storageKey: "documents/test/missing-file.pdf",
        fileName: "missing-file.pdf",
        mimeType: "application/pdf",
        size: 1,
        uploadedById: document.uploadedById,
      },
    });
    try {
      await signInAs("919000000900");
      expect((await get(missing.storageKey)).status).toBe(404);
    } finally {
      await prisma.document.delete({ where: { id: missing.id } });
    }
  });

  it.each([
    "documents/../../etc/passwd",
    "documents/seed/../seed/tc-1004-title.pdf",
    "../.env",
    "other/x.pdf",
    "Documents/seed/tc-1004-title.pdf",
  ])("is a 404 for the malformed key %j, even for the admin", async (key) => {
    await signInAs("919000000900");
    const response = await get(key);
    expect(response.status).toBe(404);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("is a 404 after the session has been deleted", async () => {
    await signInAs("919000000901");
    await prisma.session.deleteMany({ where: { id: { not: "" }, user: { phone: "919000000901" } } });
    expect((await get(DOCUMENT)).status).toBe(404);
  });
});

describe("GET /api/files/photos/...", () => {
  it("serves photos publicly with a long cache", async () => {
    await signInAs(null);
    const response = await get(PHOTO);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual(Array.from(PHOTO_BYTES));
  });

  it("is a 404 for a missing photo or an unsupported type", async () => {
    await signInAs(null);
    expect((await get("photos/test/none.jpg")).status).toBe(404);
    expect((await get("photos/test/files-route-photo.svg")).status).toBe(404);
    expect((await get("photos/test/files-route-photo.html")).status).toBe(404);
  });
});

describe("canReadFile", () => {
  it("gives content types from the photo extension", async () => {
    expect(await canReadFile(null, "photos/a.png")).toMatchObject({ contentType: "image/png" });
    expect(await canReadFile(null, "photos/a.webp")).toMatchObject({ contentType: "image/webp" });
    expect(await canReadFile(null, "photos/a.jpeg")).toMatchObject({ contentType: "image/jpeg" });
    expect(await canReadFile(null, "photos/a.gif")).toBeNull();
  });

  it("encodes a non-ASCII document name safely", async () => {
    const document = await prisma.document.findFirstOrThrow({ where: { storageKey: DOCUMENT } });
    const named = await prisma.document.create({
      data: {
        verificationId: document.verificationId,
        kind: "OTHER",
        storageKey: "documents/test/named.pdf",
        fileName: 'పత్రం "1".pdf',
        mimeType: "application/pdf",
        size: 1,
        uploadedById: document.uploadedById,
      },
    });
    try {
      const access = await canReadFile({ id: "someone", roles: ["ADMIN"] }, named.storageKey);
      expect(access?.disposition).toMatch(/^attachment; filename="[\x20-\x7e]+"; filename\*=UTF-8''/);
      expect(access?.disposition).not.toMatch(/filename="[^"]*"[^;]*"/);
    } finally {
      await prisma.document.delete({ where: { id: named.id } });
    }
  });
});
