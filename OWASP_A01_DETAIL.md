# OWASP A01:2021 — Broken Access Control

> **Rank:** #1 in the OWASP Top 10 (2021)
> **Prevalence:** Found in **94%** of tested applications
> **CWE Mappings:** 34 CWEs map to this category — more than any other.
> **Common CWEs:** CWE-22, CWE-23, CWE-35, CWE-59, CWE-200, CWE-201, CWE-219, CWE-264, CWE-275, CWE-276, CWE-284, CWE-285, CWE-287, CWE-352, CWE-359, CWE-377, CWE-402, CWE-425, CWE-441, CWE-497, CWE-538, CWE-540, CWE-548, CWE-552, CWE-566, CWE-601, CWE-639, CWE-651, CWE-668, CWE-706, CWE-862, CWE-863, CWE-913, CWE-922.

---

## 1. WHAT IS IT

### Textbook definition
Access control enforces policy such that users **cannot act outside of their intended permissions**. Failures typically lead to unauthorized information disclosure, modification, or destruction of data, or performing a business function outside the user's limits.

### Real definition (engineering view)
Broken Access Control is **not** "missing checks" — that is a *symptom*. It is a **failure of authority boundaries**: the system cannot consistently and correctly answer the question:

> *"Is user **U** allowed to perform action **A** on resource **R** under context **C**?"*

When that answer is wrong, missing, or inconsistent across entry points, you have Broken Access Control.

### Why it ranks #1
- Highest incidence rate of any category (3.81% average).
- Highest number of occurrences in tested applications (>318,000).
- Highest number of mapped CWEs.
- Easy to exploit, hard to detect from outside, and devastating in impact.

---

## 2. CORE CONCEPT

Access Control is a **decision function**:

```
ALLOW(user, action, resource, context) → TRUE | FALSE
```

Every protected operation in your system must route through this function. If the logic is **scattered**, **duplicated**, or **implicit**, it will eventually drift and break.

### The three pillars
1. **Authentication** — *Who are you?*
2. **Authorization** — *What are you allowed to do?*
3. **Accountability** — *What did you do, and can we prove it?*

Authentication ≠ Authorization. Logging in does not grant rights.

### Authority boundaries
A boundary exists between:
- Anonymous vs authenticated users
- Standard users vs privileged/admin users
- Owner of a resource vs other users
- Tenant A vs tenant B (multi-tenancy)
- One user's session vs another's
- Trusted internal services vs external clients

Broken Access Control = a boundary you *thought* existed isn't actually enforced.

---

## 3. ACCESS CONTROL MODELS

| Model | Decision based on | Strength | Weakness |
|------|------|------|------|
| **DAC** (Discretionary) | Resource owner grants rights | Flexible | Hard to audit |
| **MAC** (Mandatory) | System-enforced labels (e.g. classification) | Very strict | Inflexible |
| **RBAC** (Role-Based) | User's role | Simple | Rigid, role explosion |
| **ABAC** (Attribute-Based) | User + resource + environment attributes | Fine-grained | Complex |
| **PBAC** (Policy-Based) | Centralized policy engine (e.g. OPA, Cedar) | Scalable, auditable | Requires infra |
| **ReBAC** (Relationship-Based) | Graph of relationships (e.g. Google Zanzibar) | Models real ownership | Complex queries |

> **Rule of thumb:** RBAC alone breaks at scale. Combine RBAC + ABAC, or move to PBAC/ReBAC for serious systems.

---

## 4. COMMON VULNERABILITY TYPES

### 4.1 Vertical privilege escalation
A low-privilege user gains high-privilege rights (user → admin).
- Direct access to admin URLs (`/admin/users`)
- Tampering with role claims in JWT or cookies
- Forced browsing to privileged endpoints

### 4.2 Horizontal privilege escalation (IDOR)
A user accesses another user's data at the same privilege level.
- `GET /account?id=123` → change to `id=124`
- Predictable IDs (sequential integers, short hashes)
- Missing **object-level** authorization

### 4.3 Context-dependent escalation
Access allowed in the wrong state or time.
- Editing a finalized invoice
- Submitting a vote after the poll closed
- Modifying a shipped order

### 4.4 Missing function-level access control
Endpoints exposed without any authorization check.
- Hidden admin features only "protected" by UI
- Internal APIs reachable from the public internet
- Background jobs triggered via HTTP

