# X01:2025 — Samsari Mapping (Application Resilience)

**Maturity Level: 2 — Secure logic, fragile under pressure**

## Score

| Status | Count |
|---|---|
| ✅ Implemented | 9 |
| ⚠️ Needs improvement | 5 |
| ❌ Missing | 3 |

## Control-by-Control

### ✅ 2.1 Rate Limiting (baseline)
- `rate_limits` table + `check_rate_limit()` SQL function (atomic bucketed windows).
- `_shared/rateLimit.ts` wrapper used by edge functions (e.g. `translate`: 60 req/min/IP).
- `clientIdentifier()` composes `user:<uid>` or `ip:<xff>` keys.
- **Gap**: limits are static. No adaptive throttling tied to DB load, queue depth, or Stripe latency. Predictable → bypassable via distributed IPs.

### ⚠️ 2.2 No Global Resource Quotas
- No per-user daily caps on heavy endpoints (`host-ai-insights`, `smart-pricing-suggest`, `occupancy-forecast`, `og-image`, `upload-to-r2`).
- No endpoint cost classification (cheap vs expensive).
- A single host hammering `host-ai-insights` (Gemini call ≈ multi-second) can exhaust LOVABLE_API_KEY budget and starve others.
- **Fix**: add `cost_class` column to rate-limit scope; cheap = 60/min, expensive = 10/hour.

### ❌ 2.3 No Circuit Breaker
External dependencies with no breaker:
- Stripe (`create-checkout`, `verify-payment`, `release-escrow`, `charge-damage`, `pay-remaining`, `stripe-webhook`)
- Cloudflare R2 (`upload-to-r2`, `get-r2-image`, `cleanup-*`)
- Gemini / Lovable AI (`host-ai-insights`, `smart-pricing-suggest`, `occupancy-forecast`)
- DeepL (`translate`)
- Gmail SMTP (`send-notification-email`, `auth-email-hook`)

Current behavior: timeouts default to Deno's network defaults. On dependency outage, every request hangs until upstream times out → connection pile-up → user-facing 5xx storm.

**Required**: shared `withCircuitBreaker(scope, fn, { timeoutMs, failureThreshold, openMs })` wrapper.

### ⚠️ 2.4 Blocking Request Patterns
Synchronous heavy paths:
- `verify-payment` → Stripe round-trip + DB update inside the request.
- `host-ai-insights` → Gemini call (~3-8s) inside the request.
- `smart-pricing-suggest`, `occupancy-forecast` → AI calls in-request.
- `upload-to-r2` → buffers full file in memory before R2 PUT.
- `og-image` → image render in-request.

**Fix direction**: queue + poll for AI/image; stream uploads.

### ❌ 2.5 No Graceful Degradation
| Failure | Current | Should be |
|---|---|---|
| Gemini down | `host-ai-insights` returns 500 | Serve last `host_ai_insights` row (≤24h) as stale-cache |
| DeepL down | `translate` falls back to Gemini ✅ | (only path with degradation) |
| R2 down | `upload-to-r2` hard-fails | Queue + retry, return pending photo id |
| Stripe slow | Booking stuck in `awaiting_payment` | Auto-cancel via `escrow-deadline-cron` ✅ partial |
| SMTP down | Email lost silently | Persist to `notification_outbox`, retry |

### ✅ 2.6 Input Validation
- Zod schemas in `src/lib/validation.ts`.
- Edge functions: UUID regex, amount caps (`<= 100_000_00`), URL protocol check, currency whitelist (`create-checkout`, `pay-remaining`).
- `translate`: 5000 char limit, language whitelist.
- **Gap**: no enforced JSON depth limit, no global `Content-Length` hard cap, file size only checked client-side in `upload-to-r2`.

### ⚠️ 2.7 No Response Size Limiting
- `properties` SELECT can return 1000 rows × full JSONB photos array.
- `host-ai-insights` returns unbounded Gemini text.
- No pagination enforced on `messages`, `notifications`, `escrow_audit_log` reads.
- **Risk**: bandwidth exhaustion + amplification (small request → large response).

### ⚠️ 2.8 No Bot Friction Layer
- Only IP-based rate limiting.
- No CAPTCHA on signup, booking creation, contact-host (per `mem://security/mfa-and-captcha`, Turnstile widget exists for auth but not for high-cost endpoints).
- Distributed bot swarm bypasses IP limits trivially.

