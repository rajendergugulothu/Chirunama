import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db";
import { deliver, getSender, sendNow } from "../messaging/outbox";
import { whatsappPayload } from "../messaging/whatsapp";

// The outbox with an in-memory stand-in for the Outbox table and a mocked fetch, so no
// database and no network are needed.

type Row = {
  id: string;
  channel: "WHATSAPP" | "SMS";
  to: string;
  purpose: string;
  body: string;
  template: string | null;
  params: unknown;
  language: "TE" | "EN" | null;
  status: "QUEUED" | "SENT" | "FAILED" | "LOGGED";
  error: string | null;
  attempts: number;
  providerMessageId: string | null;
  sentAt: Date | null;
};

function fakeDb(initial: Partial<Row>[] = []) {
  const rows = new Map<string, Row>();
  let next = 1;
  const add = (data: Partial<Row>) => {
    const row: Row = {
      id: data.id ?? `row${next++}`,
      channel: "WHATSAPP",
      to: "919000000001",
      purpose: "otp",
      body: "",
      template: null,
      params: null,
      language: null,
      status: "QUEUED",
      error: null,
      attempts: 0,
      providerMessageId: null,
      sentAt: null,
      ...data,
    };
    rows.set(row.id, row);
    return row;
  };
  initial.forEach(add);
  const outbox = {
    create: vi.fn(async ({ data }: { data: Partial<Row> }) => ({ id: add({ ...data, template: data.template ?? null }).id })),
    findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
      const row = rows.get(where.id);
      if (!row) throw new Error("not found");
      return { ...row };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = rows.get(where.id)!;
      for (const [key, value] of Object.entries(data)) {
        if (key === "attempts" && value && typeof value === "object" && "increment" in value) {
          row.attempts += (value as { increment: number }).increment;
        } else {
          (row as Record<string, unknown>)[key] = value;
        }
      }
      return { ...row };
    }),
  };
  return { db: { outbox } as unknown as Db, rows, outbox };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const OTP_ROW: Partial<Row> = {
  id: "otp1",
  channel: "WHATSAPP",
  to: "919000000001",
  purpose: "otp",
  body: "Your Chirunama sign-in code is 123456.",
  template: "chirunama_otp",
  params: ["123456"],
  language: "EN",
};

