# Blue Card

A student discount-card platform. Students register on a native mobile app, get
verified, and receive a **visual** discount card in Apple/Google Wallet.
Protoporia admins manage students, stores, and offers from a web dashboard.

> **Status:** Milestone 5 — **Tamper-check** (on top of Admin core). An advisory
> tamper scorer (EXIF/metadata + format heuristics, pluggable for a forensics
> API) runs as a background job on ID upload — BullMQ when Redis is configured,
> otherwise an in-process inline driver — and fills `tamper_score`/`tamper_status`
> for the admin review UI. It never auto-rejects. Earlier milestones: Foundation,
> Auth, Registration, Admin core. Remaining features follow milestone by milestone
> (see `CLAUDE.md`).

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

# 5. Create the first root admin (idempotent; reads ROOT_EMAIL/ROOT_PASSWORD)
npm run create:root -w @blue-card/api

# 6. Run the API
npm run dev:api               # NestJS on http://localhost:3000

# Health checks
#   GET /api/health        -> liveness
#   GET /api/health/ready  -> readiness (pings the database)
```

### Auth endpoints (Milestone 2)

Students (mobile app, no TOTP):

```
POST /api/auth/student/register         name,surname,email,phone,universityId,password[,marketingConsent]
POST /api/auth/student/login            email,password
POST /api/auth/student/refresh          refreshToken          # rotates
POST /api/auth/student/logout           refreshToken
POST /api/auth/student/forgot-password  email                 # always 202 (no enumeration)
POST /api/auth/student/reset-password   token,password
GET  /api/auth/student/me               (Bearer access token)
```

Admin / root (web, **TOTP required** — cannot obtain tokens without it):

```
POST /api/auth/admin/login        email,password[,totpCode]
                                  # first login returns { status: 'totp_enrollment_required',
                                  #   enrollmentToken, otpauthUrl, qrDataUrl }
POST /api/auth/admin/totp/verify  enrollmentToken,code        # enrols + issues tokens
POST /api/auth/admin/refresh      refreshToken
POST /api/auth/admin/logout       refreshToken
GET  /api/auth/admin/me           (Bearer access token)
```

Root only (`AdminRole.root`):

```
POST  /api/admins                 email,password[,role]       # create admin
GET   /api/admins                 list admins
PATCH /api/admins/:id/disable     disable (revokes sessions)
PATCH /api/admins/:id/enable      re-enable
```

### Registration + verification (Milestone 3)

Authenticated student (Bearer access token):

```
POST /api/student/id-document          multipart: front, back (JPEG/PNG, <=10MB)
POST /api/student/phone/send-otp       (Twilio Verify)
POST /api/student/phone/verify-otp     code            -> phone_verified, re-runs activation
POST /api/student/email/send-verification
POST /api/student/email/verify         token           (public; no activation gate)
```

- **Storage**: `STORAGE_DRIVER=local` encrypts photos on disk with AES-256-GCM
  (set `STORAGE_ENCRYPTION_KEY`); `STORAGE_DRIVER=s3` uses an S3-compatible
  bucket with server-side encryption and short-lived presigned view URLs. Only
  object keys are stored — never public URLs.
- **Phone OTP**: uses Twilio Verify when `TWILIO_ACCOUNT_SID`,
  `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID` are set; otherwise a dev
  verifier accepts `OTP_DEV_CODE` (default `000000`).
- **Activation rule** (`isActivationEligible`): a student becomes `active` only
  when `phone_verified && id_verified`. Email verification never gates it.

### Admin core (Milestone 4)

Any admin (root or protoporia) — Bearer admin access token:

```
GET   /api/admin/students                         ?status&universityId&search&page&pageSize
GET   /api/admin/students/:id                     detail (flags, university, id-doc, reviews)
GET   /api/admin/students/:id/id-document         viewable links (signed URL or stream path) — audited
GET   /api/admin/students/:id/id-photo/:side      streams a decrypted photo (local driver) — audited
POST  /api/admin/students/:id/id-review           { decision: 'approved' }
                                                  { decision: 'rejected', reason, description }  (emails student)
POST  /api/admin/students/:id/deactivate          { reason }   (revokes passes + sessions)
POST  /api/admin/students/:id/reactivate          re-evaluates the activation rule
POST  /api/admin/students/:id/send-recovery       password-reset email
POST  /api/admin/students/:id/recreate-card-serial
```

- **GDPR**: every ID-photo access/view is written to `audit_log`, as is every
  review decision and deactivation.
- **ID review**: approving sets `id_verified` and re-runs the activation rule
  (→ `active` if phone is verified); rejecting **requires** `reason` +
  `description`, emails the student, and leaves `id_verified` false. Tamper
  status is shown for the reviewer but never auto-decides.

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
