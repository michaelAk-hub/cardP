# Blue Card — System Design (v1)

A student discount-card platform. Students register on a native mobile app, get verified, and receive a visual discount card in Apple/Google Wallet. Protoporia admins manage students, stores, and offers from a web dashboard.

## Locked decisions (v1)

- **Roles:** root (creates admins), Protoporia admin (web dashboard), student (native iOS/Android). Stores and offers are data records — no store login.
- **Activation rule:** `account_status = active` when **phone_verified = true AND id_verified = true**. Email verification is *not* an activation gate in v1.
- **Card:** visual-only pass in Apple/Google Wallet. **No savings/redemption tracking** in v1.
- **ID review:** automated tamper score **plus** manual admin decision.
- **2FA:** TOTP (authenticator app) for admin + root only.
- **Messaging:** Twilio for SMS, transactional email provider for mail. Marketing requires stored **opt-in consent + opt-out link**; verification/rejection mails are transactional (exempt).
- **Bilingual:** Greek + English throughout (data stored per-language where user-facing).
- **Scale target:** ~15k students, ~100 stores.

---

## System architecture

```mermaid
flowchart TB
    subgraph clients[Client Applications]
        APP["Student Mobile App<br/>iOS / Android · EL/EN"]
        ADMIN["Admin Web Dashboard<br/>Protoporia · React"]
        ROOT["Root Portal<br/>elevated role"]
    end

    subgraph edge[Access & Security]
        AUTH["Auth Service<br/>JWT sessions"]
        TOTP["TOTP 2FA<br/>admin + root only"]
    end

    subgraph core[Backend Services]
        API["API Server<br/>NestJS / FastAPI"]
        TAMPER["ID Tamper-Check<br/>ELA + EXIF + manual queue"]
        NOTIF["Notification Service<br/>queue + opt-out filter"]
        WALLET["Wallet Pass Service<br/>PassKit + Google Wallet"]
    end

    subgraph data[Data Stores]
        DB[("PostgreSQL")]
        S3[("Encrypted Object Storage<br/>ID photos")]
    end

    subgraph external[External Providers]
        TWILIO["Twilio SMS"]
        MAIL["Email Provider"]
        APPLE["Apple Wallet / PassKit"]
        GOOGLE["Google Wallet API"]
    end

    APP --> AUTH
    ADMIN --> TOTP
    ROOT --> TOTP
    TOTP --> AUTH
    AUTH --> API
    API --> DB
    API --> S3
    API --> TAMPER
    TAMPER --> S3
    API --> NOTIF
    NOTIF --> TWILIO
    NOTIF --> MAIL
    API --> WALLET
    WALLET --> APPLE
    WALLET --> GOOGLE
    APP -.->|add to wallet| APPLE
    APP -.->|add to wallet| GOOGLE
```

---

## Data model

```mermaid
erDiagram
    UNIVERSITIES ||--o{ STUDENTS : "enrolls"
    STUDENTS ||--|| ID_DOCUMENTS : "uploads"
    STUDENTS ||--o{ ID_REVIEWS : "reviewed in"
    ADMIN_USERS ||--o{ ID_REVIEWS : "performs"
    ADMIN_USERS ||--o{ ADMIN_USERS : "creates"
    STUDENTS ||--o{ WALLET_PASSES : "holds"
    STUDENTS ||--o{ VERIFICATION_TOKENS : "has"
    STORES ||--o{ OFFERS : "publishes"
    ADMIN_USERS ||--o{ STORES : "creates"
    ADMIN_USERS ||--o{ OFFERS : "creates"
    ADMIN_USERS ||--o{ CAMPAIGNS : "sends"
    CAMPAIGNS ||--o{ CAMPAIGN_RECIPIENTS : "targets"
    STUDENTS ||--o{ CAMPAIGN_RECIPIENTS : "receives"
    ADMIN_USERS ||--o{ AUDIT_LOG : "acts"

    STUDENTS {
        uuid id PK
        string name
        string surname
        string email UK
        string phone UK
        uuid university_id FK
        string password_hash
        enum account_status "pending|active|deactive"
        bool phone_verified
        bool email_verified
        bool id_verified
        bool marketing_consent
        string card_serial UK
        string deactivation_reason
        timestamp created_at
    }
    ADMIN_USERS {
        uuid id PK
        enum role "root|protoporia"
        string email UK
        string password_hash
        string totp_secret
        bool totp_enabled
        uuid created_by FK
        timestamp created_at
    }
    UNIVERSITIES {
        uuid id PK
        string name_en
        string name_el
        bool active
    }
    ID_DOCUMENTS {
        uuid id PK
        uuid student_id FK
        string front_key
        string back_key
        float tamper_score
        enum tamper_status "clean|suspect|flagged"
        timestamp uploaded_at
    }
    ID_REVIEWS {
        uuid id PK
        uuid student_id FK
        uuid admin_id FK
        enum decision "approved|rejected"
        string reason
        string description
        timestamp reviewed_at
    }
    STORES {
        uuid id PK
        string name_en
        string name_el
        string description_en
        string description_el
        string logo_key
        enum status "active|hidden"
        uuid created_by FK
        timestamp created_at
    }
    OFFERS {
        uuid id PK
        uuid store_id FK
        string title_en
        string title_el
        string description_en
        string description_el
        enum discount_type "percent|fixed"
        decimal discount_value
        string terms
        date expiry_date
        enum status "active|expired"
        timestamp created_at
    }
    WALLET_PASSES {
        uuid id PK
        uuid student_id FK
        enum platform "apple|google"
        string serial_number UK
        enum state "issued|revoked"
        timestamp issued_at
    }
    VERIFICATION_TOKENS {
        uuid id PK
        uuid student_id FK
        enum type "phone_otp|email_verify|password_reset"
        string token
        timestamp expires_at
        bool used
    }
    CAMPAIGNS {
        uuid id PK
        uuid admin_id FK
        enum channel "sms|email"
        string subject
        string body
        json audience_filter
        timestamp sent_at
    }
    CAMPAIGN_RECIPIENTS {
        uuid id PK
        uuid campaign_id FK
        uuid student_id FK
        enum delivery_status "queued|sent|failed|skipped_optout"
    }
    AUDIT_LOG {
        uuid id PK
        uuid admin_id FK
        string action
        json detail
        timestamp created_at
    }
```

