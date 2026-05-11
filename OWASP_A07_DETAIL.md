# OWASP A07:2025 — Identification & Authentication Failures
## Operator-Level Blueprint

---

## 1. WHAT IT REALLY IS

**Authentication failure = your system accepts the wrong user as the right user.**

It is not about login forms. It is about:
- **Identity proof** — can you prove who someone is?
- **Credential strength** — are secrets resistant to guessing/leaks?
- **Session control** — once authenticated, can the session be stolen or replayed?
- **Attack resistance** — can the system survive automation at scale?

If any one of these fails → authentication is broken.

---

## 2. CORE REALITY

You're playing manual chess. Attackers run scripts at scale.

| You rely on | Attackers use |
|---|---|
| Passwords alone | Leaked credential databases (billions of pairs) |
| User honesty | Automation frameworks (Hydra, Sentry MBA) |
| Basic validation | Behavior patterns + residential proxies |

---

## 3. PRIMARY ATTACK VECTORS

### 🔴 1. Credential Stuffing
Replay leaked username/password pairs from other breaches. Works because **65% of users reuse passwords**.

### 🔴 2. Password Spraying (more effective than brute force)
Try a few common passwords (`Password1!`, `Winter2026`, `<Company>123`) across **thousands of accounts** — slow per-account, evades lockouts.

### 🔴 3. Brute Force
Still works against systems without rate limiting / lockouts.

### 🔴 4. Session Hijacking
Steal cookies via XSS, MITM, malware → reuse session token directly.

### 🔴 5. Session Fixation (CWE-384)
User logs in but session ID does not change → attacker who pre-set the session ID owns the account.

### 🔴 6. Weak Recovery Flows
Security questions = guessable / OSINT-able. "Mother's maiden name" is on Facebook.

### 🔴 7. Default / Hardcoded Credentials
- **CWE-259** — hardcoded passwords in code
- **CWE-798** — default credentials never changed (admin/admin)

This is **negligence**, not a mistake.

---

## 4. ROOT DESIGN FAILURES (CWE MAPPING)

| CWE | Failure |
|---|---|
| **CWE-287** | Improper authentication logic |
| **CWE-307** | No throttling on auth attempts |
| **CWE-521** | Weak password requirements |
| **CWE-613** | Sessions never expire |
| **CWE-640** | Weak password recovery |
| **CWE-295** | Improper TLS certificate validation |
| **CWE-297** | Improper validation of cert host |
| **CWE-384** | Session fixation |
| **CWE-798** | Hardcoded credentials |

These are common — not edge cases.

---

## 5. HOW TO FIX — THE REAL CONTROLS

### 🔴 1. Multi-Factor Authentication (MANDATORY)
Without MFA, passwords alone = broken system. Prefer:
- TOTP (authenticator apps)
- WebAuthn / Passkeys (phishing-resistant — best class)
- Push notifications with number-matching
- SMS only as last resort (SIM swap risk)

### 🔴 2. Modern Password Policy
**Stop:** forced rotation, complex character rules ("must contain uppercase + symbol"), short max lengths.
**Start:**
- Minimum **12 characters**, allow up to 64+
- Block common passwords (top-10k list)
- **Check against breached password lists** (HaveIBeenPwned k-anonymity API)
- Allow paste in password fields

### 🔴 3. Breached Password Detection
At signup AND password change, hash → SHA-1 prefix → query Pwned Passwords. If breached → reject.

### 🔴 4. Rate Limiting & Lockout
- Per-account: progressive delays (1s, 2s, 4s, 8s...)
- Per-IP: cap auth attempts/minute
- Per-username across IPs (catches password spraying)
- CAPTCHA after N failures

### 🔴 5. Account Enumeration Protection
Never reveal which input was wrong:
- Login error: `"Invalid email or password"` (never "user not found")
- Signup: respond identically whether email exists or not — send "if your email is new, check inbox" email
- Password reset: same generic confirmation
- Timing: equalize response time (constant-time compare)

### 🔴 6. Session Management (CRITICAL)
- **Rotate session ID on login** (defeats fixation)
- Cookies: `HttpOnly`, `Secure`, `SameSite=Lax|Strict`
- **Never** put session tokens in URLs
- Idle timeout (e.g., 30 min) + absolute timeout (e.g., 12 hrs)
- Logout = **server-side invalidation**, not just cookie delete
- Re-authenticate before sensitive operations (password change, payout edit)

