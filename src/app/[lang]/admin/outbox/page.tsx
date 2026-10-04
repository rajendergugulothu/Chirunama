import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { OUTBOX_STATUSES, outboxMessages, outboxPurposes, parseOutboxFilters, type OutboxMessage } from "@/lib/admin";
import { requireRole } from "@/lib/auth/guards";

const CHANNELS: Record<OutboxMessage["channel"], string> = { WHATSAPP: "WhatsApp", SMS: "SMS" };

const PILL: Record<OutboxMessage["status"], string> = {
  QUEUED: "border border-line",
  SENT: "bg-brand-soft text-brand",
  FAILED: "border border-accent text-accent",
  LOGGED: "border border-line text-muted",
};

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.admin.outbox, robots: { index: false } };
}

// Every outgoing message, newest first, 50 per page. Shows full recipient numbers: ADMIN only.
export default async function OutboxPage({ searchParams }: PageProps<"/[lang]/admin/outbox">) {
  const lang = await getLocale();
  const user = await requireRole("ADMIN", `/${lang}/admin/outbox`);
  const dict = await getDictionary();
  const a = dict.admin;
  const filters = parseOutboxFilters(await searchParams);
  const [{ messages, older }, stored] = await Promise.all([outboxMessages(user, filters), outboxPurposes(user)]);
  const purposes = filters.purpose && !stored.includes(filters.purpose) ? [...stored, filters.purpose] : stored;

  const time = new Intl.DateTimeFormat(lang === "te" ? "te-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Kolkata",
  });
  const olderQuery = new URLSearchParams();
  if (filters.status) olderQuery.set("status", filters.status);
  if (filters.purpose) olderQuery.set("purpose", filters.purpose);
  if (older) olderQuery.set("before", older);
  const field = "rounded-lg border border-line bg-surface px-2 py-1.5";
  const pill = (status: OutboxMessage["status"]) => (
    <span className={`inline-block w-fit whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${PILL[status]}`}>
      {a.status[status]}
    </span>
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{a.outbox}</h1>
        <p className="text-sm text-muted">{a.outboxHint}</p>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          {a.cols.status}
          <select name="status" defaultValue={filters.status ?? ""} className={field}>
            <option value="">{a.all}</option>
            {OUTBOX_STATUSES.map((s) => (
              <option key={s} value={s}>
                {a.status[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {a.cols.purpose}
          <select name="purpose" defaultValue={filters.purpose ?? ""} className={field}>
            <option value="">{a.all}</option>
            {purposes.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-brand px-3 py-2 font-medium text-surface">
          {a.filter}
        </button>
      </form>

      {messages.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-muted">{a.empty}</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface md:block">
            <table className="w-full text-sm">
              <thead className="text-left text-muted">
                <tr className="border-b border-line">
                  <th className="p-3 font-medium">{a.cols.time}</th>
                  <th className="p-3 font-medium">{a.cols.channel}</th>
                  <th className="p-3 font-medium">{a.cols.to}</th>
                  <th className="p-3 font-medium">{a.cols.purpose}</th>
                  <th className="p-3 font-medium">{a.cols.status}</th>
                  <th className="p-3 font-medium">{a.cols.message}</th>
                  <th className="p-3 font-medium">{a.cols.error}</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m.id} className="border-b border-line align-top last:border-0">
                    <td className="whitespace-nowrap p-3 tabular-nums">{time.format(m.createdAt)}</td>
                    <td className="p-3">{CHANNELS[m.channel]}</td>
                    <td className="whitespace-nowrap p-3 tabular-nums">+{m.to}</td>
                    <td className="p-3">{m.purpose}</td>
                    <td className="p-3">{pill(m.status)}</td>
                    <td className="max-w-md whitespace-pre-wrap break-words p-3">{m.body}</td>
                    <td className="max-w-xs break-words p-3 text-accent">{m.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-3 md:hidden">
            {messages.map((m) => (
              <li key={m.id} className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="tabular-nums text-muted">{time.format(m.createdAt)}</span>
                  {pill(m.status)}
                </div>
                <div className="tabular-nums">
                  {CHANNELS[m.channel]} → +{m.to}
                </div>
                <div className="text-muted">{m.purpose}</div>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                {m.error && <p className="break-words text-accent">{m.error}</p>}
              </li>
            ))}
          </ul>
        </>
      )}

      {older && (
        <Link href={`/${lang}/admin/outbox?${olderQuery}`} className="w-fit text-sm font-medium text-brand hover:underline">
          {a.older} →
        </Link>
      )}
    </div>
  );
}
