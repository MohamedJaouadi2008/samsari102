# X03:2025 — Samsari Mapping (AI-Generated Code / "Vibe Coding")

**Maturity Level: 2 — Discipline gap, biggest hidden risk**

## Brutal Truth

Samsari is **built on Lovable** — every component, edge function, RLS policy, and migration originated from an AI prompt. This category is not theoretical here. It is the **single largest hidden risk surface**.

## Score

| Status | Count |
|---|---|
| ✅ Implemented | 3 |
| ⚠️ Needs discipline | 6 |
| ❌ Missing | 4 |

## Current State

### ✅ What works
1. **Centralized SDK use** — `src/integrations/supabase/client.ts` is the single Supabase entry; AI cannot easily invent parallel auth flows.
2. **Reusable security primitives**: `_shared/rateLimit.ts`, `has_role()`, `is_admin_or_moderator()`, `protect_booking_financial_fields` trigger, `validate_booking_status_transition` trigger.
3. **Frontend validation library** — `src/lib/validation.ts` (Zod) is the canonical schema source.

### ❌ What's missing

#### ❌ No enforced security review on AI output
- No SAST in CI (no Semgrep, no `eslint-plugin-security`).
- `eslint.config.js` disables `@typescript-eslint/no-unused-vars` and has no security rules.
- AI-generated migrations are auto-applied after user click-through; no second human read.

#### ❌ No "understanding gate"
- No checklist forcing the operator to explain auth boundaries / RLS scope / financial flow before accepting an AI patch.
- Risk: edge function shipped with `verify_jwt = false` (see `supabase/config.toml` — 30+ functions) without confirming each is intentionally public.

#### ❌ No internal pattern library document
- Memory files exist (`mem://security/...`, `mem://payments/...`) but no single "secure pattern catalogue" that AI is forced to consult before writing new code.
- AI may invent a new auth check pattern instead of reusing `has_role()`.

#### ❌ No diff risk analysis
- No automated flag when an AI patch touches: RLS, `bookings` financial columns, edge function `verify_jwt`, secret usage.

### ⚠️ Discipline gaps

| Gap | Evidence in repo |
|---|---|
| Inconsistent error masking | `create-checkout` whitelists user-facing errors; `pay-remaining`, `confirm-check-out`, `release-escrow` leak raw `error.message`. AI replicated different patterns. |
| Inconsistent CORS headers | `mem://system-architecture/edge-function-cors-policy` standardizes them, but several functions have ad-hoc subsets. |
| Two parallel role systems | `admin_roles` (legacy) + `user_roles` (`app_role` enum). AI keeps generating helpers for both (`is_admin`, `is_admin_or_moderator`, `has_role`, `has_panel_role`, `has_admin_role`) — proves AI invented patterns instead of consolidating. |
| Sequential `.update()` in `confirm-check-out` | AI did not use a transactional RPC — partial-write risk (already documented in A10 mapping). |
| Direct `error.message` exposure in 5+ functions | AI copy-pasted catch-blocks instead of using a shared masker. |
| `verify_jwt = false` proliferation | 30+ functions; some legitimate (webhooks, sitemap, prerender), some questionable. No audit trail for *why*. |

## Real Attack Scenarios (Samsari-specific)

### Scenario A — Subtle RLS hole from AI
AI adds a new feature table, generates RLS like `USING (true)` for "easier debugging", merges. Public read leak. (Mitigated today only by manual scan.)

### Scenario B — Architectural drift
AI generates a new payment-adjacent edge function (e.g. promo-related) without reusing `redeem_promo_code` RPC, bypasses the atomic claim → double-spend.

### Scenario C — Silent tech debt
Five different "is admin" helpers already coexist. Next AI session adds a sixth. Eventually one diverges and grants admin to a normal user.

### Scenario D — Confident-wrong financial logic
AI miscalculates platform fee in a new function, ignores `get_platform_fee_rate()`, hardcodes 10%. Quietly skews payouts.

## Priority Fix Plan

### P1 — Enforce understanding (process, not code)
- [ ] Rule: every AI patch touching `supabase/migrations/`, `_shared/`, `bookings`, `profiles`, RLS, or `verify_jwt` requires a one-sentence justification in the commit/chat **before** acceptance.
- [ ] If the operator can't explain the diff in plain English, revert.

### P2 — Mandatory automated review layer
- [ ] Add `eslint-plugin-security` and re-enable `@typescript-eslint/no-unused-vars`.
- [ ] Add Semgrep config with rules for: `dangerouslySetInnerHTML`, raw SQL string concat, `verify_jwt = false`, `USING (true)` in RLS, hardcoded secrets.
- [ ] CI gate: PR fails on new findings.

### P3 — Internal pattern catalogue (force AI to reuse)
- [ ] Create `mem://patterns/secure-edge-function.md` with the canonical template:
  - CORS headers from shared constant
  - JWT extraction + `auth.getUser`
  - Zod input schema
  - Rate limit call
  - Try/catch with whitelisted error masker
  - Audit log write
- [ ] Create `mem://patterns/secure-rls.md` with: never `USING (true)` on writable tables, always `auth.uid()` scoped, security-definer functions for cross-table checks.
- [ ] Reference these in the project's core memory so every AI session loads them.

### P4 — Consolidate duplicated security primitives
- [ ] Pick one role system (`user_roles` + `app_role`) and migrate `admin_roles` → deprecate.
- [ ] Reduce 5 admin-check functions to 2: `has_role(_user_id, _role)` + `is_admin_or_moderator()`.
- [ ] Build `_shared/errorMask.ts` and refactor every edge function to use it.

### P5 — Diff risk analysis
- [ ] Pre-commit hook flags any diff that:
  - Adds `verify_jwt = false`
  - Modifies `protect_booking_financial_fields` or `validate_booking_status_transition`
  - Adds a column to `bookings` matching `*_amount|*_status|stripe_*`
  - Adds an RLS policy with `true` or missing `auth.uid()` reference
- [ ] Each flag requires explicit override comment.

### P6 — Limit AI scope (operator policy)
- ✅ Use AI for: UI components, copy, refactors, boilerplate, SEO metadata, test scaffolds.
- ❌ Don't use AI for: net-new auth flows, net-new payment math, net-new RLS without consulting `mem://patterns/`.

## Bottom Line

Samsari's biggest risk is **not an external attacker**. It is shipping AI-generated code the operator doesn't fully understand, fast enough that subtle flaws (extra admin helper, missing rate limit, leaked error message, `verify_jwt=false` on the wrong function) accumulate into a quiet systemic failure.

The fix is **process discipline + reusable patterns + automated diff gates**, not more code.

## Final Score

**Maturity Level 2** — strong primitives exist but are not enforced as the only path; AI repeatedly reinvents parallel patterns. Reaching Level 4 requires a pattern catalogue + CI security gates + a "no merge without understanding" rule.

## Final Reality Check (priority across X01 / X02 / X03)

1. **X01 (Resilience)** → critical. Real outage risk under load or dependency failure.
2. **X03 (AI misuse)** → strategic. Slow-burn risk that compounds every sprint.
3. **X02 (Memory)** → low. Folded into X01 payload-cap work; no standalone effort warranted.