describe("deliver with WhatsApp configured", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubEnv("WHATSAPP_TOKEN", "test-token");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "1234567890");
    vi.stubEnv("WHATSAPP_API_VERSION", "");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("POSTs a template message to the Graph API and marks the row SENT", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { messages: [{ id: "wamid.ABC" }] }));
    const { db, rows } = fakeDb([OTP_ROW]);

    await expect(deliver("otp1", db)).resolves.toEqual({ id: "otp1", status: "SENT" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v23.0/1234567890/messages");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-token");
    expect(JSON.parse(String(init?.body))).toEqual({
      messaging_product: "whatsapp",
      to: "919000000001",
      type: "template",
      template: {
        name: "chirunama_otp",
        language: { code: "en" },
        components: [
          { type: "body", parameters: [{ type: "text", text: "123456" }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "123456" }] },
        ],
      },
    });

    const row = rows.get("otp1")!;
    expect(row.status).toBe("SENT");
    expect(row.providerMessageId).toBe("wamid.ABC");
    expect(row.sentAt).toBeInstanceOf(Date);
    expect(row.attempts).toBe(1);
    expect(row.error).toBeNull();
  });

  it("marks the row FAILED with the API's error when the response is 400", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: { message: "Template name does not exist", code: 132001 } }));
    const { db, rows } = fakeDb([OTP_ROW]);

    await expect(deliver("otp1", db)).resolves.toEqual({ id: "otp1", status: "FAILED" });

    const row = rows.get("otp1")!;
    expect(row.status).toBe("FAILED");
    expect(row.error).toContain("400");
    expect(row.error).toContain("Template name does not exist");
    expect(row.attempts).toBe(1);
    expect(row.sentAt).toBeNull();
  });

  it("marks the row FAILED when fetch itself throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const { db, rows } = fakeDb([OTP_ROW]);
    await expect(deliver("otp1", db)).resolves.toMatchObject({ status: "FAILED" });
    expect(rows.get("otp1")!.error).toContain("network down");
  });

  it("uses the configured API version", async () => {
    vi.stubEnv("WHATSAPP_API_VERSION", "v24.0");
    fetchMock.mockResolvedValue(jsonResponse(200, { messages: [{ id: "wamid.X" }] }));
    const { db } = fakeDb([OTP_ROW]);
    await deliver("otp1", db);
    expect(fetchMock.mock.calls[0][0]).toBe("https://graph.facebook.com/v24.0/1234567890/messages");
  });

  it("leaves rows that are not QUEUED alone", async () => {
    const { db, rows } = fakeDb([{ ...OTP_ROW, status: "SENT" }]);
    await expect(deliver("otp1", db)).resolves.toEqual({ id: "otp1", status: "SENT" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rows.get("otp1")!.attempts).toBe(0);
  });

  it("sendNow stores the redacted body and params but sends the real code", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { messages: [{ id: "wamid.R" }] }));
    const { db, rows } = fakeDb();

    const result = await sendNow(
      {
        channel: "WHATSAPP",
        to: "919000000002",
        purpose: "otp",
        body: "code 654321",
        template: "chirunama_otp",
        params: ["654321"],
        language: "TE",
      },
      { redact: { body: "code ••••••", params: ["••••••"] } },
      db,
    );

    expect(result.status).toBe("SENT");
    const row = rows.get(result.id)!;
    expect(row.body).toBe("code ••••••");
    expect(row.params).toEqual(["••••••"]);
    expect(JSON.stringify(row)).not.toContain("654321");
    const sent = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(sent.template.language).toEqual({ code: "te" });
    expect(sent.template.components[0].parameters[0].text).toBe("654321");
  });
});

describe("deliver without a provider", () => {
  beforeEach(() => {
    vi.stubEnv("WHATSAPP_TOKEN", "");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "");
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("fetch must not be called"))));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("marks WhatsApp rows LOGGED when the token or phone number id is missing", async () => {
    const { db, rows } = fakeDb([OTP_ROW]);
    await expect(deliver("otp1", db)).resolves.toEqual({ id: "otp1", status: "LOGGED" });
    expect(rows.get("otp1")!.status).toBe("LOGGED");

    vi.stubEnv("WHATSAPP_TOKEN", "only-the-token");
    expect(getSender("WHATSAPP")).toBeNull();
  });

  it("always logs SMS, even with WhatsApp configured", async () => {
    vi.stubEnv("WHATSAPP_TOKEN", "t");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "1");
    expect(getSender("SMS")).toBeNull();
    const { db, rows } = fakeDb([{ ...OTP_ROW, channel: "SMS" }]);
    await expect(deliver("otp1", db)).resolves.toMatchObject({ status: "LOGGED" });
    expect(rows.get("otp1")!.attempts).toBe(0);
  });
});

describe("whatsappPayload", () => {
  it("sends plain text when there is no template", () => {
    expect(whatsappPayload({ channel: "WHATSAPP", to: "919000000001", purpose: "lead", body: "Hello" })).toEqual({
      messaging_product: "whatsapp",
      to: "919000000001",
      type: "text",
      text: { body: "Hello" },
    });
  });

  it("adds the copy-code button only for sign-in codes", () => {
    const payload = whatsappPayload({
      channel: "WHATSAPP",
      to: "919000000001",
      purpose: "visit_reminder",
      body: "Visit at 5",
      template: "visit_reminder",
      params: ["5 pm"],
    }) as { template: { components: { type: string }[]; language: { code: string } } };
    expect(payload.template.components.map((c) => c.type)).toEqual(["body"]);
    expect(payload.template.language.code).toBe("te");
  });
});
