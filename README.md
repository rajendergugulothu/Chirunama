# Chirunama
Your next address, verified.

Chirunama is a Telugu-first property website for Warangal, Hanamkonda and Kazipet. It lets you find homes, plots and shops to rent or buy, and contact owners and brokers directly.

## Tech stack

- Next.js (App Router) and TypeScript
- Tailwind CSS
- PostgreSQL with PostGIS, through Prisma
- Vitest

## Getting started

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The app runs on built-in sample data, so no database is needed for local development. To use PostgreSQL, copy `.env.example` to `.env`, set `DATABASE_URL`, and run `npm run db:migrate`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm test` | Run the unit tests |
| `npm run lint` | Lint the code |
| `npm run typecheck` | Type-check the code |

## License

[MIT](LICENSE)
