# Blue Card — Master Build Specification & Claude Code Handoff (v1)

> **Purpose of this document.** This is a complete, self-contained brief for building the Blue Card student-discount platform. Hand it to Claude Code as the source of truth. It contains scope, roles, tech stack, data model, every functional flow, security/GDPR rules, the deployment layout, the build order, and explicit instructions for how Claude Code should work. A suggested kickoff prompt is at the very end.

---

## 0. Important note on Base44 vs. real codebase

This spec targets a **real codebase you own and deploy yourself** (native mobile apps + a custom backend on a Hostinger VPS). That is the correct path for these requirements:

- The student app is **native iOS/Android** — Base44 builds web apps only.
- **Custom register/login is required** — Base44 is built around its own authentication and resists custom auth.
- **~15k users + ID tamper checks + dual wallet + TOTP** is past the point where Base44 stays comfortable.

If a specific isolated sub-tool is ever wanted on Base44, this same spec can be reduced into Base44 builder prompts — but the main system is built as code.

---

## 1. Product overview

Blue Card is a student-discount-card platform.

- Students register on a **native mobile app** (iOS + Android), get verified, and receive a **visual discount card** in Apple Wallet / Google Wallet.
- A discount is used by the student simply **showing the card** in their wallet at a store. There is **no scanning and no redemption/savings tracking in v1**.
- **Protoporia admins** manage students, stores, and offers from a **web dashboard**.
- **Root users** create admin accounts.
- Everything is **bilingual: Greek (el) and English (en)**.
- Target scale: **~15,000 students, ~100 stores.**

### Roles (exactly three)

| Role | Surface | Auth | Can do |
|------|---------|------|--------|
| **Root** | Web portal | Email + password + **TOTP 2FA** | Everything an admin can, plus create/manage admin (Protoporia) users |
| **Protoporia (admin)** | Web dashboard | Email + password + **TOTP 2FA** | Manage students, review IDs, manage stores & offers, send campaigns, view analytics |
| **Student** | Native mobile app | **Custom** email + password (+ phone verification) | Register, verify, view stores/offers, manage profile, add card to wallet |

**Stores and offers are data records** owned/created by admin/root. Stores do **not** log in.

---

## 2. Scope

**In scope (v1)**
- Student registration + ID photo upload (front & back)
- Phone verification via SMS OTP (Twilio)
- Optional email verification (not an activation gate) + forgot-password
- Admin ID review: automated tamper check (advisory) + manual decision
- Activation rule, manual deactivation with reason
- Apple Wallet + Google Wallet visual pass issuance
- Stores & offers CRUD; auto-broadcast on creation
- Marketing campaigns (SMS/email) with consent + opt-out
- Admin TOTP 2FA; root creates admins
- Bilingual UI (el/en)
- Admin analytics dashboard

**Out of scope (v1)** — savings/redemption tracking, in-store scanning, store logins, payments.

---

## 3. Recommended tech stack

All choices below are recommendations; they're internally consistent. Swap only with good reason.

| Layer | Choice | Notes |
|-------|--------|-------|
| Mobile app | **React Native (Expo)** | One codebase for iOS + Android; mature Apple/Google Wallet support; i18n via i18next |
| Backend API | **NestJS (Node + TypeScript)** | Structured, testable; shares language with the app. (FastAPI/Python is an acceptable alternative) |
| Database | **PostgreSQL** | |
| ORM | **Prisma** | Migrations + type safety |
| Queue / jobs | **BullMQ + Redis** | SMS/email sending, broadcasts, tamper-check jobs |
| Object storage | **S3-compatible bucket** (Cloudflare R2 / Backblaze B2 / AWS S3) | ID photos, encrypted. MinIO self-hosted on the VPS is a cheaper alternative |
| Admin dashboard | **React + Vite (SPA)** | Talks to the API; served as static files |
| Auth | Custom: **argon2/bcrypt** password hashing, **JWT** access+refresh tokens, **otplib** for TOTP | |
| i18n | **i18next** (app + dashboard) | el/en resource files |
| SMS | **Twilio** | |
| Email | Transactional provider (**Resend / Postmark / SendGrid / Amazon SES**) | Domain verification required |
| Wallet | **Apple PassKit** (signed .pkpass) + **Google Wallet REST API** (signed JWT) | |
| Container/deploy | **Docker Compose** on a Hostinger **VPS KVM 2** | |
| Reverse proxy/TLS | **Nginx + Let's Encrypt (Certbot)** | |

