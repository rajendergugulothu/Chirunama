import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { CopyButton } from "@/components/copy-button";
import { requireUser } from "@/lib/auth/guards";
import { daysSince, formatRupees, whatsappLink } from "@/lib/format";
import { localityAverage } from "@/lib/listing-rules";
import { classifiedText, sharePath } from "@/lib/marketing";
import {
  allLocalities,
  getBrokerForUser,
  leadsForBroker,
  listingStats,
  listingsByBroker,
  supportContact,
} from "@/lib/repository";
import type { LeadSource, LeadStage } from "@/lib/types";

const STAGES: LeadStage[] = ["NEW", "CONTACTED", "VISIT_BOOKED", "CLOSED"];
const SHARE_CHANNELS: LeadSource[] = ["INSTAGRAM", "WHATSAPP", "FACEBOOK", "QR"];

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.dashboard.title, robots: { index: false } };
}

// The signed-in broker's own private view: their listings, leads (with enquirers' phone
// numbers), stats and share kit. Everything is looked up from the session, never the URL.
export default async function DashboardPage() {
  const lang = await getLocale();
  const user = await requireUser(`/${lang}/dashboard`);
  const dict = await getDictionary();
  const d = dict.dashboard;
  const broker = await getBrokerForUser(user.id);
  if (!broker) {
    return <NoProfile title={d.title} message={d.noProfile} cta={d.noProfileCta} support={await supportContact()} />;
  }

  const [own, leads, localities] = await Promise.all([
    listingsByBroker(broker.slug, { includeExpired: true }),
    leadsForBroker(broker.slug),
    allLocalities(),
  ]);
  const stats = await listingStats(own.map((l) => l.code));
  const statsFor = (code: string) => stats.get(code) ?? { views: 0, saves: 0 };
  const localityBySlug = new Map(localities.map((l) => [l.slug, l]));
  const live = own.filter((l) => l.status === "LIVE");
  const units = { month: dict.listing.perMonth, sqft: dict.locality.perSqft, sqyd: dict.locality.perSqyd };
  const views = own.reduce((sum, l) => sum + statsFor(l.code).views, 0);
  const time = new Intl.DateTimeFormat(lang === "te" ? "te-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

  const totals = [
    { label: d.stats.newLeads, value: leads.filter((l) => l.stage === "NEW").length },
    { label: d.stats.visits, value: leads.filter((l) => l.stage === "VISIT_BOOKED").length },
    { label: d.stats.live, value: live.length },
    { label: d.stats.views, value: views },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end gap-3">
        <h1 className="flex-1 text-2xl font-bold">{d.title}</h1>
        <Link
          href={`/${lang}/agent/${broker.slug}`}
          className="rounded-full border border-line bg-surface px-3 py-1 text-sm hover:border-brand"
        >
          {broker.displayName} · {d.plan} {broker.plan}
        </Link>
        <p className="w-full rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">{d.launch}</p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {totals.map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-surface p-4">
            <div className="text-sm text-muted">{s.label}</div>
            <div className="text-2xl font-semibold tabular-nums">{s.value.toLocaleString("en-IN")}</div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{d.pipeline}</h2>
        <div className="grid gap-3 md:grid-cols-4">
          {STAGES.map((stage) => {
            const inStage = leads.filter((l) => l.stage === stage);
            return (
              <div key={stage} className="flex flex-col gap-2 rounded-xl bg-brand-soft/60 p-3">
                <h3 className="flex items-center justify-between text-sm font-semibold">
                  {d.stages[stage]}
                  <span className="rounded-full bg-surface px-2 text-xs tabular-nums">{inStage.length}</span>
                </h3>
                {inStage.length === 0 && <p className="text-xs text-muted">{d.empty}</p>}
                {inStage.map((lead) => (
                  <article key={lead.id} className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{lead.name}</span>
                      <span className="shrink-0 rounded-full border border-line px-2 text-xs">{d.sources[lead.source]}</span>
                    </div>
                    <Link href={`/${lang}/listings/${lead.listingCode}`} className="text-xs text-brand hover:underline">
                      {lead.listingCode}
                    </Link>
                    <span className="text-xs text-muted">
                      {lead.visitAt ? `${d.visit}: ${time.format(new Date(lead.visitAt))}` : time.format(new Date(lead.createdAt))}
                    </span>
                    {stage !== "CLOSED" && (
                      <a
                        href={whatsappLink(lead.phone, d.reply(lead.name, lead.listingCode))}
                        className="mt-1 w-fit text-xs font-medium text-brand hover:underline"
                      >
                        {dict.listing.whatsapp} →
                      </a>
                    )}
                  </article>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{d.performance}</h2>
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="text-left text-muted">
              <tr className="border-b border-line">
                <th className="p-3 font-medium">{d.cols.listing}</th>
                <th className="p-3 text-right font-medium">{d.cols.views}</th>
                <th className="p-3 text-right font-medium">{d.cols.leads}</th>
                <th className="p-3 text-right font-medium">{d.cols.saves}</th>
                <th className="p-3 text-right font-medium">{d.cols.average}</th>
                <th className="p-3 text-right font-medium">{d.cols.confirmed}</th>
              </tr>
            </thead>
            <tbody>
              {own.map((l) => {
                const s = statsFor(l.code);
                const days = daysSince(l.lastConfirmedAt);
                const average = localityAverage(l, localityBySlug.get(l.localitySlug));
                return (
                  <tr key={l.code} className="border-b border-line last:border-0">
                    <td className="p-3">
                      <Link href={`/${lang}/listings/${l.code}`} className="font-medium hover:underline">
                        {l.code}
                      </Link>
                      <div className="text-xs text-muted">{l.title[lang]}</div>
                    </td>
                    <td className="p-3 text-right tabular-nums">{s.views}</td>
                    <td className="p-3 text-right tabular-nums">{leads.filter((x) => x.listingCode === l.code).length}</td>
                    <td className="p-3 text-right tabular-nums">{s.saves}</td>
                    <td className="p-3 text-right tabular-nums">
                      {average ? `${formatRupees(average.amount)} ${units[average.unit]}` : "–"}
                    </td>
                    <td className={`p-3 text-right ${l.status === "EXPIRED" || days > 14 ? "text-accent" : ""}`}>
                      {d.daysAgo(days)}
                      {l.status === "EXPIRED" && <div className="text-xs">{d.expired}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="text-xl font-semibold">{d.share}</h2>
          <p className="text-sm text-muted">{d.shareHint}</p>
          <ul className="flex flex-col gap-2">
            {SHARE_CHANNELS.map((channel) => {
              const path = sharePath(`/agent/${broker.slug}`, channel);
              return (
                <li key={channel} className="flex items-center gap-2 rounded-lg border border-line bg-surface p-2 text-sm">
                  <span className="w-24 shrink-0 text-muted">{d.sources[channel]}</span>
                  <code className="min-w-0 flex-1 truncate">{path}</code>
                  <CopyButton path={path} label={d.copy} done={d.copied} />
                </li>
              );
            })}
          </ul>
        </section>

        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="text-xl font-semibold">{d.classified}</h2>
          <ul className="flex flex-col gap-2">
            {live.map((l) => {
              const text = classifiedText(l, localityBySlug.get(l.localitySlug));
              return (
                <li key={l.code} className="flex items-start gap-2 rounded-lg border border-line bg-surface p-3 text-sm">
                  <p className="flex-1" lang="te">
                    {text}
                  </p>
                  <CopyButton text={text} label={d.copy} done={d.copied} />
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

// Signed in, but this number has no broker profile: no data, just a way to ask for one.
function NoProfile({ title, message, cta, support }: { title: string; message: string; cta: string; support: string }) {
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-xl border border-line bg-surface p-5">
      <h1 className="text-xl font-bold">{title}</h1>
      <p>{message}</p>
      <a href={`https://wa.me/${support}`} className="w-fit rounded-lg bg-brand px-4 py-2 font-medium text-surface">
        {cta}
      </a>
    </section>
  );
}
