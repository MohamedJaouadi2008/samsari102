# OWASP A03:2025 — Software Supply Chain Failures: Samsari Mapping

> Audit of Samsari's build, dependency, and delivery pipeline against A03 controls.
> Date: 2026-04-20

---

## Executive Summary

| Metric | Status |
|---|---|
| High/Critical CVEs in dependencies | ✅ **0** (npm audit clean) |
| Dependency sources | ✅ Official npm + Deno std only |
| Secrets in repo | ✅ None (all in Supabase Secrets / build secrets) |
| Build platform | ✅ Lovable managed (isolated, ephemeral) |
| Artifact integrity | ✅ Lovable-signed deploys via CDN |
| SBOM | ⚠️ Generated on-demand (`npm ls` / lockfile) — not committed as artifact |
| Separation of duties | ⚠️ Single-maintainer project (inherent to small teams) |
| Dependency pinning | ⚠️ Caret ranges in package.json; exact pins in bun.lock |

**Overall posture: STRONG.** No vulnerable dependencies, no leaked secrets, managed CI/CD.

---

## 1. Dependency Inventory (SBOM Snapshot)

### Frontend (package.json)
- **Runtime**: React 18.3, Vite 5.4, TypeScript 5.5
- **UI**: Radix UI (`@radix-ui/*`), shadcn/ui, Tailwind 3.4
- **Data**: `@supabase/supabase-js` 2.51, `@tanstack/react-query` 5.56
- **Maps**: `mapbox-gl` 3.7, `leaflet` 1.9, `react-leaflet` 4.2
- **Storage**: `@aws-sdk/client-s3` 3.940 (Cloudflare R2)
- **Forms/Validation**: `react-hook-form` 7.53, `zod` 3.23
- **Total**: ~50 direct dependencies, all from official `registry.npmjs.org`

### Edge Functions (Deno)
- Imports pinned to `deno.land/std@0.224.0` and `esm.sh` with explicit versions
- Stripe SDK, Resend, internal `_shared/` modules only

---

## 2. A03 Control Mapping

| # | OWASP A03 Control | Samsari Implementation | Status |
|---|---|---|---|
| 1 | SBOM visibility | `package.json` + `bun.lock` pin full tree | ✅ |
| 2 | No unmaintained deps | All actively maintained; no CWE-1104 matches | ✅ |
| 3 | No vulnerable deps | `npm audit` → 0 high/critical | ✅ |
| 4 | Trusted sources only | `registry.npmjs.org`, `deno.land/std`, pinned `esm.sh` | ✅ |
| 5 | No secrets in repo | Supabase Vault + build secrets; `.env` only has publishable key | ✅ |
| 6 | Version pinning | Lockfile locks transitive tree; caret in `package.json` | ⚠️ Partial |
| 7 | CI/CD hardening | Lovable managed sandbox; ephemeral; no self-hosted runners | ✅ |
| 8 | Artifact integrity | Immutable per-deploy URLs via Lovable CDN | ✅ |
| 9 | Separation of duties | Branch protection available; single-maintainer project | ⚠️ Operational |
| 10 | Patch management | `dependency_scan` + `dependency_update` enable rapid patching | ✅ |
| 11 | Change tracking | Full git history + Lovable message log | ✅ |
| 12 | Edge function isolation | Deno sandbox; explicit imports; no arbitrary `eval` | ✅ |
| 13 | Toolchain security | No postinstall scripts; lockfile enforced | ✅ |

**Score: 11/13 fully enforced, 2/13 partial (inherent to project scale).**

---

## 3. Mapped CWE Audit

| CWE | Meaning | Samsari Status |
|---|---|---|
| CWE-1104 | Unmaintained third-party component | ✅ None detected |
| CWE-1395 | Vulnerable third-party component | ✅ None (audit clean) |
| CWE-1329 | Non-updatable component | ✅ All deps replaceable |
| CWE-477 | Obsolete functions | ✅ Modern React 18 + ES2020+ |
| CWE-1357 | Untrustworthy component | ✅ All from verified publishers |

---

## 4. Pipeline Model (Samsari Reality)

```
Developer (Lovable AI + human)
  → Code commit (git, tracked)
  → Lovable build sandbox (isolated, ephemeral)
  → Dependency install (locked via bun.lock)
  → Vite build (deterministic)
  → Static artifact
  → Lovable CDN deploy (immutable URL per version)
  → samsari.tech (custom domain)

Edge functions:
  → Supabase Edge Runtime (Deno, sandboxed)
  → Pinned std imports + internal _shared modules
```

Every node is controlled. No self-hosted CI runners, no unsanctioned registries.

---

## 5. Residual Risks & Recommendations

### ⚠️ R1 — Caret Ranges in package.json
`"react": "^18.3.1"` permits minor/patch upgrades on fresh installs. **Mitigation in place**: `bun.lock` pins the exact resolved tree, so builds are reproducible.

### ⚠️ R2 — No Scheduled SCA
Lovable provides on-demand `dependency_scan`, but no cron. **Recommendation**: Run `dependency_scan` before each release.

### ⚠️ R3 — Single-Maintainer Deployment
Separation of duties is operational. **Recommendation**: Enable GitHub branch protection + required reviews if team grows.

### ✅ R4 — Secrets Hygiene (Verified)
- `.env` contains only `VITE_SUPABASE_PUBLISHABLE_KEY` (designed to be public)
- `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `R2_SECRET_ACCESS_KEY`, `DEEPL_API_KEY`, `GEMINI_API_KEY`, `MAPBOX_SECRET_TOKEN` → all in Supabase Secrets
- No hardcoded credentials in `src/` or `supabase/functions/`

---

## 6. Verification Checklist

- [x] `npm audit` → 0 high/critical
- [x] No packages from untrusted GitHub URLs or tarballs
- [x] Lockfile committed (`bun.lock`, `package-lock.json`)
- [x] No arbitrary `postinstall` hooks in dependencies
- [x] No secrets in git history or `.env`
- [x] Edge function imports pinned to explicit versions
- [x] Build runs in isolated Lovable sandbox
- [x] Deploys are immutable per version

---

## 7. Maturity Level

Samsari sits at **Level 3 → Level 4**:
- ✅ Level 1: dependencies tracked
- ✅ Level 2: basic audits clean
- ✅ Level 3: lockfile-based SBOM + Lovable scanning
- ⚠️ Level 4: signed artifacts (Lovable-managed)
- ❌ Level 5: zero-trust supply chain (enterprise tooling)

Appropriate posture for a production SPA marketplace.

---

## 8. Final Verdict

**Samsari is protected against A03:2025 supply chain failures.**

- Zero vulnerable dependencies today.
- Every code path, dependency, and deployment is traceable.
- All secrets correctly externalized.
- Managed build pipeline eliminates most self-hosted-CI attack surface.

Residual items are operational (team-size dependent) — not structural weaknesses.