### 4.5 CORS misconfiguration
- `Access-Control-Allow-Origin: *` with credentials
- Reflecting the `Origin` header without validation
- Allowing arbitrary subdomains

### 4.6 Insecure Direct Object Reference (IDOR)
The application uses user-supplied input to access objects without verifying ownership.

### 4.7 Path traversal / file inclusion
- `../../../etc/passwd`
- Accessing files outside the intended directory

### 4.8 Forced browsing
Guessing or enumerating URLs to find unprotected resources (e.g. `/uploads/invoice_2024_001.pdf`).

### 4.9 JWT / token tampering
- `alg: none` accepted
- Weak signing keys
- No expiration / no revocation
- Role claim trusted without server-side check

### 4.10 Cross-Site Request Forgery (CSRF)
State-changing requests accepted without proof of user intent (no CSRF token, no SameSite cookies).

### 4.11 Cache misconfiguration
Authenticated, user-specific responses cached and served to other users.

### 4.12 Replay / re-use of single-use tokens
Password-reset, magic links, or OTPs that can be used more than once.

---

## 5. ROOT CAUSES

1. **No central authority function** — checks scattered across controllers.
2. **Trusting the client** — frontend hides the button, backend doesn't enforce.
3. **Trusting user input as identity** — `userId` from the request body.
4. **No ownership model** — resources have no `owner_id` field.
5. **Default-allow** instead of default-deny.
6. **Inconsistent enforcement** across REST, GraphQL, WebSockets, jobs, admin tools.
7. **"Authentication = security"** misconception.
8. **Patching symptoms** instead of redesigning authority.
9. **Privilege creep** — roles accumulate permissions and never lose them.
10. **Test environments leaking into prod** — debug routes, seed admin accounts.

---

## 6. HOW TO FIX IT

### 6.1 Architectural principles (non-negotiable)

1. **Deny by default.** Every resource is private unless a rule explicitly allows access.
2. **Centralize authorization.** A single `authorize(user, action, resource)` function — *one* source of truth.
3. **Enforce on the server.** Frontend is decoration. The backend is the only authority.
4. **Model ownership explicitly.** Every resource has an `owner_id` (or equivalent relationship).
5. **Least privilege.** Grant the minimum rights needed; revoke aggressively.
6. **Separation of duties.** No single user/role can execute a sensitive workflow end-to-end (e.g. create + approve a payment).
7. **Re-validate on every request.** Never cache an authorization decision across requests.
8. **Use opaque identifiers.** UUIDs over sequential integers (defense in depth, not the control itself).
9. **Log every denial.** Failed access attempts are signals — alert on bursts.
10. **Disable directory listing** and remove backup/source files from web roots.

### 6.2 Implementation checklist

#### Authorization layer
- [ ] Centralized `authorize()` function or policy engine (OPA, Cedar, Casbin)
- [ ] Policy definitions stored declaratively (config / DSL), not in controller code
- [ ] No direct role checks (`if user.role === 'admin'`) outside the policy layer
- [ ] Object-level (per-resource) checks, not just route-level

#### API & endpoints
- [ ] Every endpoint requires authentication unless explicitly public
- [ ] Every endpoint enforces authorization (function-level + object-level)
- [ ] No trust in client-supplied identity fields (`userId`, `tenantId` taken from token, not body)
- [ ] Consistent enforcement across REST, GraphQL resolvers, WebSocket handlers, gRPC, background jobs, admin panels

#### Tokens & sessions
- [ ] JWT signed with strong key, signature **always** verified
- [ ] `alg` header validated against an allowlist (reject `none`)
- [ ] Short access-token lifetime (≤ 15 min)
- [ ] Refresh-token rotation with reuse detection
- [ ] Server-side revocation list / session store
- [ ] Cookies: `HttpOnly`, `Secure`, `SameSite=Lax` or `Strict`
- [ ] Logout invalidates the session server-side
- [ ] Session ID rotated on login and privilege change

#### CORS
- [ ] No `Access-Control-Allow-Origin: *` with credentials
- [ ] Strict allowlist of trusted origins
- [ ] No reflection of arbitrary `Origin` values

#### CSRF
- [ ] State-changing requests require a CSRF token *or* are protected by SameSite cookies + custom header check
- [ ] `GET` requests are safe (no side effects)

