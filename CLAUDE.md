# CLAUDE.md — Blue Card project context

Persistent context for Claude Code. Source of truth: `bluecardmasterspec.md`
(+ `bluecarddesign.md` for the architecture & ERD diagrams). Read this first.

## What Blue Card is

A **student discount-card platform**. Students register on a **native mobile
app** (iOS + Android), get verified, and receive a **visual** discount card in
**Apple Wallet / Google Wallet**. A discount is used by simply **showing the
card** — there is **no scanning and no redemption/savings tracking in v1**.
**Protoporia admins** manage students, stores, and offers from a **web
dashboard**; **root** users create admins. Everything is **bilingual (el/en)**.
Scale target: **~15k students, ~100 stores**.

## Roles (exactly three)

| Role | Surface | Auth |
|------|---------|------|
| **Root** | Web portal | email + password + **TOTP** · plus can create/manage admins |
| **Protoporia (admin)** | Web dashboard | email + password + **TOTP** |
| **Student** | Native mobile app | custom email + password + phone verification |

Stores and offers are **data records** owned by admins; stores do **not** log in.

## Critical invariants — do not violate

- **Activation rule:** `account_status = active` **only** when
  `phone_verified == true AND id_verified == true`. Email verification is
  **never** an activation gate. Re-evaluate whenever either flag changes.
  Centralised in `packages/shared` → `isActivationEligible()`.
- **ID rejection** requires `reason` + `description` and **auto-emails** the
  student. `id_verified` stays false.
- **Tamper detection is advisory** — surface the flag, **never auto-reject** on
  score alone. The human decides.
- **Broadcast on store/offer create** goes only to `active` students and is
  treated as promotional: apply the **marketing-consent filter** + opt-out.
- **Marketing campaigns** drop `marketing_consent == false`
  (`delivery_status = skipped_optout`) and append opt-out (link/STOP keyword).
  Transactional messages (OTP, verify, rejection, card-ready) are **exempt**.
- **Admin/root cannot log in without passing TOTP.**
- **Wallet buttons** are disabled unless `account_status == active`.

## GDPR / security rules

- **ID photos are sensitive**: encrypt at rest, store only object-store keys
  (never public URLs), access via **short-lived signed URLs**, and **log every
  admin view** in `audit_log`.
- Store explicit `marketing_consent`; honor opt-out everywhere.
- **Retention & deletion**: deleting a student deletes their ID photos + PII.
  Provide right-to-access / right-to-erasure endpoints.
- Passwords: **argon2/bcrypt**. JWT access (short) + rotating refresh. Rate-limit
  auth, OTP, and password reset. Secrets only from env — **never commit secrets**.

## Tech stack

- **Mobile:** React Native (Expo), i18next — `apps/mobile`
- **Admin:** React + Vite, i18next — `apps/admin`
- **API:** NestJS (Node + TypeScript) — `apps/api`
- **DB:** PostgreSQL + **Prisma** (migrations + types)
- **Queue/jobs:** BullMQ + Redis (tamper-check now; broadcasts/passes later).
  `QUEUE_DRIVER=inline` runs jobs in-process for dev (no Redis); `bullmq` for prod.
- **Object storage:** S3-compatible (R2/B2/S3/MinIO) for ID photos
- **Auth:** argon2/bcrypt + JWT (otplib for TOTP)
- **SMS:** Twilio · **Email:** transactional provider (Resend/Postmark/SES)
- **Wallet:** Apple PassKit (.pkpass) + Google Wallet REST (signed JWT)
- **Deploy:** Docker Compose on a Hostinger VPS; Nginx + Let's Encrypt

## Repo structure (monorepo, npm workspaces)

```
apps/
  mobile/   # React Native (Expo) student app
  admin/    # React + Vite admin dashboard
  api/      # NestJS backend  (+ prisma/ schema, migrations, seed)
packages/
  shared/   # shared enums, types, the activation rule
infra/
  docker-compose.yml   # local dev: postgres + redis
  nginx/  scripts/      # deploy assets (filled at deploy milestone)
```

## Conventions

- All IDs are **UUID**. All tables have `created_at`; mutable tables add
  `updated_at`. User-facing text is per-language (`_en` / `_el`).
- Prisma models are **PascalCase**, mapped to **snake_case** tables via `@@map`;
  columns mapped via `@map`. Enums mirror `packages/shared/src/enums.ts`.
- Queue all third-party calls (Twilio/email/wallet) so the API stays responsive.
- Keep commits/PRs per feature. Write tests for the highest-risk logic:
  activation rule, consent filtering, auth/TOTP, reject-email flow.

## Build order (milestones)

1. **Foundation** ✅ — monorepo, Docker Compose (pg+redis), Prisma schema +
   first migration, i18n scaffolding, university seed, base CI.
2. **Auth** ✅ — student custom auth (register/login/refresh/logout/forgot+reset);
   admin/root auth with TOTP enrol+verify; root create/disable admins; argon2
   hashing, rotating refresh tokens, global rate limiting, audit log.
3. **Registration + verification** ✅ — ID upload to encrypted storage
   (S3 SSE / local AES-256-GCM); phone OTP via Twilio Verify (dev verifier
   fallback); optional email verify; activation rule applied on flag change.
4. **Admin core** ✅ — students table (filter/search/paginate) + row actions;
   ID review (approve/reject + reason email); manual deactivate/reactivate;
   audited ID-photo viewing (signed URL / stream); recreate card serial.
5. **Tamper-check** ✅ — advisory scorer (EXIF/metadata + format heuristics,
   pluggable) run as a job (BullMQ / inline driver) on upload; fills
   tamper_score/tamper_status for the review UI. Never auto-rejects.
6. **Stores & offers** ✅ — admin CRUD (bilingual, logo upload, discount/terms/
   expiry) + public catalog; broadcast-on-create (consent-filtered + opt-out);
   scheduled offer auto-expiry.
7. **Wallet** — Apple + Google pass issuance on activation. *(deferred — needs
   Apple/Google credentials)*
8. **Advertising** ✅ — audience builder + preview; consent-filtered campaign
   send (email/SMS) with opt-out; per-recipient delivery tracking. inline/BullMQ.
9. **Student app UI** — Foody/Wolt-style home + stores/offers + profile + wallet buttons.
10. **Analytics + hardening** ✅ — dashboard metrics (summary + signups series);
    GDPR right-to-access/erasure (student self + admin); helmet headers + global
    exception filter; encrypted backup script. (rate limits already global.)

## Working agreements

- **Stop and ask the human** when a step needs an external account/credential
  (Apple, Google, Twilio, email, bucket, VPS) — write code against env vars and
  note what's required (see "External accounts" in `README.md`).
- **Flag, don't guess** on any security/GDPR decision (retention period,
  encryption choice).
- Read secrets from env; keep `.env.example` current; never hardcode secrets.

## Local dev quickstart

```bash
cp .env.example .env
npm install
npm run dev:infra            # postgres + redis via docker compose
npm run prisma:migrate       # apply migrations (apps/api)
npm run prisma:seed          # seed universities
npm run dev:api              # NestJS on :3000  → GET /api/health
```