---

## Key flows

### 1. Registration → activation
1. Student submits name, surname, email, phone, university (dropdown), ID front + back photos.
2. `students` row created with `account_status = pending`, all verify flags `false`. ID photos uploaded to encrypted storage; `id_documents` row created and queued for tamper-check.
3. Student verifies phone via Twilio OTP → `phone_verified = true`. (Email verify link optional, sets `email_verified` but does not gate activation.)
4. Admin reviews ID (see flow 2). On approval → `id_verified = true`.
5. System rule fires: if `phone_verified && id_verified` → `account_status = active`, issue `wallet_pass`, notify student "card ready" (SMS/email).

### 2. ID review (automated + manual)
1. Tamper-check runs on upload: EXIF/metadata inspection, error-level analysis (ELA), resave/clone heuristics → `tamper_score` + `tamper_status` (clean / suspect / flagged).
2. Admin sees the photos plus the tamper flag in the student detail view. Automated result is advisory — the human decides.
3. **Approve** → `id_verified = true`, `id_reviews` logged.
4. **Reject** → admin must enter `reason` + `description`; stored in `id_reviews`; emailed automatically to the student. `id_verified` stays false.

### 3. New store / new offer → broadcast
- On create, enqueue an email to all students where `account_status = active`. (Spec says inform active+verified students; active already implies verified under the activation rule.)
- Sent via Notification Service; this is arguably promotional, so apply the marketing-consent + opt-out filter to be safe.

### 4. Marketing campaign (advertising page)
1. Admin selects audience (filters: status, university, etc.) and channel (SMS/email).
2. Notification Service expands the audience, **drops anyone with `marketing_consent = false`** (`delivery_status = skipped_optout`), appends an opt-out link/keyword, then sends via Twilio/email.
3. Per-recipient delivery status recorded in `campaign_recipients`.

### 5. Forgot password
- Student requests reset → `verification_tokens` row (`type = password_reset`, short expiry) → email with deep link → new password set → token marked `used`.

---

## Admin dashboard pages

- **Main / analytics:** signups over time, active vs pending counts, active offers, store count.
- **Students table:** unique id, email, phone, status, barcode/card serial, email-verify, phone-verify, id-verify. Row actions: send recovery email, recreate barcode, open ID review, set id-verify, deactivate (manual, with reason).
- **Advertising:** audience builder + SMS/email composer (consent-filtered).
- **Stores:** create/list stores; create/list offers per store.

## Student app pages (Foody/Wolt-style)

- **Home:** promotional banners/carousel.
- **Stores & offers:** searchable list/grid of stores with logos, descriptions, and their offers.
- **Profile:** profile info, verification status, "Add to Apple/Google Wallet" (enabled only when active).

---

## Suggested build order

1. **Foundation:** data model + migrations, auth (students password; admin/root password + TOTP), university seed data, i18n scaffolding (EL/EN).
2. **Registration + verification:** signup, ID upload to encrypted storage, Twilio phone OTP, password reset.
3. **Admin core:** students table, ID review with manual decide + reject-reason email, manual deactivate, audit log.
4. **Tamper-check:** integrate automated scoring into the upload pipeline, surface flag in review UI.
5. **Stores & offers:** CRUD + the broadcast-on-create email.
6. **Wallet:** PassKit + Google Wallet pass issuance on activation (this has the longest external-setup lead time — start the Apple Developer + Google Wallet API accounts early).
7. **Advertising:** audience builder, consent filter, campaign send + per-recipient tracking.
8. **Analytics + polish:** dashboard metrics, bilingual QA, mobile home/stores UI.

## Notes / risks to track

- **GDPR:** ID photos are sensitive data — encrypt at rest, restrict access, define a retention/deletion policy, log every admin view in `audit_log`.
- **Tamper detection is probabilistic** — set expectations that it assists the reviewer rather than replacing them; never auto-reject on score alone.
- **Wallet setup is the critical-path dependency** — Apple Developer (~$99/yr) and Google Wallet API issuer onboarding both take time and approval.
- **SMS cost:** at 15k students, bulk SMS campaigns add up; email is the cheaper default for broadcasts.