#### Rate limiting & abuse prevention
- [ ] Sensitive endpoints throttled per IP and per user
- [ ] Account lockout / progressive delays on auth failures
- [ ] Alerts on repeated 401/403 responses

#### Files & uploads
- [ ] No direct filesystem paths exposed to clients
- [ ] All file access mediated by the backend with an ownership check
- [ ] Uploaded files stored outside the web root or behind signed URLs

#### Caching
- [ ] `Cache-Control: no-store` on authenticated, user-specific responses
- [ ] CDN configured to vary on auth/session

#### Misc
- [ ] Directory listing disabled
- [ ] Debug / admin endpoints not exposed in production
- [ ] Default credentials removed
- [ ] Audit log for privileged actions (immutable, tamper-evident)

---

## 7. SOLUTION (REFERENCE PATTERNS)

### 7.1 Minimal authorize function (Node.js)
```js
function authorize(user, action, resource) {
  if (!user) return false;                       // deny anonymous
  if (user.banned) return false;                 // global block
  if (user.role === 'admin') return true;        // privileged role
  if (action === 'read' && resource.owner_id === user.id) return true;
  if (action === 'update' && resource.owner_id === user.id) return true;
  return false;                                   // default deny
}

// At every entry point
if (!authorize(user, 'read', account)) {
  return res.status(403).send('Forbidden');
}
```

### 7.2 Policy as data (PBAC / OPA-style)
```json
{
  "action": "read_account",
  "effect": "allow",
  "condition": "resource.owner_id == user.id || 'admin' in user.roles"
}
```
Policies live in a central repo, are version-controlled, reviewed, and evaluated by a single engine.

### 7.3 Database-level enforcement (defense in depth)
Postgres Row-Level Security:
```sql
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY account_owner_select ON accounts
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY account_owner_update ON accounts
  FOR UPDATE USING (owner_id = auth.uid());
```
Even if the application layer is bypassed, the database refuses unauthorized rows.

### 7.4 Identity always from the trusted source
```js
// ❌ Wrong — trusts the client
const userId = req.body.userId;

// ✅ Right — derived from the verified token
const userId = req.auth.userId;
```

### 7.5 Object-level check before every operation
```js
const order = await db.orders.findById(req.params.id);
if (!order) return res.sendStatus(404);
if (!authorize(req.auth.user, 'read', order)) return res.sendStatus(403);
return res.json(order);
```

---

## 8. HOW TO VERIFY IT'S APPLIED

You don't *feel* secure — you **prove** it by attacking your own system.

### 8.1 Manual tests (mandatory)

**1. IDOR test**
- Log in as User A, access `/api/orders/100`.
- Replace the ID with one belonging to User B.
- ✅ Expected: `403 Forbidden` or `404 Not Found`.
- ❌ Failure: data is returned.

**2. Vertical escalation**
- Authenticate as a low-privilege user.
- Call admin endpoints (`/api/admin/users`, `/api/admin/settings`).
- ✅ Expected: `403`. ❌ Failure: success.

**3. Forced browsing**
- Discover endpoints from JS bundles, OpenAPI specs, source maps, `robots.txt`.
- Hit each one without auth.
- ✅ Expected: `401`/`403` or redirect to login.

**4. Direct API access (bypass UI)**
- Replay requests with `curl` or Postman.
- ✅ Expected: same enforcement as the UI.

**5. Token tampering**
- Decode the JWT, change `role` from `user` to `admin`, re-sign with `none` or an empty key, resend.
- ✅ Expected: rejected. ❌ Failure: accepted.

**6. Method tampering**
- If `GET /resource/:id` is allowed, try `PUT`, `DELETE`, `PATCH`.
- ✅ Expected: `405 Method Not Allowed` or `403`.

**7. Parameter pollution**
- Send duplicated parameters: `?userId=1&userId=2`.
- Verify the server picks the correct one and re-checks ownership.

**8. CORS test**
```bash
curl -H "Origin: https://evil.example" -I https://api.target.com/me
```
- ✅ Expected: no `Access-Control-Allow-Origin` for untrusted origins.

**9. CSRF test**
- Trigger a state-changing request from a different origin without a token.
- ✅ Expected: rejected.

**10. Session lifecycle**
- Logout, then replay a previously valid request with the old token/cookie.
- ✅ Expected: `401`.

### 8.2 Automated testing