### 🔴 7. Token Security (JWT / OAuth / SSO)
Always validate:
- `aud` (audience) — token meant for *your* service
- `iss` (issuer) — signed by trusted IdP
- `exp` / `nbf` — within valid window
- `scope` — requested operation allowed
- Signature with proper algorithm (reject `alg: none`)
- Use **short-lived access tokens** + refresh token rotation

### 🔴 8. Remove Default Credentials
Pre-deployment checklist:
- No `admin/admin`, `test/test`, `root/root`
- No hardcoded API keys/secrets in source
- Force credential change on first login for any seeded accounts

### 🔴 9. Secure Recovery Flow
Replace security questions with:
- Email magic link or 6-digit OTP, **short TTL (5–10 min)**
- One-time use tokens (invalidate after consumption)
- Require re-auth + MFA before accepting new password
- Notify the user via separate channel after a reset

### 🔴 10. Bot / Automation Defense
- CAPTCHA (last resort — UX cost)
- Device fingerprinting
- Behavioral anomaly detection (impossible travel, velocity)
- Block known proxy/Tor exit IPs from auth endpoints

---

## 6. SECURE LOGIN FLOW (REFERENCE PATTERN)

```
User → submit credentials
      ↓
Rate-limit check (per-IP + per-account)
      ↓
Credential check (constant-time hash compare)
      ↓
MFA challenge (TOTP / WebAuthn)
      ↓
Issue NEW session ID (rotate)
      ↓
Set cookie: HttpOnly + Secure + SameSite
      ↓
Audit log: login event + IP + user agent
```

---

## 7. VERIFICATION TESTS (STOP ASSUMING)

| Test | Pass criteria |
|---|---|
| **Credential stuffing** | Replay leaked list → most blocked by breached-password check / MFA |
| **Brute force** | 100 attempts in 1 min → account locked / IP throttled |
| **Session reuse** | Logout → reuse old token → server rejects |
| **Session fixation** | Pre-set session ID → login → ID must change |
| **Enumeration** | Valid vs invalid usernames → identical response & timing |
| **Token tampering** | Modify JWT payload → signature check rejects |
| **Recovery hijack** | Reuse reset token after consumption → rejected |
| **MFA bypass** | Skip MFA step in flow → request rejected at every gate |

---

## 8. COMMON DELUSIONS

- ❌ "Users choose good passwords"
- ❌ "We hash passwords, so we're safe"
- ❌ "MFA is optional"
- ❌ "Nobody will target us"
- ❌ "Login is simple"
- ❌ "OAuth means we don't have to think about auth"

Reality: **authentication is one of the most attacked surfaces in any system.**

---

## 9. REAL-WORLD IMPACT

Authentication failures → no exploit code needed:
- Full account takeover (ATO)
- Financial fraud (payouts redirected)
- Data theft (personal info, payment methods)
- Lateral movement to admin accounts
- Reputational damage + regulatory fines (GDPR, PCI-DSS)

---

## 10. METRICS TO TRACK

- **% of accounts with MFA enabled** (target: 100% for admins, >80% users)
- **Failed login attempts / hour** (anomaly baseline)
- **Credential stuffing block rate**
- **Average session lifetime** vs configured maximum
- **% of password resets completed within token TTL**
- **Breached password rejection rate at signup**
- **Time to invalidate session after logout** (should be < 1s)

---

## 11. MATURITY MODEL

| Level | Posture |
|---|---|
| **1** | Password-only, no rate limit, sessions never expire |
| **2** | Hashed passwords + basic rate limit + session expiry |
| **3** | MFA available + breached password check + secure cookies |
| **4** | MFA enforced for sensitive roles + WebAuthn + anomaly detection |
| **5** | Passwordless / passkey-first + continuous re-auth + behavioral biometrics |

---

## 12. EXECUTION CHECKLIST

- [ ] Enforce MFA (mandatory for admin, opt-in for users with nudge)
- [ ] Enable breached password protection at signup + change
- [ ] Implement per-account + per-IP rate limiting on auth endpoints
- [ ] Rotate session IDs on login
- [ ] Set `HttpOnly`, `Secure`, `SameSite` on session cookies
- [ ] Add idle + absolute session timeouts
- [ ] Server-side session invalidation on logout
- [ ] Validate `aud`, `iss`, `exp`, signature on every JWT
- [ ] Generic error messages on login + signup + reset
- [ ] Replace security questions with email/MFA recovery
- [ ] Audit log every auth event (login, logout, MFA, reset)
- [ ] Add automated tests for fixation, enumeration, brute force

---

## 13. FINAL TRUTH

If A06 (Insecure Design) fails → A07 is **inevitable**.
If A07 fails → access control (A01) and everything downstream is **already lost**.

Authentication is not a feature. It is the **foundation**.
