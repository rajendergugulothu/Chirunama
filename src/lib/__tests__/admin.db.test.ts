import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { OUTBOX_PAGE_SIZE, outboxMessages, outboxPurposes, parseOutboxFilters } from "../admin";

// Admin outbox reads against the test database. The rows below use their own purposes and
// fixed timestamps, so other tests' messages never change the expectations.

const admin = { roles: ["ADMIN" as const] };
const buyer = { roles: ["BUYER" as const] };
const BASE = new Date("2026-09-01T00:00:00.000Z").getTime();

beforeAll(async () => {
  await prisma.outbox.deleteMany({ where: { purpose: { in: ["test_paging", "test_status"] } } });
  // 60 rows one minute apart, plus two sharing a timestamp to exercise the id tie-break.
  await prisma.outbox.createMany({
    data: [
      ...Array.from({ length: 60 }, (_, i) => ({
        channel: "SMS" as const,
        to: "919000000301",
        purpose: "test_paging",
        body: `paging ${i}`,
        status: "LOGGED" as const,
        createdAt: new Date(BASE + i * 60_000),
      })),
      { channel: "WHATSAPP" as const, to: "919000000302", purpose: "test_status", body: "sent", status: "SENT" as const, createdAt: new Date(BASE) },
      { channel: "WHATSAPP" as const, to: "919000000302", purpose: "test_status", body: "failed", status: "FAILED" as const, error: "boom", createdAt: new Date(BASE) },
    ],
  });
});

describe("parseOutboxFilters", () => {
  it("keeps valid filters", () => {
    expect(parseOutboxFilters({ status: "SENT", purpose: "otp", before: "cmabc123" })).toEqual({ status: "SENT", purpose: "otp", before: "cmabc123" });
  });

  it("drops invalid or repeated values instead of failing", () => {
    expect(parseOutboxFilters({ status: "sent", purpose: "'; DROP TABLE", before: "../x" })).toEqual({});
    expect(parseOutboxFilters({ status: ["SENT", "FAILED"], purpose: "" })).toEqual({});
  });
});

describe("outboxMessages", () => {
  it("refuses viewers without ADMIN", async () => {
    await expect(outboxMessages(buyer, {})).rejects.toThrow(/admin/i);
    await expect(outboxPurposes(buyer)).rejects.toThrow(/admin/i);
  });

  it("pages 50 at a time, newest first, with an Older cursor", async () => {
    const first = await outboxMessages(admin, { purpose: "test_paging" });
    expect(first.messages).toHaveLength(OUTBOX_PAGE_SIZE);
    expect(OUTBOX_PAGE_SIZE).toBe(50);
    expect(first.messages[0].body).toBe("paging 59");
    expect(first.messages[49].body).toBe("paging 10");
    expect(first.older).toBe(first.messages[49].id);

    const second = await outboxMessages(admin, { purpose: "test_paging", before: first.older });
    expect(second.messages.map((m) => m.body)).toEqual(Array.from({ length: 10 }, (_, i) => `paging ${9 - i}`));
    expect(second.older).toBeUndefined();
  });

  it("filters by status", async () => {
    const sent = await outboxMessages(admin, { purpose: "test_status", status: "SENT" });
    expect(sent.messages.map((m) => m.body)).toEqual(["sent"]);
    const failed = await outboxMessages(admin, { status: "FAILED", purpose: "test_status" });
    expect(failed.messages).toEqual([expect.objectContaining({ body: "failed", error: "boom", to: "919000000302", channel: "WHATSAPP" })]);
  });

  it("orders rows with the same timestamp by id, and pages through them without skipping", async () => {
    const all = await outboxMessages(admin, { purpose: "test_status" });
    expect(all.messages).toHaveLength(2);
    const after = await outboxMessages(admin, { purpose: "test_status", before: all.messages[0].id });
    expect(after.messages.map((m) => m.id)).toEqual([all.messages[1].id]);
  });

  it("ignores an unknown cursor", async () => {
    const page = await outboxMessages(admin, { purpose: "test_paging", before: "doesnotexist" });
    expect(page.messages[0].body).toBe("paging 59");
  });

  it("lists the purposes for the filter", async () => {
    const purposes = await outboxPurposes(admin);
    expect(purposes).toEqual([...purposes].sort());
    expect(purposes).toEqual(expect.arrayContaining(["test_paging", "test_status"]));
  });
});
