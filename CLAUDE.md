@AGENTS.md

# Delivery funnel

Every change to Chirunama, however small, goes through six agents in `.claude/agents/`, in order:

1. **designer**: writes the design brief (flows, screens, data, server surface, copy, acceptance criteria).
2. **builder**: schema, migrations, seed data, dependencies, env vars, shared modules.
3. **implementer**: pages, components, server actions, dictionary strings.
4. **tester**: a test for every acceptance criterion; runs typecheck, lint, unit, build and end-to-end.
5. **reviewer**: reviews the diff against the brief; returns `VERDICT: APPROVE` or `VERDICT: CHANGES REQUIRED`.
6. **deployer**: release checks, deploy assets and, when configured, the deploy itself.

The main session orchestrates: it hands each stage the brief and the previous stages' reports, and does not write feature code itself. A failing test goes back to the implementer; a review that requires changes goes back to the implementer and then through test and review again. Nothing is committed to `main` or deployed without `VERDICT: APPROVE`. Large features are split into slices that each go through the whole funnel.

The `delivery-funnel` workflow in `.claude/workflows/delivery-funnel.js` runs the funnel end to end: it loops test failures back to the implementer, reviews with three lenses (correctness; security, privacy and trust; craft and language), independently verifies each blocking finding, and only reaches the deploy stage once no confirmed blocking finding is left. Run it with the Workflow tool, passing `{ slice, request, scratchDir }` (and `startAt` to resume at build or implement).

# Local development

- Postgres 16 with PostGIS at `DATABASE_URL` (see `.env.example`); `npm run db:migrate` then `npm run db:seed`.
- Without provider keys, OTPs and WhatsApp messages are written to the `Outbox` table and shown at `/te/admin/outbox` instead of being sent.
