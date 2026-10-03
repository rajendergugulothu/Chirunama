import "server-only";
import { cookies } from "next/headers";
import { LEAD_SOURCE_COOKIE, parseLeadSource } from "./attribution-rules";
import type { LeadSource } from "./types";

export { LEAD_SOURCE_COOKIE };

// The channel that brought this visitor, from the cookie the proxy sets on ?src= links.
export async function readLeadSource(): Promise<LeadSource> {
  const value = (await cookies()).get(LEAD_SOURCE_COOKIE)?.value;
  return parseLeadSource(value) ?? "SITE";
}
