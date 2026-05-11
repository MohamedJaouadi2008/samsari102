# OWASP A06:2025 — Insecure Design — Samsari Mapping

**Audit date:** 2026-04-20
**Scope:** SPA (React/Vite) + Supabase (Postgres + Edge Functions) + Stripe + Cloudflare R2
**Verdict:** **Compliant — Maturity Level 3 → 4** (threat-modeled core flows, defense-in-depth, abuse cases enforced at DB layer)

---

## 1. Executive Summary

Unlike A01–A05 which are mostly about *implementation*, A06 asks: **were the controls designed in?**

For Samsari the answer is **yes** for every money/identity-touching surface. The booking, escrow, payout, verification, messaging, and admin flows all show evidence of explicit threat modeling (state machines, abuse-case triggers, immutable financial fields, ownership checks at multiple layers). The remaining risk is process maturity: threat models live in code & memory, not in formal artifacts.

| Dimension | Rating |
|---|---|
| Identity & access design | ✅ Strong |
| Business-logic design | ✅ Strong |
| Failure-state design | ✅ Strong |
| Trust-boundary design | ✅ Strong |
| Anti-automation design | ⚠️ Partial (no backend rate-limit primitives by platform policy) |
| Formal SDLC artifacts | ⚠️ Implicit (no written threat models) |

---

## 2. Behavior-Class Coverage (Section 4 of blueprint)

| Class | Where it lives in Samsari |
|---|---|
| **Expected** | Booking happy-path: request → confirm → pay → check-in → check-out → settle |
| **Allowed** | Cancellation policies (flexible/moderate/strict), promo redemption, dispute window |
| **Forbidden** | `validate_booking_status_transition`, `protect_booking_financial_fields`, RLS policies, `block_self_referral_by_phone` |
| **Failure** | `escrow-deadline-cron`, `payment_failed` status, auto-cancellation, `auto_action_taken` audit field |

**Finding:** All four classes are explicitly modeled. This is the single strongest signal of design maturity in the codebase.

---

## 3. Anti-Pattern Audit

| Anti-pattern | Samsari status | Evidence |
|---|---|---|
| Broken identity flow | ✅ Avoided | OTP-based password reset (6-digit, time-limited), Google OAuth, email-verification guard before booking |
| Business-logic abuse (unlimited bookings) | ✅ Mitigated | DB-level overlap detection in `useBlockedDates` + booking-state machine + ownership check (`isHost` block in `PropertyBookingCard`) |
| No anti-automation | ⚠️ Partial | `check_rate_limit` RPC exists and is wired in `_shared/rateLimit.ts`; per platform policy, broader backend rate limiting is deferred |
| Trust boundary failure | ✅ Avoided | RLS on every table; `protect_booking_financial_fields` trigger blocks client tampering even with valid auth |
| Undefined failure state | ✅ Avoided | `escrow-deadline-cron` defines no-show, payment-deadline, auto-settlement; `bank_payout_error`, `payment_failure_reason`, `transfer_failure_reason` columns capture partial-fail states |

---

## 4. CWE Coverage

| CWE | Concern | Samsari mitigation |
|---|---|---|
| **CWE-269** Improper privilege mgmt | Role escalation | `user_roles` + `app_role` enum + `has_role` SECURITY DEFINER + `get_panel_role`; admin self-protection prevents self-warn/strike/ban |
| **CWE-522** Credential protection | Plaintext / weak storage | All secrets in Supabase Vault (21 secrets); no creds in code; password policy enforced via Zod (`signUpSchema`) |
| **CWE-434** Unrestricted upload | Malicious files | R2 uploads via signed `upload-to-r2` edge fn; ID-verification bucket private; auto-cleanup of verification & property photos |
| **CWE-256** Plaintext secrets | Hard-coded keys | Zero hardcoded secrets in repo; only `VITE_SUPABASE_PUBLISHABLE_KEY` (anon) ships to client |
| **CWE-362** Race conditions | Double-booking, double-redeem | `redeem_promo_code` uses atomic `UPDATE … RETURNING` with rollback on failure; Stripe webhooks use `processed_stripe_events` idempotency; mandatory `idempotency-key` on transfers/refunds |
| **CWE-501** Trust-boundary violation | Client trusted with money | `protect_booking_financial_fields` trigger blocks 20+ financial columns from non-system writes even with valid `auth.uid()` |
| **CWE-840** Business-logic errors | State-machine abuse | `validate_booking_status_transition` enforces a whitelist of 25+ legal transitions; illegal jumps raise exception |

---

## 5. Threat-Modeled Flows (per blueprint §7.3 — Abuse Cases)

### 5.1 Booking
| Use case | Abuse case | Control |
|---|---|---|
| Guest books property | Books own property | `isHost` check + RLS |
| Guest books property | Books overlapping dates | `isDateBlocked` calendar + `bookings` overlap query |
| Guest books property | Books while banned | `BanWarningDialog` + `is_banned` checks |
| Guest books property | Books without verified email | Email-verification booking guard (per memory) |
| Guest books property | Mutates `total_price` post-creation | `protect_booking_financial_fields` raises exception |
| Guest books property | Skips deposit, jumps to `checked_in` | `validate_booking_status_transition` blocks |

### 5.2 Payment / Escrow
| Use case | Abuse case | Control |
|---|---|---|
| Stripe webhook fires | Replay attack | `processed_stripe_events` table dedupes by `event_id` |
| Manual transfer | Double payout | Mandatory `idempotency-key` header |
| Cancellation | Inflate refund | `calculate_cancellation_refund` SECURITY DEFINER computes server-side |
| Settlement | Early release | `process_booking_settlement` enforces 48h dispute window |
| Check-out | Skip dispute window | `handle_booking_status_timestamps` auto-sets `settlement_due_at = now() + 48h` |

