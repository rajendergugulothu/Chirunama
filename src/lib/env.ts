import "server-only";
import { z } from "zod";
import { normalizePhone } from "./phone";
import { DEFAULT_STORAGE_DIR } from "./storage";

// Server configuration, validated with Zod. Read through env() at call time rather than at
// import, so `next build` works without a database and tests can change variables per case.

const DEV_AUTH_SECRET = "chirunama-development-only-secret-do-not-use-in-production";

// Empty strings in .env files mean "not set".
const unset = (value: unknown) => (value === "" ? undefined : value);
const optionalString = z.preprocess(unset, z.string().optional());

const schema = z.object({
  DATABASE_URL: z.preprocess(unset, z.string({ error: "DATABASE_URL is required" })),
  AUTH_SECRET: z.preprocess(unset, z.string().min(32, "AUTH_SECRET must be at least 32 characters").optional()),
  ADMIN_PHONES: z.preprocess(
    unset,
    z
      .string()
      .optional()
      .transform((value) =>
        (value ?? "")
          .split(",")
          .map((p) => normalizePhone(p))
          .filter((p): p is string => p !== null),
      ),
  ),
  STORAGE_DIR: z.preprocess(unset, z.string().default(DEFAULT_STORAGE_DIR)),
  SUPPORT_WHATSAPP: z.preprocess(unset, z.string().regex(/^\d{10,15}$/, "SUPPORT_WHATSAPP must be digits only").default("919000000000")),
  WHATSAPP_TOKEN: optionalString,
  WHATSAPP_PHONE_NUMBER_ID: optionalString,
  WHATSAPP_API_VERSION: z.preprocess(unset, z.string().regex(/^v\d+\.\d+$/).default("v23.0")),
  WHATSAPP_OTP_TEMPLATE: z.preprocess(unset, z.string().default("chirunama_otp")),
});

export type Env = Omit<z.infer<typeof schema>, "AUTH_SECRET"> & { AUTH_SECRET: string };

const KEYS = Object.keys(schema.shape) as (keyof typeof schema.shape)[];

let cached: { signature: string; env: Env } | undefined;
let warned = false;

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function env(): Env {
  const raw = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  const signature = JSON.stringify([process.env.NODE_ENV, raw]);
  if (cached?.signature === signature) return cached.env;

  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);

  let authSecret = parsed.data.AUTH_SECRET;
  if (!authSecret) {
    if (isProduction()) throw new Error("Invalid environment: AUTH_SECRET is required in production");
    if (!warned) {
      console.warn("AUTH_SECRET is not set; using a fixed development secret. Set it in .env.");
      warned = true;
    }
    authSecret = DEV_AUTH_SECRET;
  }

  const value: Env = { ...parsed.data, AUTH_SECRET: authSecret };
  cached = { signature, env: value };
  return value;
}