### Suggested monorepo structure
```
blue-card/
  apps/
    mobile/        # React Native (Expo) student app
    admin/         # React + Vite admin dashboard
    api/           # NestJS backend
  packages/
    shared/        # shared types, validation schemas, i18n keys
  infra/
    docker-compose.yml
    nginx/
    scripts/       # backup, deploy
  CLAUDE.md        # project context for Claude Code
  README.md
```

---

## 4. Architecture (component view)

- **Mobile app** and **admin dashboard** call the **API** over HTTPS.
- **API** reads/writes **PostgreSQL**, stores ID photos in the **encrypted object store**, and enqueues jobs to **Redis/BullMQ**.
- A **worker** process consumes the queue: sends Twilio SMS, sends emails, runs the tamper-check, issues wallet passes, and fans out broadcasts.
- **Admin/root** auth requires **TOTP**; **student** auth is custom email/password + phone verification.
- External: **Twilio**, **email provider**, **Apple Wallet**, **Google Wallet**.

(See the companion diagram doc `blue-card-design.md` for the Mermaid architecture + ERD.)

---

## 5. Data model

All user-facing text fields are stored per-language (`_en` / `_el`). All IDs are UUIDs. All tables have `created_at`; mutable tables have `updated_at`.

### students
- `id` (PK), `name`, `surname`, `email` (unique), `phone` (unique)
- `university_id` (FK → universities)
- `password_hash`
- `account_status` enum: `pending | active | deactive` (default `pending`)
- `phone_verified` bool (default false)
- `email_verified` bool (default false)  ← collected, **not** an activation gate
- `id_verified` bool (default false)
- `marketing_consent` bool (default false)
- `card_serial` (unique, nullable until issued)
- `deactivation_reason` (nullable)
- timestamps

### admin_users
- `id` (PK), `role` enum: `root | protoporia`
- `email` (unique), `password_hash`
- `totp_secret`, `totp_enabled` bool
- `created_by` (FK → admin_users, nullable for the first root)
- timestamps

### universities
- `id` (PK), `name_en`, `name_el`, `active` bool  ← powers the fixed dropdown

### id_documents
- `id` (PK), `student_id` (FK)
- `front_key`, `back_key` (object-store keys, never public URLs)
- `tamper_score` float, `tamper_status` enum: `clean | suspect | flagged`
- `uploaded_at`

### id_reviews (audit of every decision)
- `id` (PK), `student_id` (FK), `admin_id` (FK)
- `decision` enum: `approved | rejected`
- `reason` (required on reject), `description` (required on reject)
- `reviewed_at`

### stores
- `id` (PK), `name_en`, `name_el`, `description_en`, `description_el`
- `logo_key`, `status` enum: `active | hidden`
- `created_by` (FK → admin_users), timestamps

### offers
- `id` (PK), `store_id` (FK)
- `title_en`, `title_el`, `description_en`, `description_el`
- `discount_type` enum: `percent | fixed`, `discount_value` decimal
- `terms`, `expiry_date` date
- `status` enum: `active | expired`
- `created_by` (FK → admin_users), timestamps

### wallet_passes
- `id` (PK), `student_id` (FK)
- `platform` enum: `apple | google`
- `serial_number` (unique), `state` enum: `issued | revoked`
- `issued_at`

### verification_tokens
- `id` (PK), `student_id` (FK)
- `type` enum: `phone_otp | email_verify | password_reset`
- `token` (hashed), `expires_at`, `used` bool

