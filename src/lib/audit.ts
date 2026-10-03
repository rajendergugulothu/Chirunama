import "server-only";
import { prisma, type Db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

// Append-only record of who did what. Never put OTP codes, session tokens or any hash of them
// in `before` or `after`.

export type AuditActor = { kind: "HUMAN" | "AGENT"; id: string }; // user id, or an agent name like "system:admin_phones"

export type AuditInput = {
  actor: AuditActor;
  action: string; // "user.create", "user.role_grant", "auth.sign_in", "auth.sign_out"
  entity: string; // model name: "User", "Session"
  entityId: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
};

export async function audit(event: AuditInput, db: Db = prisma): Promise<void> {
  await db.auditEvent.create({
    data: {
      actorKind: event.actor.kind,
      actor: event.actor.id,
      action: event.action,
      entity: event.entity,
      entityId: event.entityId,
      before: event.before,
      after: event.after,
    },
  });
}
