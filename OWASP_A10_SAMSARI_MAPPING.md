# OWASP A10:2025 — Samsari Mapping (Mishandling of Exceptional Conditions)

**Maturity Level: 4 — Fail-Safe Architecture**

## 1. Fail-Closed Behavior ✅

| Path | Implementation |
|---|---|
| `confirm-check-out` | Strict state validation: rejects unless `status === 'checked_in'` and `full_payment_locked === true`. Throws on duplicate confirmation. |
| `validate_booking_status_transition` (DB trigger) | Whitelist state machine — invalid transitions raise exception, blocking the write entirely. |
| `protect_booking_financial_fields` (DB trigger) | Any non-system attempt to mutate financial columns → `RAISE EXCEPTION` → transaction aborts. |
| `release-escrow` | Idempotency keys + status checks before Stripe transfer; on Stripe failure, booking remains in `settlement_pending`. |

## 2. Transaction Safety ✅

- **DB Triggers**: Postgres wraps each statement in implicit transaction; `RAISE EXCEPTION` triggers automatic ROLLBACK.
- **`redeem_promo_code`**: Atomic claim — increments `uses_count` first, rolls back via decrement if booking ownership check fails.
- **`process_booking_settlement`**: Guards on status + dispute window before any state mutation.
- **Stripe webhooks**: `processed_stripe_events` table prevents replay → idempotent.

## 3. Localized Error Handling ✅

Edge functions wrap external calls (Stripe, R2, DB) in scoped `try/catch`:
- `release-escrow`: Inner catch around `payoutError` — failure logged to `escrow_audit_log`, outer catch returns 4xx without leaking internals.
- `charge-damage`: Stripe errors caught separately from booking errors.
- `stripe-webhook`: 6 distinct catch blocks per event type.

## 4. Safe Error Responses ✅

| File | Pattern |
|---|---|
| `create-checkout/index.ts:231` | Whitelist of allowed user-facing errors (`Invalid`, `Unauthorized`, `Booking not found`); everything else → generic `"Checkout failed"`. |
| Most edge functions | `errorMessage instanceof Error ? error.message : String(error)` — but specific functions like `create-checkout` mask. |

⚠️ **Gap**: Several functions (e.g. `confirm-check-out`, `pay-remaining`) return `error.message` directly. Internal validation strings ("Cannot confirm check-out in status: X") are leaked — informative but not sensitive.

## 5. Input Validation ✅

- `create-checkout`: UUID regex, amount bounds (`<= 100_000_00`), URL protocol check, currency whitelist (USD/EUR only — TND explicitly rejected).
- `confirm-check-out`: Photo array bounds (max 10), URL length cap (2000), description min length (10).
- Frontend: zod schemas in `src/lib/validation.ts`.

## 6. Resource Management ✅

- Stateless edge functions (Deno) → no connection pools to leak.
- `cleanup-property-photos`, `cleanup-verification-images` cron → R2 garbage collection.
- `purge_old_property_views` → 90-day retention.
- `rate_limits` table self-cleans (1% sampling).

## 7. Rate Limiting ✅

- `check_rate_limit()` SQL function with bucketed windows.
- `_shared/rateLimit.ts` available to all edge functions.

## 8. Centralized Audit ✅

- `escrow_audit_log` (append-only, RLS denies UPDATE/DELETE).
- `processed_stripe_events` (idempotency log).
- All financial mutations traceable.

## 🔴 Identified Gaps

### Gap 1 — No Global Edge Function Exception Handler
Each function reimplements `try/catch + logStep("ERROR")`. A shared wrapper (`withErrorBoundary`) would standardize:
- Error masking
- Audit log emission
- Alert triggering on repeated failures

### Gap 2 — Error Message Leakage (Low Severity)
Functions like `confirm-check-out`, `pay-remaining`, `release-escrow` return raw `error.message`. While no stack traces or schema details leak, internal logic strings expose state machine details to attackers probing the API.

**Fix**: Apply the `create-checkout` whitelist pattern globally.

### Gap 3 — No Alerting on Repeated Errors (A09 link)
Errors are logged via `console.log` only. No threshold-based alert when:
- N transfers fail in M minutes
- Webhook signature failures spike
- `validate_booking_status_transition` rejections cluster on one user (probing)

### Gap 4 — Partial Transaction Risk in Multi-Step Edge Functions
`confirm-check-out` performs **two sequential UPDATEs** (line 138-141, then 171-179 or 190-199). If the second update fails, the first is already committed → booking left in `host_check_out_confirmed_at SET` but `status` unchanged. 

**Fix**: Wrap multi-step mutations in a Postgres RPC (single transaction) instead of two `.update()` calls from Deno.

### Gap 5 — No Front-End Error Boundary Reporting
React `ErrorBoundary` not wired to any telemetry (Sentry/Logflare). Client-side crashes are invisible.

## Verification Tests Recommended

| Test | Target | Expected |
|---|---|---|
| Force `status='pending'` then call `confirm-check-out` | State machine | 400, no mutation ✅ |
| Submit damage report with empty photos array | Evidence requirement | 400 ✅ |
| Trigger Stripe transfer twice with same idempotency key | `release-escrow` | Second call no-op ✅ |
| Mutate `bookings.host_payout_amount` as authenticated guest | RLS + trigger | Exception ✅ |
| Network-kill mid `confirm-check-out` | Multi-step UPDATE | ⚠️ Partial state possible (Gap 4) |

## Execution Plan

- [ ] Create `_shared/errorBoundary.ts` for edge functions (mask + audit + alert)
- [ ] Migrate `confirm-check-out` two-step UPDATE → single RPC `confirm_checkout(...)`
- [ ] Add Postgres trigger on `escrow_audit_log` to alert admins on repeated `transfer_failed` actions
- [ ] Wire React `ErrorBoundary` to a `client_errors` log table
- [ ] Apply error-message whitelist to all financial edge functions

## Final Score

**Maturity Level 4** — Samsari implements fail-closed state machines, append-only audit logs, transaction-safe DB triggers, and immutable financial fields. Remaining gaps are around **observability** (alerting on edge cases) and **multi-step atomicity** in 2-3 edge functions, not catastrophic fail-open scenarios.
