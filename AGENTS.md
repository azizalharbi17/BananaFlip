# AGENTS.md

## Cursor Cloud specific instructions

BananaFlip is a single Next.js 14 (App Router) web app — there is no separate backend
service. All data is served from internal API routes backed by an in-memory store seeded
from `src/data/seed-coins.json` (no third-party API calls), so the app runs fully offline
with no database, env vars, or external services required.

Standard commands live in `package.json` (`dev`, `build`, `start`, `lint`,
`generate:logos`); run them with `npm run <script>`. Node 18.17+ is required; Node 22 works.

Notes / gotchas:
- `npm run dev` serves on `http://localhost:3000`.
- `npm run build` pre-renders curated trending flip pages via `generateStaticParams`;
  arbitrary `/<coinA>-flip-<coinB>` pairs render on demand (ISR, `revalidate = 300`).
- `npm run generate:logos` regenerates the SVG monograms in `public/logos/`; the generated
  files are committed, so this only needs re-running when the coin seed list changes.
- `/api/cron/refresh` is Bearer-protected via the optional `CRON_SECRET` env var; it is not
  needed for local development since data comes from the static seed.
