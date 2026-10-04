import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { OutboxStatus, type OutboxChannel } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/session";

// Reads for the admin area. Every call checks the viewer's role itself, so the data stays
// ADMIN-only even if a page's guard is missed. The outbox shows full recipient numbers.

export const OUTBOX_PAGE_SIZE = 50;
export const OUTBOX_STATUSES = Object.values(OutboxStatus);

const one = (value: unknown) => (typeof value === "string" && value !== "" ? value : undefined);

// Invalid values are dropped rather than rejected: a bad filter shows everything.
const outboxFilters = z.object({
  status: z.enum(OutboxStatus).optional().catch(undefined),
  purpose: z.string().regex(/^[a-z0-9_.-]{1,64}$/).optional().catch(undefined),
  before: z.string().regex(/^[a-z0-9]{1,64}$/).optional().catch(undefined),
});

export type OutboxFilters = z.infer<typeof outboxFilters>;

export function parseOutboxFilters(params: Record<string, string | string[] | undefined>): OutboxFilters {
  return outboxFilters.parse({ status: one(params.status), purpose: one(params.purpose), before: one(params.before) });
}

export type OutboxMessage = {
  id: string;
  createdAt: Date;
  channel: OutboxChannel;
  to: string;
  purpose: string;
  status: OutboxStatus;
  body: string;
  error: string | null;
};

function assertAdmin(viewer: Pick<SessionUser, "roles">): void {
  if (!viewer.roles.includes("ADMIN")) throw new Error("The outbox is only for admins");
}

// One page of messages, newest first. `before` is the id of the last row on the previous page;
// `older` is set when there is another page after this one.
export async function outboxMessages(
  viewer: Pick<SessionUser, "roles">,
  filters: OutboxFilters,
): Promise<{ messages: OutboxMessage[]; older?: string }> {
  assertAdmin(viewer);
  const and: Prisma.OutboxWhereInput[] = [];
  if (filters.status) and.push({ status: filters.status });
  if (filters.purpose) and.push({ purpose: filters.purpose });
  if (filters.before) {
    const cursor = await prisma.outbox.findUnique({ where: { id: filters.before }, select: { id: true, createdAt: true } });
    if (cursor) {
      and.push({ OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] });
    }
  }
  const rows = await prisma.outbox.findMany({
    where: { AND: and },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: OUTBOX_PAGE_SIZE + 1,
    select: { id: true, createdAt: true, channel: true, to: true, purpose: true, status: true, body: true, error: true },
  });
  const messages = rows.slice(0, OUTBOX_PAGE_SIZE);
  return { messages, older: rows.length > OUTBOX_PAGE_SIZE ? messages[messages.length - 1].id : undefined };
}

// The purposes in the outbox, for the filter's options.
export async function outboxPurposes(viewer: Pick<SessionUser, "roles">): Promise<string[]> {
  assertAdmin(viewer);
  const rows = await prisma.outbox.groupBy({ by: ["purpose"], orderBy: { purpose: "asc" } });
  return rows.map((row) => row.purpose);
}