### campaigns
- `id` (PK), `admin_id` (FK)
- `channel` enum: `sms | email`
- `subject`, `body`, `audience_filter` json, `sent_at`

### campaign_recipients
- `id` (PK), `campaign_id` (FK), `student_id` (FK)
- `delivery_status` enum: `queued | sent | failed | skipped_optout`

### audit_log
- `id` (PK), `admin_id` (FK), `action`, `detail` json, `created_at`
- Records every admin action, **including every view of an ID photo** (GDPR).

---

## 6. Functional requirements (by flow)

### 6.1 Student registration
- Inputs: name, surname, email, phone, university (dropdown from `universities`), **ID photo front**, **ID photo back**, password.
- On submit: create `students` row with `account_status = pending`, all verify flags false; upload photos to encrypted object store; create `id_documents` row; enqueue tamper-check job.
- Acceptance: duplicate email/phone rejected with clear error; photos never stored as public URLs.

### 6.2 Phone verification (Twilio)
- Student requests OTP → create `verification_tokens` (`phone_otp`, short expiry, hashed) → send via Twilio → student submits code → on match set `phone_verified = true`, mark token used.
- Rate-limit OTP requests per phone/IP.

### 6.3 Email verification (optional) + forgot password
- Email verify: link with `email_verify` token → sets `email_verified`. **Does not gate activation.**
- Forgot password: `password_reset` token, short expiry, single-use, emailed deep link → set new password.

### 6.4 ID review (automated + manual)
- On upload, the tamper-check job computes `tamper_score` + `tamper_status` (EXIF/metadata inspection, error-level analysis, resave/clone heuristics, or a third-party document-forensics API). **Advisory only.**
- Admin opens student detail, sees both photos (via short-lived signed URL) + the tamper flag.
- **Approve** → set `id_verified = true`; write `id_reviews` (decision=approved).
- **Reject** → admin must enter `reason` + `description`; write `id_reviews`; **enqueue an automatic email to the student** with the reason + description; `id_verified` stays false.
- Never auto-reject on tamper score alone — the human decides.

### 6.5 Activation rule (system-enforced)
- Whenever `phone_verified` or `id_verified` changes, evaluate:
  - if `phone_verified == true AND id_verified == true` → `account_status = active`, issue wallet pass (6.7), notify student "card ready" (SMS + email).
- Email verification is **not** part of this rule.

### 6.6 Manual deactivation
- Admin/root can set `account_status = deactive` (manual only) — requires a `deactivation_reason`. Revoke any issued wallet passes (`state = revoked`).

### 6.7 Wallet pass issuance
- Triggered on activation. Generate a **visual** pass (student name, university, card serial, barcode/QR for display only) for **both** Apple (signed .pkpass) and Google (signed JWT save link).
- App shows "Add to Apple Wallet" / "Add to Google Wallet" buttons, enabled only when `account_status == active`.
- Requires: Apple Developer account + Pass Type ID + certs; Google Wallet issuer account + service account key.

### 6.8 Stores & offers
- Admin/root CRUD on stores and offers (bilingual fields, logo upload, discount type/value, terms, expiry).
- **On store create or offer create** → enqueue a broadcast email to all students with `account_status == active`. Treat as promotional: apply the marketing-consent filter and include an opt-out link (see 6.9).
- Offers auto-expire (`status = expired`) past `expiry_date` (scheduled job).

### 6.9 Marketing campaigns (advertising page)
- Admin builds an audience (filters: status, university, etc.), picks channel (SMS/email), writes subject/body.
- Worker expands audience, **drops anyone with `marketing_consent == false`** (record `skipped_optout`), appends an opt-out link (email) / STOP keyword (SMS), sends via Twilio/email, records per-recipient `delivery_status`.
- Transactional messages (OTP, verification, rejection, card-ready) are **exempt** from the consent filter.

### 6.10 Admin & root auth
- Email + password + **TOTP**. First login: enrol TOTP (QR for authenticator app), store `totp_secret`, set `totp_enabled`.
- **Root** has an additional "Admins" area to create/disable Protoporia accounts.