### 5.3 Identity / Roles
| Use case | Abuse case | Control |
|---|---|---|
| User claims admin | Reads `admin_roles` to escalate | Only `SELECT WHERE user_id = auth.uid()` allowed; INSERT/UPDATE/DELETE forbidden |
| Self-referral | Same person uses two accounts | `block_self_referral_by_phone` trigger normalizes & compares phones |
| Admin moderates self | Self-ban / self-warn | `admin-moderation-self-protection` (per memory) |

### 5.4 Reviews & Messages
| Use case | Abuse case | Control |
|---|---|---|
| Host reviews guest | Reviews without stay | RLS requires booking with status in `{checked_out, settlement_pending, dispute_window, settled}` AND `actual_check_out IS NOT NULL` |
| Realtime topic subscribe | Eavesdrop on others' chats | RLS on `messages.topic` cross-checks `conversations` membership |

### 5.5 Property Visibility
| Use case | Abuse case | Control |
|---|---|---|
| Host hides property | Frozen/banned property still visible | Centralized `applyPublicPropertyFilter` + RLS `is_public AND status='published'` |
| Host reveals address | Address scraped pre-payment | `get_property_access_info` SECURITY DEFINER reveals only to host/admin/active-booking guest |

---

## 6. Secure-Design Patterns Present

| Pattern | Where |
|---|---|
| **Least privilege** | Tiered roles (`admin`, `moderator`, `support`, `dispute_manager`, `logistics`); `get_panel_role` |
| **Defense in depth** | RLS + ownership check + financial-field trigger + state-transition trigger |
| **Zero trust** | Every edge function re-verifies `auth.uid()`; client never trusted for money math |
| **Fail secure** | `validate_booking_status_transition` raises on unknown status; `get_property_access_info` raises on unauthorized |
| **Separation of duties** | Hosts can mark guest reviews but not approve them (moderation queue); admins cannot self-discipline |
| **Idempotency** | Stripe events, transfers, refunds, promo redemption |

---

## 7. Failure-State Inventory

| Failure | Defined behavior |
|---|---|
| Payment intent fails | `status='payment_failed'`, `payment_failure_at/reason` recorded |
| Stripe transfer fails | `transfer_failure_at/reason` recorded |
| Bank payout fails | `bank_payout_error`, `bank_payout_status='failed'` |
| Guest no-show | `escrow-deadline-cron` → `auto_action_taken='no_show_cancel'` |
| Remaining-payment deadline missed | `auto_cancelled` transition |
| Dispute window expires with no dispute | Auto `settlement_pending → settled` |
| Webhook double-delivery | `processed_stripe_events` dedupe |
| Saved-search alert race | `last_alerted_at` debounce |
| ID verification expired/rejected | `allow_resubmit`, `warning_count`, auto-cleanup of images |

---

## 8. Verification (per blueprint §9)

| Activity | Result |
|---|---|
| Design review | ✅ Each money/identity feature has documented controls (RLS + trigger + edge fn) |
| Abuse testing | ⚠️ Manual & memory-encoded; no automated abuse-case test suite |
| Business-logic testing | ✅ State machine codified in DB; illegal transitions provably blocked |
| Threat-model validation | ⚠️ Threats mitigated in code but not captured in formal artifacts |

---

## 9. Residual Risks & Recommendations

| # | Risk | Severity | Recommendation |
|---|---|---|---|
| 1 | No formal threat-model artifacts per feature | Low | Add lightweight markdown threat models under `/docs/threat-models/<feature>.md` (assets, abuse cases, mitigations, residual risk) |
| 2 | Abuse cases not encoded as automated tests | Medium | Add Deno tests in `supabase/functions/*/` that attempt forbidden state transitions, double redemptions, replayed webhooks — all should fail |
| 3 | Backend rate limiting is partial (platform policy defers) | Accepted | Track as risk debt; revisit when platform primitives ship |
| 4 | Design-review SDLC gate is implicit | Low | Add a PR checklist requiring "abuse cases considered?" for any change touching `bookings`, `profiles`, `payments`, edge fns |
| 5 | LLM surfaces (translate, host-ai-insights) lack abuse-case docs | Low | Document length caps, output-as-data treatment, and refusal modes |

---

## 10. Maturity Assessment

| Level | Achieved? | Evidence |
|---|---|---|
| 1 — No design security | n/a | — |
| 2 — Basic awareness | ✅ | RLS everywhere, role separation |
| 3 — Threat modeling per major feature | ✅ | Booking/escrow/payout/reviews show explicit abuse mitigations |
| 4 — Secure design patterns + SDLC enforced | ⚠️ Partial | Patterns present; SDLC gate informal |
| 5 — Security-driven architecture, continuous abuse testing | ❌ | No automated abuse-test suite |

**Current level: 3, with strong Level 4 traits.**

---

## 11. Conclusion

Samsari's *design* is its strongest security layer. The hardest A06 failures — undefined failure states, broken trust boundaries, business-logic abuse — are systematically prevented at the database layer, which is the most defensible architectural choice for a Supabase-backed SPA.

To reach Level 4 cleanly:
1. Capture existing threat models as `docs/threat-models/*.md`.
2. Promote abuse cases to Deno tests in CI.
3. Add a written design-review gate for sensitive PRs.

> **A01 controls *who*, A02 controls *config*, A03 controls *deps*, A04 controls *data*, A05 controls *execution* — A06 controls *all of them by deciding what's allowed in the first place*. Samsari passes.**