### ❌ 2.9 No Bulkhead / Failure Isolation
- All edge functions share the same Supabase project pool, same R2 credentials, same Gemini key.
- A runaway `host-ai-insights` loop drains the AI quota → blocks `smart-pricing-suggest` and `occupancy-forecast` for everyone.
- **Fix**: per-feature API keys + per-feature rate-limit scopes.

### ✅ 2.10 Booking State Machine (correctness resilience)
- `validate_booking_status_transition` trigger enforces whitelist transitions.
- `protect_booking_financial_fields` makes financial columns immutable to non-system writers.
- `processed_stripe_events` prevents webhook replay.
- Protects **correctness**, not **availability**.

### ⚠️ 2.11 No Chaos Testing
- No simulated Stripe 500, R2 latency, DB connection drop.
- No load test against `create-checkout` or `host-ai-insights`.
- Behavior under stress is unknown.

### ⚠️ 2.12 Monitoring Not Resilience-Focused
- `escrow_audit_log`, `processed_stripe_events`, `console.log` in functions.
- **Missing**: dependency latency histograms, queue depth, AI quota burn rate, p95 per edge function.

## Attack Surface Reality

| Scenario | Path | Outcome today |
|---|---|---|
| Resource exhaustion | Spam `POST /bookings` (RLS allows insert with `auth.uid() = guest_id`); each fires `handle_new_booking` + `trigger_notification_email` (pg_net call out) | DB write storm + email queue saturation |
| Dependency collapse | Stripe degraded → `verify-payment` & `stripe-webhook` hang | Bookings stuck in `awaiting_payment`; cron eventually cancels but UX is dead for hours |
| Bot swarm | Distributed IPs hit `host-ai-insights` | LOVABLE_API_KEY exhausted; legitimate hosts get 500 |
| Amplification | `GET /properties?select=*` returns full photos JSONB × 1000 rows | Bandwidth + memory blowup |

## Priority Fix Plan

### P1 — Stop systemic collapse
- [ ] `_shared/withTimeout.ts` (hard cap 15s on every external `fetch`).
- [ ] `_shared/circuitBreaker.ts` (per scope: stripe / r2 / gemini / deepl / smtp). State in `rate_limits`-style table.
- [ ] Global request timeout in every `serve(async req => ...)` handler.

### P2 — Resource quotas
- [ ] Tier rate limits: `cheap` (60/min), `expensive` (10/hour), `premium-ai` (20/day).
- [ ] Apply to `host-ai-insights`, `smart-pricing-suggest`, `occupancy-forecast`, `og-image`, `upload-to-r2`, `translate`.
- [ ] Hard payload cap (1 MB JSON, 10 MB image) at edge.

### P3 — Async architecture
- [ ] Move `host-ai-insights` to a queue table + worker; client polls `host_ai_insights` row.
- [ ] Stream `upload-to-r2` instead of buffering.
- [ ] Defer `send-notification-email` via `notification_outbox` table + cron drain.

### P4 — Graceful degradation
- [ ] AI down → return last cached `host_ai_insights` with `stale: true`.
- [ ] R2 down → queue upload, return `pending_upload_id`.
- [ ] Stripe slow → keep `awaiting_payment` and surface "payment provider slow" banner.

### P5 — Bulkhead
- [ ] Separate Lovable AI key per feature (insights vs pricing vs forecast).
- [ ] Per-feature breaker so AI outage doesn't kill translation.

### P6 — Adaptive defenses
- [ ] Load-aware rate limits (read DB connection count, scale limits down at 70%).
- [ ] Behavioral bot detection (>N booking creates without payment in 1h → require Turnstile).
- [ ] Optional Proof-of-Work on `POST /bookings` for unverified accounts.

## Bottom Line

Samsari is **secure against attackers, fragile under pressure**. Logic is hardened (state machine, RLS, financial-field triggers); availability is not. A Stripe hiccup or coordinated AI-endpoint flood degrades the platform today.

## Final Score

**Maturity Level 2** — baseline rate limiting + state-machine resilience. To reach Level 4 (resilient architecture): circuit breakers, async queues, graceful degradation, and bulkhead isolation.