---

## 7. Screens

### Student mobile app (Foody/Wolt-style)
1. **Home** — promotional banners/carousel.
2. **Stores & offers** — searchable list/grid of stores with logos, descriptions, and their offers (the Foody/Wolt feel: cards, images, categories, search).
3. **Profile** — profile info, verification status (phone/ID), and **Add to Apple/Google Wallet** (enabled only when active).
4. Auth screens — register, login, verify phone, forgot password.

### Admin dashboard
1. **Main / analytics** — signups over time, active vs pending counts, active offers count, stores count.
2. **Students** — table: unique id, email, phone, status, card serial/barcode, email-verify, phone-verify, id-verify. Row actions: **send recovery email**, **recreate barcode**, **open ID review** (view photos + tamper flag + approve/reject), **set id-verify**, **deactivate** (with reason).
3. **Advertising** — audience builder + SMS/email composer (consent-filtered, opt-out appended).
4. **Stores** — manage stores; manage offers per store.
5. **Admins** (root only) — create/disable admin users.

---

## 8. Non-functional requirements

- **Bilingual (el/en)** across app, dashboard, and all outbound SMS/email; user-selectable + device default.
- **Scale**: ~15k students; design for moderate concurrency; queue all third-party calls so the API stays responsive.
- **Security**: argon2/bcrypt passwords; JWT access (short) + refresh (rotating); TOTP for admins; rate limiting on auth, OTP, and password reset; input validation everywhere; HTTPS only; secrets in env/secret store, never committed.
- **GDPR / sensitive data**:
  - ID photos are sensitive — **encrypt at rest**, access only via short-lived signed URLs, **log every admin view** in `audit_log`.
  - Store explicit `marketing_consent`; honor opt-out; opt-out link/keyword in every marketing message.
  - Define a **retention & deletion policy**: deleting a student account deletes their ID photos and personal data.
  - Right-to-access / right-to-erasure endpoints.
- **Observability**: structured logs, error tracking, health checks.
- **Backups**: nightly encrypted `pg_dump` to the object store; test restore.

---

## 9. Integrations & prerequisites (the human must obtain these)

Claude Code can write all integration code, but **you** must provide accounts/credentials:

- **Apple Developer Program** (~$99/yr) → Pass Type ID + signing certificate (for Apple Wallet). *Longest lead time — start now.*
- **Google Wallet** issuer account + service-account key (for Google Wallet).
- **Twilio** account + a sending number/sender ID + auth token.
- **Email provider** (Resend/Postmark/SendGrid/SES) + verified sending domain (SPF/DKIM).
- **Object storage** bucket + credentials (R2/B2/S3) — or decide to self-host MinIO on the VPS.
- **Domain name** + DNS (for API, dashboard, email).
- **Hostinger VPS KVM 2** credentials + SSH access.
- **University list** (names in el + en) to seed the dropdown.
- **App Store Connect** + **Google Play Console** accounts to publish the mobile apps.
- **Branding**: logos, colors, promotional banner content (el/en).
- (Optional) a **document-forensics API** key if you want stronger tamper detection than open-source ELA/EXIF.

---

## 10. Deployment layout — Hostinger VPS (KVM 2)

Single VPS via Docker Compose:

