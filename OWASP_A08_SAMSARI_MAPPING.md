# OWASP A08:2025 — Software & Data Integrity Failures: Samsari Audit

**Date:** 2026-04-21  •  **Scope:** Samsari (samsari.tech)  •  **Maturity Verdict:** **Level 3 — Managed (with one Level-2 gap: CSP)**

---

## 1. Executive Summary

Samsari does not download or execute external binaries, does not perform raw deserialization of attacker-controlled blobs, and signs/verifies every financial event end-to-end. Trust boundaries are tight (single domain, no shared cookies with subdomains). The principal A08 weak spots are (a) a permissive `script-src` CSP allowing `'unsafe-inline'` and `'unsafe-eval'`, and (b) absence of Subresource Integrity on third-party scripts (Stripe.js, Mapbox). Both are documented below with remediation paths.

---

## 2. Trust Boundary Map

| Boundary | Direction | Verification |
|---|---|---|
| Browser → Supabase | Outbound API | JWT (signed, server-validated `aud/iss/exp`) |
| Stripe → `stripe-webhook` edge fn | Inbound webhook | **HMAC-SHA256 signature** via `stripe.webhooks.constructEventAsync` (`stripe-webhook/index.ts:808`) — unsigned events rejected (line 789) |
| Browser → R2 | Read-only signed URLs | Short-lived signed URL via `get-signed-url` / `get-r2-image` |
| iCal feeds → `ical-import` | External text payload | Parsed as iCal text, stored as date ranges only — no code execution path |
| Cron → privileged edge fns | Server-to-server | `CRON_SECRET` header check |
| Auth email hook | Supabase → custom fn | Shared secret header verification |

No subdomain shares cookies with `samsari.tech`. Support chat, host dashboard, and admin all live under the same origin.

---

## 3. CWE Coverage

| CWE | Concern | Samsari Posture |
|---|---|---|
| **CWE-345** Insufficient verification of authenticity | All inbound financial events HMAC-verified; JWTs signature-verified server-side | ✅ |
| **CWE-494** Download of code without integrity check | No runtime code download. All deps pinned via `package.json` + `bun.lock` | ✅ |
| **CWE-502** Deserialization of untrusted data | No `pickle`/Java-style deserialization. JSON only, Zod-validated (`src/lib/validation.ts`) | ✅ |
| **CWE-829** Inclusion from untrusted sphere | Third-party scripts limited to Stripe + Mapbox + Lovable — no random CDNs | ⚠️ Missing SRI |
| **CWE-830** Web functionality from untrusted source | CSP `script-src` constrains hosts but allows `'unsafe-inline'` + `'unsafe-eval'` | ⚠️ |
| **CWE-915** Improper modification of object attributes | Zod schemas reject unknown keys on critical mutations; RLS prevents privilege fields (e.g. `is_verified`, `is_superhost`) being self-set | ✅ |

---

## 4. Failure-Area Walkthrough (vs `OWASP_A08_DETAIL.md` §5)

### 4.1 Unsigned / Unverified Updates — N/A
No auto-update mechanism. Frontend ships from Lovable's signed build pipeline; edge functions deploy from the repo through Supabase's signed deploy flow. Users never download executables from Samsari.

### 4.2 Untrusted External Code — ⚠️ Partial
Loaded externally:
- `https://js.stripe.com/v3/` (Stripe.js — required to be live, **cannot use SRI** per Stripe policy)
- `https://api.mapbox.com/mapbox-gl-js/...` (could be self-hosted or pinned + SRI)
- Google Fonts CSS

**Gap:** No SRI hashes on Mapbox or font CSS. **Action:** add `integrity=` + `crossorigin="anonymous"` to any non-Stripe `<script>`/`<link>` we control. Stripe.js is whitelisted by exception (documented industry practice).

### 4.3 Insecure Deserialization — ✅
- All API payloads are JSON, parsed by `fetch().json()` then validated by Zod schemas (`signInSchema`, `bookingSchema`, `messageSchema`, `propertyBasicsSchema`, etc.).
- `JSON.parse` usages audited:
  - `Admin.tsx:265`, `FeaturedPropertiesSection.tsx:31` — parse server-controlled `platform_settings.value` (admin-write, RLS-restricted).
  - `useSearchHistory.ts`, `PostStayReviewNudge.tsx`, `BookingConfirmation.tsx` — parse own `localStorage` (attacker would already control the browser; no server trust placed in result).
  - `host-ai-insights/index.ts:246` — parses Gemini tool-call arguments returned from Lovable AI Gateway (trusted upstream + cached `host_ai_insights` row, never executed as code).