| Tool category | Examples | What it catches |
|------|------|------|
| **SAST** | Semgrep, CodeQL, SonarQube | Missing auth checks in source code |
| **DAST** | OWASP ZAP, Burp Suite | Live IDOR, forced browsing, CORS issues |
| **IAST** | Contrast, Seeker | Runtime authorization gaps |
| **API fuzzers** | Schemathesis, RESTler | Spec-driven endpoint enumeration |
| **Auth-specific** | Burp Autorize, AuthMatrix | Compares responses across user roles |

### 8.3 Unit & integration tests
For every protected operation, write tests that assert:
```
- anonymous → 401
- authenticated non-owner → 403
- owner → 200
- admin → 200
- banned user → 403
- expired token → 401
- tampered token → 401
```
If any case is missing, your test suite is incomplete.

### 8.4 Continuous verification
- Add authorization tests to CI; fail the build on regression.
- Track coverage: *% of endpoints with at least one negative-auth test*.
- Run DAST scans on every deploy to staging.
- Periodic red-team / pentest engagements.

### 8.5 Logging & monitoring
- Log every `401` and `403` with user, endpoint, IP, timestamp.
- Alert on:
  - Bursts of `403` from a single user (enumeration)
  - Bursts from a single IP across many users (credential stuffing aftermath)
  - First-ever access to admin endpoints by a non-admin
- Audit log for privileged actions stored append-only (e.g. WORM bucket, signed log chain).

### 8.6 Metrics that matter
- % of endpoints covered by an authorization policy
- % of endpoints with negative-auth unit tests
- Mean time to detect / fix an access-control bug
- Number of IDOR findings per release
- Open vs closed access-control vulnerabilities over time

---

## 9. ANTI-PATTERNS — STOP DOING THESE

- ❌ "The frontend hides the button, so it's safe."
- ❌ "Our IDs are random UUIDs, so IDOR is impossible."
- ❌ "JWT is secure by default."
- ❌ "Only admins know this URL."
- ❌ "We trust internal services, so no auth needed between them."
- ❌ "We'll add authorization later."
- ❌ Storing roles or permissions in the client (localStorage, cookies, JWT claims) **without** server-side verification.
- ❌ Using `Access-Control-Allow-Origin: *` with credentials.
- ❌ Treating `referer` or `origin` headers as authentication.
- ❌ Single shared admin account with no individual accountability.

---

## 10. REAL-WORLD FAILURE MODES

- **Sequential ID swap** → user enumerates `/invoices/{id}` and downloads everyone's invoices.
- **Exposed admin endpoint** → `/api/v1/internal/users/delete` reachable from the internet without auth.
- **JWT `alg: none`** → attacker forges any identity.
- **Mass-assignment** → `PATCH /users/me` with `{"role": "admin"}` updates the role column.
- **Path traversal in file API** → `?file=../../../../etc/passwd`.
- **Open CORS** → malicious site reads the victim's authenticated API responses.
- **Cache leak** → CDN caches `/me` for one user and serves it to another.
- **Subdomain takeover** → forgotten DNS record allows attacker to host on `*.yourdomain.com` and steal cookies.
- **Privilege retention after demotion** → role removed but active sessions still carry old claims.

---

## 11. STANDARDS, FRAMEWORKS & FURTHER READING

- **OWASP Top 10:2021 — A01** — https://owasp.org/Top10/A01_2021-Broken_Access_Control/
- **OWASP ASVS v4** — Chapter V4 (Access Control)
- **OWASP API Security Top 10 (2023)** — API1 (BOLA), API3 (BOPLA), API5 (BFLA)
- **OWASP Cheat Sheets** — Authorization, Access Control, REST Security, JWT, CORS
- **NIST SP 800-162** — Guide to Attribute Based Access Control
- **NIST SP 800-53** — AC family (Access Control)
- **CWE-284** — Improper Access Control (root weakness)
- **MITRE ATT&CK** — TA0004 (Privilege Escalation), TA0008 (Lateral Movement)

---

## 12. ONE-PARAGRAPH SUMMARY

Broken Access Control is the failure to consistently enforce *who can do what to which resource*. Fix it by **denying by default**, **centralizing authorization**, **enforcing on the server**, **modeling ownership explicitly**, and **re-validating every request**. Verify it by **attacking your own system** — IDOR tests, role escalation, token tampering, automated DAST, and unit tests for every negative case — and by **monitoring** denials in production. Anything less is a guess.