- `nginx` — reverse proxy + TLS (Let's Encrypt). Routes: `api.<domain>` → API; `admin.<domain>` → admin static build.
- `api` — NestJS API.
- `worker` — BullMQ consumer (SMS, email, tamper-check, broadcasts, pass issuance).
- `postgres` — database (volume-backed).
- `redis` — queue backend.
- `admin` — static React build served by nginx.
- Object storage = external bucket (recommended) **or** a `minio` container (cheaper, you manage durability).
- Cron/scheduled jobs: offer expiry, nightly backup.

**Mobile apps are not hosted here** — they're built and published to the App Store / Google Play; they just call `api.<domain>`.

**CI/CD**: GitHub repo → GitHub Actions builds images and deploys to the VPS over SSH (or `docker compose pull && up -d`). Mobile builds via Expo EAS.

**Scaling note**: KVM 2 (2 vCPU / 8 GB RAM) is the realistic starting tier for this workload; if concurrency grows, move Postgres to its own box or upgrade to KVM 4. Storing 15k students' photos: size the bucket, not the VPS disk.

---

## 11. Analytics (dashboard main page)

Minimum metrics:
- **Signups over time** (line/bar, by day/week).
- **Active vs Pending counts** (and de-active).
- **Active offers count.**
- **Stores count.**

(Computed from `students`, `offers`, `stores`. No redemption metrics in v1.)

---

## 12. Build order (milestones)

1. **Foundation** — monorepo, Docker Compose (postgres+redis), Prisma schema + migrations, i18n scaffolding, seed `universities`, base CI.
2. **Auth** — student custom auth (register/login/refresh/forgot-password); admin+root auth with TOTP; root "create admin".
3. **Registration + verification** — ID upload to encrypted storage; Twilio phone OTP; email verify (optional).
4. **Admin core** — students table + row actions; ID review (manual approve/reject + reason email); activation rule; manual deactivate; audit log.
5. **Tamper-check** — automated scoring job feeding the review UI flag.
6. **Stores & offers** — CRUD + broadcast-on-create; offer auto-expiry.
7. **Wallet** — Apple + Google pass issuance on activation (start account setup in parallel from day 1).
8. **Advertising** — audience builder, consent filter, campaign send + per-recipient tracking.
9. **Student app UI** — Foody/Wolt-style home + stores/offers + profile + wallet buttons.
10. **Analytics + hardening** — dashboard metrics, rate limits, GDPR endpoints, backups, bilingual QA, store submission.

---

## 13. Acceptance criteria (key flows)

- A student becomes `active` **only** when `phone_verified && id_verified`; never on email verify alone.
- Rejecting an ID **requires** reason + description and **automatically emails** the student.
- New store/offer triggers a broadcast that **excludes** non-consenting students and includes an opt-out.
- Admin/root cannot log in without passing TOTP.
- Wallet buttons are disabled unless the account is active.
- Every ID-photo view by an admin appears in `audit_log`.
- All user-facing text renders in both el and en.

---

## 14. How to use this with Claude Code

Instructions for Claude Code:

1. **Create `CLAUDE.md`** at the repo root summarizing this spec (stack, structure, conventions, the activation rule, GDPR rules) so it persists as context.
2. **Scaffold the monorepo** per section 3, with Docker Compose for local dev (postgres + redis).
3. **Work milestone by milestone** (section 12). For each milestone: write the Prisma models/migrations, the API endpoints + validation, tests, then the UI. Keep PRs/commits per feature.
4. **Write tests** for the activation rule, consent filtering, auth/TOTP, and the reject-email flow — these are the highest-risk logic paths.
5. **Do not hardcode secrets** — read from env; provide a `.env.example`.
6. **Stop and ask the human** whenever a step needs an external account/credential (Apple, Google, Twilio, email, bucket, VPS) — write the code against env vars and note what's required.
7. **Flag, don't guess**, on any security/GDPR decision (retention period, encryption choice).
8. Treat tamper detection as **advisory** — implement the flag, never auto-reject.

### Suggested first prompt to Claude Code
> "Read the attached `blue-card-master-spec.md`. Create a `CLAUDE.md` capturing the stack, repo structure, the activation rule (`active` only when phone_verified AND id_verified), and the GDPR rules. Then scaffold the monorepo from section 3 with a working Docker Compose dev environment (Postgres + Redis), the Prisma schema for all entities in section 5, and the first migration. Don't build features yet — just get a clean foundation that runs locally and a `.env.example`. List every external account/credential I'll need to provide before later milestones."

---

*End of specification. Pair this with `blue-card-design.md` (architecture + ERD diagrams).*
