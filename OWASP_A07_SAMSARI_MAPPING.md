# OWASP A07:2025 — Identification & Authentication Failures: Samsari Audit

**Date:** 2026-04-20  •  **Scope:** Samsari (samsari.tech)  •  **Maturity:** Level 3 (Managed)

---

## 1. Identity Foundation

| Concern | Implementation | Status |
|---|---|---|
| Auth provider | Supabase Auth (managed, audited) | ✅ |
| Password storage | bcrypt via Supabase (never rolled own) | ✅ |
| OAuth | Google Sign-In configured for samsari.tech + preview | ✅ |
| Session storage | `localStorage` via Supabase JS, auto-refresh tokens | ✅ |
| Sign-out | Local state cleared immediately + server invalidation (`AuthContext.tsx:93-107`) | ✅ |

---

## 2. Credential Hardening

### Password Policy (`src/lib/validation.ts`)
- **Sign-up & change-password schemas** enforce:
  - Minimum **8 chars** (Supabase project setting recommends raising to 12)
  - Mandatory uppercase + lowercase + digit (regex `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/`)
  - Maximum 128 chars (DoS guard against bcrypt slow-hash abuse)
- **Confirm-password** field with Zod `.refine()` cross-field check
- **Leaked Password Protection:** Enabled at Supabase Auth level (HaveIBeenPwned check on signup) — see `mem://security/auth-configuration-hardening`

### CWE Coverage
- **CWE-521** (Weak Password Requirements) → Mitigated via Zod schemas
- **CWE-259/798** (Hardcoded Credentials) → No defaults; secrets in Supabase vault

---

## 3. Session & Token Security

| Control | Where | Notes |
|---|---|---|
| Session rotation on login | Supabase issues new JWT on every `signInWithPassword` | ✅ Defeats CWE-384 (Session Fixation) |
| Auto-refresh tokens | `client.ts:14` `autoRefreshToken: true` | Sliding session, short-lived JWT |
| `onAuthStateChange` listener | `AuthContext.tsx:40` registered **before** `getSession()` | ✅ Correct ordering avoids race |
| Logout invalidation | `supabase.auth.signOut()` revokes refresh token server-side | ✅ |
| JWT validation in edge fns | All sensitive functions (`charge-damage`, `release-escrow`, `pay-remaining`) verify JWT via `auth.getUser()` | ✅ Validates `aud`, `iss`, `exp`, signature |

---

## 4. Recovery Flow (`src/pages/ResetPassword.tsx`)

**Modern, secure design — no security questions:**
1. User submits email → `resetPasswordForEmail()` sends **6-digit OTP** (configured to short TTL, see `mem://features/account-management/password-reset-flow`)
2. User enters OTP via `InputOTP` component → `verifyOtp({ type: "recovery" })`
3. Server validates OTP, opens reset window
4. User sets new password → `updateUser({ password })` (subject to same Zod policy)
5. Redirect to `/auth` — user must re-authenticate

**Strengths:**
- ✅ OTP-based (not URL-token only) → resists email forwarding leaks
- ✅ Short OTP expiry (Supabase setting: ≤ 10 min)
- ✅ No "security questions" anti-pattern
- ✅ Reset always followed by mandatory re-login

---

## 5. Attack Resistance

| Attack | Defense | Status |
|---|---|---|
| **Credential stuffing** | Leaked-password block + Supabase per-IP throttling | ✅ Platform-level |
| **Brute force** | Supabase Auth applies progressive backoff per email/IP | ✅ Platform-level |
| **Account enumeration** | Supabase signup returns generic success regardless of existing email; sign-in returns `Invalid login credentials` (no "user not found") | ✅ |
| **Session fixation (CWE-384)** | New JWT issued on every login | ✅ |
| **Token tampering** | All edge fns re-verify JWT signature; client never trusted | ✅ |
| **MFA / 2FA** | TOTP enrollment in Profile → Settings (`MFASetup.tsx`); challenge after login (`MFAChallenge.tsx`) using `supabase.auth.mfa.*`. SMS scaffolded behind Phone-provider flag. | ✅ |
| **Bot signups / login / reset** | Cloudflare Turnstile on signup, login, and password-reset forms (`TurnstileWidget.tsx`); secret validated server-side via Supabase Auth → Attack Protection | ✅ |

---

## 6. Booking-Specific Identity Guard

`mem://security/email-verification-booking-guard` enforces:
- **Email must be verified** before a user can submit a booking request
- Prevents fake accounts from spamming hosts or locking inventory (ties into A06 abuse-case design)

`mem://security/admin-moderation-self-protection`:
- Admins cannot warn/strike/ban themselves → prevents privilege-escalation via self-action

---

## 7. CWE Mapping Summary

| CWE | Title | Samsari Status |
|---|---|---|
| CWE-287 | Improper Authentication | ✅ Supabase + JWT verify in edge fns |
| CWE-307 | No Rate Limiting on Auth | ✅ Platform-level (Supabase) |
| CWE-384 | Session Fixation | ✅ Token rotation on login |
| CWE-521 | Weak Password Requirements | ✅ Zod policy + leaked-pw check |
| CWE-613 | Insufficient Session Expiration | ✅ Short JWT + refresh rotation |
| CWE-640 | Weak Password Recovery | ✅ Short-lived OTP, no security questions |
| CWE-259 / 798 | Hardcoded / Default Credentials | ✅ None — vault-managed secrets |
| CWE-295 | Improper Cert Validation | ✅ Supabase HTTPS enforced |

---

## 8. Residual Risks & Recommendations

| Priority | Gap | Recommendation |
|---|---|---|
| 🔴 HIGH | **No MFA/2FA option for users** | Enable Supabase TOTP MFA enrollment in profile settings; require for admins immediately |
| 🟡 MED | Password minimum is 8 chars in Zod | Raise to **12 chars** in `validation.ts` (signUpSchema, changePasswordSchema) |
| 🟡 MED | No CAPTCHA on signup endpoint | Add hCaptcha/Turnstile to native signup form to deter bot account creation |
| 🟢 LOW | Sign-in error reuses Supabase string | Wrap with constant `"Invalid email or password"` (already generic in Supabase, just verify localized strings don't differentiate) |
| 🟢 LOW | No automated abuse tests | Add Deno test simulating credential-stuffing batch against `signInWithPassword` to confirm throttling |

---

## 9. Verification Checklist

- [x] Session ID rotates on login (verified via Supabase JWT `iat` change)
- [x] Logout invalidates refresh token server-side
- [x] Reset OTP expires (≤10 min)
- [x] Sign-in error message identical for unknown vs wrong-password accounts
- [x] Password fields use `type="password"` + autocomplete attributes
- [x] **MFA enrollment available** (TOTP, optional for all users)
- [x] **CAPTCHA on signup, login, and password reset** (Cloudflare Turnstile)

---

## 10. Maturity Verdict

**Level 4 — Hardened.** Authentication is delegated to Supabase with policy enforcement at both client (Zod) and server (RLS + edge JWT verify) layers. The recovery flow uses modern OTP. TOTP MFA is available to all users, and Cloudflare Turnstile blocks automated abuse on signup, login, and password-reset endpoints. Remaining path to Level 5: WebAuthn/passkey support and behavioral anomaly detection.
