# OWASP A09:2025 — Samsari Mapping
**Security Logging & Alerting Failures**

**Maturity Assessment: Level 3 (Centralized Logging) — partial Level 4**

Samsari benefits from Supabase's managed observability stack (Postgres logs, Edge Function logs, Auth logs) plus domain-specific audit tables. Real-time alerting is partial.

---

## ✅ What Samsari Does Right

### 1. Critical Event Logging — Domain Audit Tables
- **`escrow_audit_log`** — every escrow state change (action_type, reason, previous/new status, triggered_by, stripe IDs, amount). Append-only via RLS (no UPDATE/DELETE policies).
- **`webhook_events`** — full Stripe webhook payload + db_changes + error_message + processing_status. Idempotent via `event_id`.
- **`processed_stripe_events`** — replay protection log.
- **`rate_limits`** — tracks request counts per identifier/scope (used by `_shared/rateLimit.ts`).
- **`notifications`** — user-facing security events (booking changes, disputes, payment failures).
- **`ban_appeals`** + `profiles.warning_count`/`banned_at`/`banned_reason` — moderation audit trail.
- **`id_verifications`** — submission/review trail with `reviewed_at`, `reviewer_notes`, `warning_count`.

### 2. Centralized Logging (Managed)
- **Supabase Postgres logs** — all DB queries, errors, severity levels.
- **Supabase Auth logs** — login attempts, password resets, OTP, OAuth flows. Accessible via `auth_logs` analytics.
- **Edge Function logs** — every invocation logged with status, execution time, deployment ID. All 50+ edge functions emit `console.log`/`console.error`.
- **Edge HTTP logs** (`function_edge_logs`) — request method, response status, latency.

### 3. Log Integrity (Append-Only Pattern)
- `escrow_audit_log` RLS: only INSERT (admin-only) + SELECT — **no UPDATE, no DELETE**.
- `processed_stripe_events` RLS: read-only to admins, writes only via service role.
- `webhook_events` written exclusively by `stripe-webhook` edge function (service role).
- Database triggers (e.g., `protect_booking_financial_fields`) **raise exceptions** when sensitive columns are mutated outside system context — logged automatically by Postgres.

### 4. Sensitive Data Hygiene (CWE-532)
- ID verification images served via signed URLs (`get-signed-url`), **never logged in raw form**.
- Stripe webhooks log `event_id`/`event_type` but redact full PII payloads in our DB.
- Memory rule: ID verification images must never appear in API responses → enforced.
- No password/token logging found in edge function audit.

### 5. Fail-Closed Behavior
- `validate_booking_status_transition` raises exception on invalid state jumps → logged in Postgres logs.
- `protect_booking_financial_fields` blocks unauthorized financial mutations.
- `check_rate_limit` denies requests when threshold exceeded.
- Stripe signature verification failures throw → logged + 400 response.

### 6. User-Facing Alerting
- **Real-time notifications** (browser push + email via `send-notification-email`) for: bookings, disputes, payment failures, refunds, ban warnings.
- **Admin notifications** for new bookings, disputes, ID verification submissions.
- `BanWarningDialog` surfaces strike/ban events to users.

---

## ⚠️ Gaps & Recommendations

### 🟡 Gap 1 — No Failed Login Brute-Force Alerting
**Current**: Auth logs capture failures but no automated alert on N failed attempts from same IP/email.
**Fix**: Add a cron edge function that polls `auth_logs` for failed login spikes → notify admins. Or rely on Supabase Auth's built-in CAPTCHA + leaked password protection (already in `mem://security/mfa-and-captcha`).

### 🟡 Gap 2 — No Centralized SIEM / Real-Time Detection
**Current**: Logs are siloed across Postgres / Auth / Edge Functions dashboards.
**Fix**: Forward Supabase logs to external SIEM (Datadog, Logtail, Better Stack) for cross-source correlation and detection rules.

### 🟡 Gap 3 — No MTTD/MTTR Metrics
**Current**: No dashboards measuring detection or response latency.
**Fix**: Define SLAs (e.g., dispute alert < 5 min, ban-appeal review < 24h) and track in admin panel.

### 🟡 Gap 4 — No Honeytokens
**Current**: No decoy admin accounts or fake high-value bookings to bait attackers.
**Fix (advanced)**: Insert a honeypot row in `admin_roles` with monitored `user_email` — any access attempt = guaranteed intrusion signal.

### 🟡 Gap 5 — Client-Side Errors Not Captured
**Current**: No Sentry / front-end error tracking. Console errors die in user's browser.
**Fix**: Integrate Sentry (or similar) for React error boundaries + unhandled promise rejections, especially around payment + auth flows.

### 🟡 Gap 6 — No Incident Response Playbook
**Current**: No documented runbook for: Stripe webhook outage, mass ban event, RLS policy bypass, leaked admin credentials.
**Fix**: Author `INCIDENT_RESPONSE.md` covering: who is paged, rollback procedure, comms template, forensic snapshot.

### 🟡 Gap 7 — Rate Limit Coverage Incomplete
**Current**: `check_rate_limit` exists but only some edge functions enforce it (e.g., not all auth-adjacent endpoints).
**Fix**: Audit all public edge functions; apply `_shared/rateLimit.ts` to: `create-checkout`, `pay-remaining`, `process-referral-signup`, `translate`, `host-ai-insights`.

### 🟡 Gap 8 — No Alert on Privilege Changes
**Current**: Adding a row to `user_roles` or `admin_roles` doesn't notify existing admins.
**Fix**: Database trigger on INSERT into `admin_roles`/`user_roles` → call `send-notification-email` to all current admins.

---

## 🧪 Verification Tests to Run

| Test | Expected Outcome | Status |
|------|------------------|--------|
| 100 failed logins from one IP | Auto-block or admin alert | ❌ Missing |
| Tamper attempt on `escrow_audit_log` | RLS denial + Postgres error log | ✅ Passes |
| Replay Stripe webhook | Idempotent (no duplicate processing) | ✅ Passes |
| Insert into `admin_roles` | Existing admins notified | ❌ Missing |
| Search edge logs for password/token strings | Zero matches | ✅ Passes |
| Trigger invalid booking transition | Exception logged, request denied | ✅ Passes |
| Front-end crash on `/payment/:id` | Captured in error tracker | ❌ Missing (no Sentry) |

---

## 🎯 Priority Execution Plan

**P0 (this sprint)**
- [ ] Add Sentry for client-side error capture
- [ ] Apply rate-limiter to remaining public edge functions
- [ ] Add trigger: notify admins on `admin_roles` / `user_roles` INSERT

**P1 (next sprint)**
- [ ] Cron job: detect failed-login spikes → admin notification
- [ ] Author `INCIDENT_RESPONSE.md` runbook
- [ ] Forward Supabase logs to external SIEM (Logtail/Better Stack)

**P2 (hardening)**
- [ ] Honeytoken admin row with monitored access
- [ ] MTTD/MTTR metrics dashboard in admin panel
- [ ] Quarterly attack simulation (brute force, replay, RLS fuzzing)

---

## 🧾 Final Verdict

Samsari has **strong domain-event auditing** (escrow, webhooks, moderation) and **solid append-only integrity** thanks to RLS. Where it falls short of Level 4 is **proactive real-time detection** (no SIEM, no brute-force alerting, no client-side error capture) and **incident response readiness** (no playbook).

The platform can investigate breaches *after the fact* — but cannot reliably *detect them while they happen*. Closing P0 + P1 items elevates Samsari to Level 4.
