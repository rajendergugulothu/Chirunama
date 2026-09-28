# Chirunama
Your next address, verified.

Chirunama is a Telugu-first property platform for Warangal, Hanamkonda and Kazipet (the Tricity). It covers listing, discovery, verification, agreements and rent. The full product spec is in [docs/product-spec.md](docs/product-spec.md). This repository holds the Phase 1 scaffold: a responsive Next.js PWA and a Postgres + PostGIS data model.

## Stack

- Next.js 16 (App Router) with server rendering for locality and listing SEO
- Tailwind CSS 4, Noto Sans and Noto Sans Telugu
- Prisma 7 on PostgreSQL with PostGIS (`prisma/schema.prisma`)
- Zod for listing validation, Vitest for unit tests

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000, which redirects to /te or /en
npm test
npm run lint
npm run build
```

Pages read from sample data in `src/lib/sample-data.ts` through `src/lib/repository.ts`, so no database is needed to run the app. To work against Postgres, copy `.env.example` to `.env`, point `DATABASE_URL` at a database with PostGIS available, and run `npm run db:migrate`.

## What's here

| Path | What it is |
| --- | --- |
| `src/app/[lang]/` | Every page, under a `te` or `en` locale segment |
| `src/app/[lang]/listings` | Search with category, locality, price, BHK, furnishing, Owner only and Verified only filters |
| `src/app/[lang]/listings/[code]` | Listing detail: price, details, what was checked and by whom, and WhatsApp and call buttons |
| `src/app/[lang]/agent/[slug]` | Public broker profile, which shows only that broker's listings |
| `src/app/[lang]/locality/[slug]` | Locality page with average prices and live listings |
| `src/proxy.ts` | Sends share links without a locale (`/agent/ramesh-realty`) to the reader's language and remembers the choice |
| `src/i18n/dictionaries.ts` | Telugu and English strings |
| `src/lib/listing-schema.ts` | Category-specific listing validation (rentals, sales, plots, commercial) |
| `src/lib/db.ts` | Prisma client, ready for when the repository moves to Postgres |
| `prisma/schema.prisma` | Users, agencies, broker profiles, cities, localities, properties, units, listings, leads, verifications, agreements, ledger, share links, audit events |

City and locality are data, so adding Hyderabad or another town is a configuration change.

## Not built yet

- Posting flow: web form, WhatsApp intake, voice notes and OTP confirmation
- Accounts and phone OTP sign-in
- Broker dashboard: leads inbox, pipeline and marketing kit
- Lead tracking behind the WhatsApp and call buttons, and share-link attribution
- Map view, saved searches and WhatsApp alerts
- Agreements (eStamp and eSign) and rent payments through partners
- The AI agents: intake, moderation, concierge, marketing, document pre-check, agreement and broker success

Telugu strings are drafts. They need to be checked with local users before launch.
