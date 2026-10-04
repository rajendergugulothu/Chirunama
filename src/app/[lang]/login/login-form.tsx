"use client";

import { useActionState, useState } from "react";
import {
  requestOtpAction,
  verifyOtpAction,
  type RequestError,
  type RequestState,
  type SentCode,
  type VerifyError,
  type VerifyState,
} from "./actions";

// Two-step phone sign-in card: number, then the 6-digit code. Strings come from the page
// already translated; codeSent and devCode carry {p} and {c} placeholders.
export type LoginLabels = {
  title: string;
  phoneLabel: string;
  phoneHint: string;
  sendCode: string;
  codeLabel: string;
  codeSent: string;
  verify: string;
  changeNumber: string;
  resend: string;
  devCode: string;
  consent: string;
  errors: Record<RequestError | VerifyError, string>;
};

type Props = { lang: "te" | "en"; next: string; labels: LoginLabels };

const primary = "rounded-lg bg-brand px-3 py-2 font-medium text-surface disabled:opacity-60";
const link = "text-sm font-medium text-brand hover:underline disabled:opacity-60";

function ErrorMessage({ id, message }: { id: string; message?: string }) {
  return (
    <p id={id} aria-live="polite" className="min-h-5 text-sm text-accent">
      {message}
    </p>
  );
}

export function LoginForm({ lang, next, labels }: Props) {
  const [request, requestAction, requesting] = useActionState<RequestState, FormData>(requestOtpAction, {});
  const [phone, setPhone] = useState("");
  // "Change number" closes the code step for the send it was clicked on; a new send reopens it.
  const [changedFrom, setChangedFrom] = useState<number | null>(null);
  const sent = request.sent && request.sent.sentAt !== changedFrom ? request.sent : undefined;
  // Errors from the number step only: a code step's refused resend is shown there.
  const phoneError = !request.sent && request.error ? labels.errors[request.error] : undefined;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 rounded-xl border border-line bg-surface p-5">
      <h1 className="text-xl font-bold">{labels.title}</h1>
      {sent ? (
        <CodeStep
          key={sent.sentAt}
          sent={sent}
          lang={lang}
          next={next}
          labels={labels}
          requestAction={requestAction}
          requesting={requesting}
          resendError={request.error}
          onChangeNumber={() => setChangedFrom(sent.sentAt)}
        />
      ) : (
        <form action={requestAction} className="flex flex-col gap-2">
          <input type="hidden" name="lang" value={lang} />
          <label htmlFor="phone" className="text-sm font-medium">
            {labels.phoneLabel}
          </label>
          <div className="flex rounded-lg border border-line bg-surface focus-within:border-brand">
            <span className="flex items-center border-r border-line px-3 text-muted" aria-hidden="true">
              +91
            </span>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              aria-describedby="phone-hint phone-error"
              aria-invalid={phoneError ? true : undefined}
              className="min-w-0 flex-1 rounded-r-lg bg-transparent px-3 py-2 tabular-nums outline-none"
            />
          </div>
          <p id="phone-hint" className="text-sm text-muted">
            {labels.phoneHint}
          </p>
          <ErrorMessage id="phone-error" message={phoneError} />
          <button type="submit" disabled={requesting} className={primary}>
            {labels.sendCode}
          </button>
        </form>
      )}
      <p className="text-xs text-muted">{labels.consent}</p>
    </div>
  );
}

function CodeStep({
  sent,
  lang,
  next,
  labels,
  requestAction,
  requesting,
  resendError,
  onChangeNumber,
}: Omit<Props, "labels"> & {
  sent: SentCode;
  labels: LoginLabels;
  requestAction: (formData: FormData) => void;
  requesting: boolean;
  resendError?: RequestError;
  onChangeNumber: () => void;
}) {
  const [verify, verifyAction, verifying] = useActionState<VerifyState, FormData>(verifyOtpAction, {});
  // Show the error from whichever form was submitted last.
  const [last, setLast] = useState<"verify" | "resend">("verify");
  const error = last === "resend" ? resendError : verify.error;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">{labels.codeSent.replace("{p}", sent.maskedPhone)}</p>
      {sent.devCode && (
        <p className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-100">
          {labels.devCode.replace("{c}", sent.devCode)}
        </p>
      )}
      <form action={verifyAction} onSubmit={() => setLast("verify")} className="flex flex-col gap-2">
        <input type="hidden" name="phone" value={sent.phone} />
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="lang" value={lang} />
        <label htmlFor="code" className="text-sm font-medium">
          {labels.codeLabel}
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          aria-describedby="code-error"
          aria-invalid={verify.error && last === "verify" ? true : undefined}
          className="rounded-lg border border-line bg-surface px-3 py-2 tracking-widest tabular-nums outline-none focus:border-brand"
        />
        <ErrorMessage id="code-error" message={error ? labels.errors[error] : undefined} />
        <button type="submit" disabled={verifying} className={primary}>
          {labels.verify}
        </button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onChangeNumber} className={link}>
          {labels.changeNumber}
        </button>
        <form action={requestAction} onSubmit={() => setLast("resend")}>
          <input type="hidden" name="phone" value={sent.phone} />
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="resend" value="1" />
          <button type="submit" disabled={requesting} className={link}>
            {labels.resend}
          </button>
        </form>
      </div>
    </div>
  );
}
