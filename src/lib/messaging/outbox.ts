import "server-only";
import { prisma, type Db } from "@/lib/db";
import type { OutboxStatus } from "@/generated/prisma/enums";
import type { MessageChannel, OutboundMessage, Sender } from "./types";
import { whatsappSender } from "./whatsapp";

// Every outgoing message is written to the Outbox table, then handed to the channel's sender.
// Without a sender (development, or SMS in this release) the row is marked LOGGED: written
// down for the outbox viewer, never sent.

export type DeliveryResult = { id: string; status: OutboxStatus };

export function getSender(channel: MessageChannel): Sender | null {
  if (channel === "WHATSAPP") return whatsappSender();
  return null;
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1000);
}

// Sends `message` for the outbox row `id` and records the outcome on the row.
async function dispatch(id: string, message: OutboundMessage, db: Db): Promise<DeliveryResult> {
  const sender = getSender(message.channel);
  if (!sender) {
    await db.outbox.update({ where: { id }, data: { status: "LOGGED" } });
    return { id, status: "LOGGED" };
  }
  try {
    const { providerMessageId } = await sender.send(message);
    await db.outbox.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date(), providerMessageId, error: null, attempts: { increment: 1 } },
    });
    return { id, status: "SENT" };
  } catch (error) {
    await db.outbox.update({
      where: { id },
      data: { status: "FAILED", error: errorMessage(error), attempts: { increment: 1 } },
    });
    return { id, status: "FAILED" };
  }
}

function rowData(message: OutboundMessage) {
  return {
    channel: message.channel,
    to: message.to,
    purpose: message.purpose,
    body: message.body,
    template: message.template,
    params: message.params,
    language: message.language,
  };
}

// Writes a QUEUED row for later delivery with deliver() or deliverQueued().
export async function queueMessage(message: OutboundMessage, db: Db = prisma): Promise<{ id: string }> {
  const row = await db.outbox.create({ data: { ...rowData(message), status: "QUEUED" }, select: { id: true } });
  return row;
}

// Delivers one QUEUED row. Rows in any other state are left alone and returned as they are.
export async function deliver(id: string, db: Db = prisma): Promise<DeliveryResult> {
  const row = await db.outbox.findUniqueOrThrow({ where: { id } });
  if (row.status !== "QUEUED") return { id, status: row.status };
  const params = Array.isArray(row.params) ? row.params.filter((p): p is string => typeof p === "string") : undefined;
  return dispatch(
    id,
    {
      channel: row.channel,
      to: row.to,
      purpose: row.purpose,
      body: row.body,
      template: row.template ?? undefined,
      params,
      language: row.language ?? undefined,
    },
    db,
  );
}

// Delivers the oldest QUEUED rows, one at a time.
export async function deliverQueued(limit = 20, db: Db = prisma): Promise<DeliveryResult[]> {
  const rows = await db.outbox.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  const results: DeliveryResult[] = [];
  for (const row of rows) results.push(await deliver(row.id, db));
  return results;
}

// Sends immediately. With `redact`, the row stores the redacted body and params while the real
// ones, held only in memory, go to the provider: used for sign-in codes.
export async function sendNow(
  message: OutboundMessage,
  options: { redact?: { body: string; params?: string[] } } = {},
  db: Db = prisma,
): Promise<DeliveryResult> {
  // Redacted rows keep only the params the caller passed as safe to store.
  const stored = options.redact ? { ...message, body: options.redact.body, params: options.redact.params } : message;
  const { id } = await queueMessage(stored, db);
  return dispatch(id, message, db);
}
