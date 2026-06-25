# Blue Card

A student discount-card platform. Students register on a native mobile app, get
verified, and receive a **visual** discount card in Apple/Google Wallet.
Protoporia admins manage students, stores, and offers from a web dashboard.

> **Status:** Milestone 1 — **Foundation**. Monorepo scaffold, local dev infra
> (Postgres + Redis), the full Prisma data model + first migration, i18n
> scaffolding, and a university seed. No product features yet — those are built
> milestone by milestone (see `CLAUDE.md`).

See [`CLAUDE.md`](./CLAUDE.md) for the full project context, invariants, and
build order. Source specs: `bluecardmasterspec.md`, `bluecarddesign.md`.

## Repo layout

```
apps/
  mobile/   React Native (Expo) student app
  admin/    React + Vite admin dashboard
  api/      NestJS backend (Prisma schema, migrations, seed)
packages/
  shared/   shared enums, types, the activation rule
infra/
  docker-compose.yml   local dev: postgres + redis
  nginx/  scripts/      deploy assets (filled at the deploy milestone)
```

## Prerequisites

- Node.js ≥ 20 (tested on 22) and npm
- Docker + Docker Compose (for local Postgres + Redis)

## Local development

```bash
# 1. Environment
cp .env.example .env          # adjust if needed; local defaults work as-is

# 2. Install workspaces
npm install

# 3. Start backing services (Postgres + Redis)
npm run dev:infra             # docker compose -f infra/docker-compose.yml up -d

# 4. Database: generate client, apply migrations, seed universities
npm run prisma:generate
npm run prisma:migrate        # creates/apply migrations against DATABASE_URL
npm run prisma:seed

# 5. Run the API
npm run dev:api               # NestJS on http://localhost:3000

# Health checks
#   GET /api/health        -> liveness
#   GET /api/health/ready  -> readiness (pings the database)
```

Admin dashboard: `npm run dev:admin` (Vite on :5173).
Mobile app: `cd apps/mobile && npm install && npm start` (Expo).

Run the tests (activation rule, etc.): `npm test -w @blue-card/api`.

## External accounts & credentials (the human must provide)

Claude Code writes all integration code against env vars; **you** supply the
accounts. Needed before their respective milestones:

| Needed for | What to obtain |
|------------|----------------|
| **Apple Wallet** (longest lead time — start now) | Apple Developer Program (~$99/yr) → Pass Type ID + signing cert + WWDR cert |
| **Google Wallet** | Google Wallet issuer account + service-account key |
| **SMS / phone OTP** | Twilio account + sending number/sender ID + auth token |
| **Email** | Transactional provider (Resend/Postmark/SendGrid/SES) + verified sending domain (SPF/DKIM) |
| **ID photo storage** | S3-compatible bucket + credentials (R2/B2/S3) — or self-host MinIO on the VPS |
| **Domain & DNS** | For `api.<domain>`, `admin.<domain>`, email |
| **Hosting** | Hostinger VPS KVM 2 + SSH access |
| **University list** | Official names (el + en) to seed the dropdown (`apps/api/prisma/seed.ts`) |
| **App publishing** | App Store Connect + Google Play Console accounts |
| **Branding** | Logos, colors, promotional banners (el/en) |
| _(optional)_ stronger tamper detection | A document-forensics API key |

All credentials are read from the environment — see [`.env.example`](./.env.example).
**Never commit secrets.**
