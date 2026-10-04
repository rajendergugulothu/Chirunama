import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canReadFile } from "@/lib/files";
import { storage } from "@/lib/storage";

// Stored photos and documents. Photos are public; documents reach only their uploader, ADMIN
// and ADVOCATE. Everything else, including unknown and malformed keys, is the same 404, so a
// document's existence never leaks.

function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(_request: NextRequest, context: RouteContext<"/api/files/[...key]">): Promise<Response> {
  const key = (await context.params).key.join("/");
  const session = await getSession();
  const access = await canReadFile(session?.user ?? null, key);
  if (!access) return notFound();

  const data = await storage().get(key);
  if (!data) return notFound();

  return new Response(data, {
    headers: {
      "Content-Type": access.contentType,
      "Content-Disposition": access.disposition,
      "Content-Length": String(data.byteLength),
      "Cache-Control": access.cache,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
