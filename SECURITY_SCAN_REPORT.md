# Samsari — Consolidated Security Scan Report

**Scan date:** 2026-04-22
**Scanners:** Aikido (workspace), Lovable agent_security, supabase_lov, supabase linter

---

## 1. Aikido status

- Aikido is connected at the **workspace level** (connection name: "Samsari").
- It scans automatically; results live in the Lovable **Security** tab.
- The Lovable Security tab aggregates Aikido + Supabase + agent findings — that is the source of truth.
- No code change is required to "enable" Aikido here.

---

## 2. Findings summary

| # | Severity | ID | Title | Source |
|---|----------|----|----|--------|
| 1 | 🔴 ERROR | EXPOSED_SENSITIVE_DATA | Property WiFi passwords & lockbox codes publicly readable | supabase_lov |
| 2 | 🔴 ERROR | PRIVILEGE_ESCALATION | Guests/hosts can overwrite payment & escrow fields on `bookings` | supabase_lov |
| 3 | 🟡 WARN | EXPOSED_SENSITIVE_DATA | Authenticated users can enumerate guest identities via `guest_reviews` | supabase_lov |
| 4 | 🟡 WARN | EXPOSED_SENSITIVE_DATA | Moderators can read bank/Stripe IDs from `profiles` | supabase_lov |
| 5 | 🟡 WARN | SUPA_auth_otp_long_expiry | Auth OTP expiry too long | supabase |
| 6 | 🟡 WARN | SUPA_auth_leaked_password_protection | Leaked password protection disabled | supabase |
| 7 | 🟡 WARN | SUPA_vulnerable_postgres_version | Postgres has security patches available | supabase |

Pre-existing agent findings (already reviewed/ignored): `change_password_no_verify` (ignored — Supabase design), `react_xss_vuln` (mitigated via `sanitizeUrl`).

---

## 3. OWASP mapping

| Finding | OWASP / X category |
|---|---|
| #1 Public WiFi/lockbox exposure | **A01 Broken Access Control** + **A02 Cryptographic Failures** (sensitive data in plaintext, no column scoping) |
| #2 Booking field privilege escalation | **A01 Broken Access Control** — contradicts `protect_booking_financial_fields` trigger; defense-in-depth gap |
| #3 Guest review enumeration | **A01 Broken Access Control** (PII linkability) |
| #4 Moderator over-privilege on profiles | **A01 Broken Access Control** — contradicts `mem://security/admin-authorization-system` tier model |
| #5 OTP long expiry | **A07 Identification & Auth Failures** |
| #6 Leaked password protection off | **A07 Identification & Auth Failures** — already flagged in `mem://security/auth-configuration-hardening`, action regressed |
| #7 Postgres patches | **A06 Vulnerable & Outdated Components** |

---

## 4. Remediation priority

### 🔴 P1 — Fix this turn / next turn (data exposure & escalation)

**P1.1 — Restrict public SELECT on `properties` (Finding #1)**
The current public-read RLS policy returns every column. WiFi password, lockbox code, arrival instructions and parking info are sensitive — they're already gated through `get_property_access_info()` for legitimate users.
**Fix:** drop `wifi_password`, `wifi_name`, `lockbox_code`, `arrival_instructions`, `parking_info`, `address`, `google_maps_url` from the public-read path. Either:
- a) replace the public SELECT policy with a column-restricted view (`properties_public`) that the frontend reads from, or
- b) keep the table policy but force the frontend to never `select('*')` and add a Postgres column GRANT revocation for `anon`.
Option (b) is faster but fragile; option (a) is correct. Recommend (a).

**P1.2 — Lock down booking UPDATE policy (Finding #2)**
The `protect_booking_financial_fields` trigger blocks the writes at runtime, but the RLS policy should not advertise that surface in the first place.
**Fix:** rewrite the `Users can update their bookings` policy to restrict the column set to `request_message`, `host_response`, `check_in_issues_*`, `host_damage_*`, `cancelled_at`. Use a dedicated security-definer RPC for any other host/guest mutation.

### 🟡 P2 — Soon (privilege & PII tightening)

**P2.1 — Restrict moderator profile access (Finding #4)**
Add a `profiles_moderator_view` view excluding `bank_*`, `stripe_*`. Update the moderator policy to use the view; reserve full-row access for `admin_roles`.

**P2.2 — Tighten `guest_reviews` SELECT (Finding #3)**
Replace the `Authenticated can view approved guest reviews` policy with: the involved host, the involved guest, admins. For public display use a denormalized view that exposes only `rating`, `comment`, masked guest display name, and `created_at`.

**P2.3 — Re-enable Leaked Password Protection (Finding #6)**
Already documented as required (`mem://security/auth-configuration-hardening`). Re-enable in Cloud → Users → Auth settings → Email settings → "Password HIBP Check".

### 🟢 P3 — Maintenance

- **#5 OTP expiry** — set OTP expiration ≤ 1 hour in Auth settings (memory already prescribes this).
- **#7 Postgres upgrade** — schedule the patch upgrade in Supabase project settings.

---

## 5. What this scan does NOT cover

- Aikido SAST / dependency findings: visible only in the Security tab UI (workspace-scoped). Recommend a manual review there for any non-overlapping items.
- Multi-step transactional atomicity (already documented in `OWASP_A10_SAMSARI_MAPPING.md`, Gap 4).
- Resilience / circuit breakers (`OWASP_X01_SAMSARI_MAPPING.md`).
- AI-generated code drift (`OWASP_X03_SAMSARI_MAPPING.md`).

---

## 6. Recommended next action

Approve a focused remediation turn that ships:
1. Migration: column-restricted public SELECT on `properties` (P1.1).
2. Migration: column-scoped UPDATE policy on `bookings` (P1.2).
3. Migration: moderator profile view + policy swap (P2.1).
4. Migration: tightened `guest_reviews` SELECT (P2.2).
5. Manual: enable HIBP, reduce OTP expiry, schedule Postgres upgrade (P2.3, P3).

Each migration is independent and reversible.
