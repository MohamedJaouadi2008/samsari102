# X02:2025 — Samsari Mapping (Memory Management)

**Maturity Level: 3 — Safe by language design, monitoring gap**

## Reality Check

Samsari runs on **TypeScript / React (Vite SPA)** + **Deno edge functions** + **Postgres (Supabase)**. All garbage-collected. Classic memory exploits (buffer overflow, use-after-free, double-free) are **not reachable** in this stack.

The real X02 surface here is **memory exhaustion → crash**, which overlaps with X01 (resilience).

## Score

| Status | Count |
|---|---|
| ✅ Implemented (by design) | 6 |
| ⚠️ Needs awareness | 3 |
| ❌ Missing | 1 |

## Risk Map

### ✅ Memory safety (language-level)
- TS/JS in browser, Deno on edge, Postgres on DB.
- No `malloc`, no pointer arithmetic, no manual lifetime management.
- React 18 unmount cleanup handled by hooks; `useEffect` returns properly observed in custom hooks (`useNotifications`, `useUnreadMessages`, `useBlockedDates`).

### ⚠️ Unbounded memory usage (the actual risk)

| Path | Risk |
|---|---|
| `upload-to-r2` | Reads full file into memory (`await req.arrayBuffer()`) before R2 PUT. A 100 MB upload = 100 MB resident. |
| `og-image` | Image render holds full canvas in memory. |
| `host-ai-insights` | Gemini response buffered as full string before JSON parse. |
| `properties` SELECT | RLS allows public read of all published rows; client receives full `photos` JSONB array (no pagination enforced server-side). |
| `messages` realtime | `Inbox.tsx` keeps full message list in component state — long conversations grow unbounded. |
| `ical-import` | Parses full ICS file in memory. |

### ⚠️ Third-party / native modules
- `npm:stripe@14.21.0` — pure JS, safe.
- `npm:@supabase/supabase-js@2.45.0` — pure JS.
- `esm.sh/stripe` — same.
- No native image libs (e.g. `sharp`) on the edge — `og-image` uses pure-JS rendering.
- Frontend: Recharts, Mapbox GL — both managed JS; Mapbox holds GPU buffers but auto-releases on unmount.

### ❌ No memory monitoring
- No edge-function memory metrics surfaced.
- No frontend leak detection (long-lived realtime subscriptions in `Inbox`, `NotificationDropdown`, `useUnreadMessages` could leak if cleanup is missed).
- No alert when `upload-to-r2` resident size spikes.

## Realistic Threat Model

You will **not** see:
- Buffer overflow exploits
- Use-after-free RCE
- Heap spray

You **can** see:
- Edge function OOM kill on large `upload-to-r2` payload (Deno deploy memory cap ≈ 256 MB).
- Browser tab freeze on `Inbox` after thousands of messages accumulate.
- Postgres memory pressure from unpaginated `SELECT * FROM properties` with large JSONB.

## Priority Actions

### P1 — Hard limits at edge
- [ ] `upload-to-r2`: enforce `Content-Length` cap (10 MB) before reading body; reject earlier.
- [ ] All edge functions: reject requests with `Content-Length > 1 MB` unless on upload allowlist.
- [ ] `ical-import`: cap feed size (1 MB) and event count.

### P2 — Stream, don't buffer
- [ ] `upload-to-r2`: stream `req.body` directly to R2 multipart upload instead of `arrayBuffer()`.
- [ ] `og-image`: render with size cap (1200×630 max).

### P3 — Pagination on hot reads
- [ ] Server-side cap `properties` SELECT to 50 rows on public listing endpoints; require explicit `range` header for more.
- [ ] `messages`: paginate at 50 in `Inbox.tsx`, lazy-load older.
- [ ] `notifications`: cap at 100, archive older.

### P4 — Frontend leak hygiene
- [ ] Audit every `supabase.channel(...)` subscription for matching `removeChannel` in cleanup.
- [ ] Verify `useEffect` returns in: `useNotifications`, `useUnreadMessages`, `useUnreadSupportMessages`, `BrowserNotificationsProvider`, `Inbox`.

### P5 — Monitoring
- [ ] Log Deno `Deno.memoryUsage()` snapshot on heavy functions before return.
- [ ] Alert on edge function OOM via `escrow_audit_log`-style observability table.

## Bottom Line

X02 is **not Samsari's main risk**. Spending serious time on memory-corruption hardening here is procrastination on X01 (resilience) and X03 (AI code review).

Treat the memory-related items above as **X01 sub-tasks**: hard payload caps + streaming + pagination. They prevent OOM crashes, which is the only realistic memory failure mode.

## Final Score

**Maturity Level 3** — language guarantees + reasonable defaults, missing only payload caps and frontend subscription audit.