- **No `eval()`, no `new Function()`** anywhere in the codebase (verified by ripgrep).

### 4.4 CI/CD Integrity — ✅ (managed)
Builds and deploys are handled by the Lovable platform: signed commits → signed build artifacts → managed Supabase deploy. Repo is read-only outside `supabase/migrations/` for the agent. No raw `curl | bash` steps.

### 4.5 Trust-Boundary Collapse — ✅
- Single eTLD+1 (`samsari.tech`); preview lives on `*.lovable.app` with separate origin.
- Supabase auth cookies scoped to the Supabase project domain, not shared back.
- Support chat is in-app (`support_conversations` table), not a third-party widget — eliminates the "support.company.com cookie hijack" scenario in the A08 brief.

### 4.6 Data Tampering — ✅
- **JWTs:** signed by Supabase (HS256/RS256), `alg: none` impossible — Supabase rejects.
- **Stripe webhooks:** HMAC verified before any DB write (`stripe-webhook/index.ts:789-808`); `processed_stripe_events` table provides idempotency.
- **State machine:** `ALLOWED_TRANSITIONS` (`stripe-webhook/index.ts:19-52`) blocks illegal booking-status mutations even if a webhook payload is replayed.
- **Privileged columns** (`is_verified`, `is_superhost`, `is_banned`, `host_strikes`, `verification_status`) are guarded by RLS — clients cannot self-mutate them; only `service_role` (admin functions) can.
- **Cookies:** authentication uses Supabase JWTs in `localStorage` — no custom unsigned cookies in flight.

---

## 5. Verification Tests (per §10 of the blueprint)

| Test | Result |
|---|---|
| Replay old Stripe webhook | Rejected — `processed_stripe_events` dedupes by `event_id` |
| Send Stripe event with bogus signature | Rejected — `constructEventAsync` throws, fn returns 400 |
| Tamper booking `status` client-side via PATCH | Rejected — RLS + state-machine guard |
| Forge JWT with `alg:none` | Rejected — Supabase enforces signed algs |
| POST extra fields to `bookings` insert | Stripped/ignored — Zod `bookingSchema`, RLS column policy |
| Modify `localStorage` `bookingDetails` | Only affects own UI; server re-validates booking on payment |
| Inject malicious iCal `SUMMARY` | Stored as text only; never rendered as HTML / never `eval`d |

---

## 6. Open Gaps & Action Items

| # | Gap | Severity | Action |
|---|---|---|---|
| 1 | CSP `script-src` allows `'unsafe-inline'` + `'unsafe-eval'` | Medium | Move to nonce/hash-based CSP; Vite supports nonce injection. Drop `'unsafe-eval'` (only Mapbox-GL historically needed it; modern build doesn't). |
| 2 | No Subresource Integrity on third-party scripts/styles we control (Mapbox, Google Fonts) | Low | Add `integrity` + `crossorigin="anonymous"` attributes. |
| 3 | OG image referenced from `storage.googleapis.com` with expiring signature in `index.html` | Low (availability) | Self-host in `/public` to remove external dependency. |
| 4 | No automated supply-chain audit in CI (Lovable handles builds, but `npm audit` / Dependabot equivalent not surfaced) | Low | Run `code--dependency_scan` on a recurring cadence; track in `keywords.md`. |

---

## 7. Maturity Scorecard (vs §14 of the blueprint)

| Level | Description | Samsari |
|---|---|---|
| 1 | Blind trust everywhere | — |
| 2 | Basic hashing | — |
| **3** | **Signature verification (Stripe, JWT, auth-email-hook)** | ✅ **Current state** |
| 4 | Secure CI/CD + artifact signing across the board (incl. SRI on third parties, strict CSP) | 🟡 Partial — close after fixing gaps #1 + #2 |
| 5 | Zero-trust integrity model | — |

---

## 8. Final Truth (per §15)

> *"You don't get hacked because of what you wrote. You get hacked because of what you accepted without checking."*

Samsari verifies every dollar (Stripe HMAC), every session (JWT signature), every state transition (allow-list machine), and every user-supplied schema (Zod). The remaining A08 work is **defensive depth on the browser side** — tightening CSP and adding SRI — not foundational integrity gaps.
