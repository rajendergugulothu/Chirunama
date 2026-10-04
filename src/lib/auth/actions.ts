"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { destroySession } from "./session";

// Sign-out, posted from the header menu. The language comes from the form because
// next/root-params is not available in Server Actions; anything unexpected falls back to Telugu.

const signOutInput = z.object({ lang: z.enum(["te", "en"]).catch("te") });

export async function signOutAction(formData: FormData): Promise<void> {
  const { lang } = signOutInput.parse({ lang: formData.get("lang") });
  // Deletes this request's own session row, clears the cookie and records auth.sign_out.
  // Without a session there is nothing to delete and it does nothing.
  await destroySession();
  redirect(`/${lang}`);
}
