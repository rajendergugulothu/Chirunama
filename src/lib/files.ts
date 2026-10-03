import "server-only";
import { prisma } from "@/lib/db";
import { isValidKey } from "@/lib/storage";
import type { SessionUser } from "@/lib/auth/session";

// Who may read which stored file. Photos are public; documents only reach their uploader,
// ADMIN and ADVOCATE. Everyone else gets null (served as 404) so a document's existence
// does not leak.

export type FileAccess = { contentType: string; disposition: string; cache: string };

const PHOTO_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const DOCUMENT_READERS = new Set(["ADMIN", "ADVOCATE"]);

// Content-Disposition with an ASCII fallback name, plus the UTF-8 name when they differ.
function attachment(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "document";
  const disposition = `attachment; filename="${ascii}"`;
  return ascii === fileName ? disposition : `${disposition}; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function canReadFile(
  user: Pick<SessionUser, "id" | "roles"> | null,
  key: string,
): Promise<FileAccess | null> {
  if (!isValidKey(key)) return null;

  if (key.startsWith("photos/")) {
    const ext = key.slice(key.lastIndexOf(".") + 1);
    const contentType = PHOTO_TYPES[ext];
    if (!contentType) return null;
    return { contentType, disposition: "inline", cache: "public, max-age=31536000, immutable" };
  }

  if (!user) return null;
  const document = await prisma.document.findUnique({
    where: { storageKey: key },
    select: { uploadedById: true, mimeType: true, fileName: true },
  });
  if (!document) return null;
  const allowed = user.id === document.uploadedById || user.roles.some((role) => DOCUMENT_READERS.has(role));
  if (!allowed) return null;
  return { contentType: document.mimeType, disposition: attachment(document.fileName), cache: "private, no-store" };
}
