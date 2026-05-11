# OWASP A08:2025 — Software or Data Integrity Failures

> Operator-level blueprint. Date: 2026-04-20

---

## 1. What It Really Is

**Your system accepts data or code as trustworthy without proving it.**

Covers:
- Software updates
- Serialized data
- External scripts
- Internal artifacts
- Client-side state (cookies, tokens, JWTs)
- CI/CD pipeline outputs

---

## 2. Core Principle

**TRUST = VERIFICATION.**

If you do not verify, you are trusting attacker-controlled input.

---

## 3. A08 vs A03

| Axis | A03 (Supply Chain) | A08 (Integrity) |
|---|---|---|
| Question | Where did the code come from? | Did we verify what we received? |
| Failure | Pulling from a malicious source | Accepting anything without a check |
| Example | Typosquatted npm package | Installing an unsigned update |

You can have a trusted source AND still be compromised if integrity isn't checked.

---

## 4. Root Failure Pattern

You assume:
- "This came from us → safe"
- "This looks valid → safe"
- "This is internal → safe"

Attackers exploit the **lack of verification**.

---

## 5. Primary Failure Areas

### 🔴 1. Unsigned / Unverified Updates
Download → execute. No signature check = remote code execution by design.

### 🔴 2. Untrusted External Code
- CDN scripts
- Third-party plugins
- External widgets/services

You're executing code you don't control.

### 🔴 3. Insecure Deserialization (CWE-502)
Accept serialized object → deserialize → execute logic.
Attacker controls payload → controls system behavior.

### 🔴 4. CI/CD Integrity Failure
Pipeline pulls artifacts → builds → deploys without signature/integrity checks.
Attacker injects malicious step → owns production.

### 🔴 5. Trust Boundary Collapse (CWE-829, CWE-830)
External domain shares cookies/sessions → trust extended without control.

### 🔴 6. Data Tampering
Cookies, tokens, serialized state not validated → attacker modifies them freely.

---

## 6. CWE Breakdown

| CWE | Meaning |
|---|---|
| CWE-345 | Insufficient verification of data authenticity |
| CWE-494 | Download of code without integrity check |
| CWE-502 | Deserialization of untrusted data |
| CWE-829 | Inclusion of functionality from untrusted control sphere |
| CWE-830 | Inclusion of web functionality from untrusted source |
| CWE-915 | Improperly controlled modification of object attributes |

All point to one thing: **trusting data blindly.**

---

## 7. Real Attack Scenarios

### Scenario 1 — External Service Hijack
Support widget on `support.company.com` shares cookies with main domain → session hijack.

### Scenario 2 — Unsigned Firmware/Update
Download → install with no verification → attacker swaps payload → full compromise.

### Scenario 3 — Untrusted Package
Dev grabs library outside the registry, no signature → malicious code in build.

### Scenario 4 — Deserialization Attack
Serialized user state round-trips client → server → attacker mutates payload → RCE.

### Scenario 5 — Cookie/JWT Tampering
Unsigned cookie or `alg: none` JWT accepted → role escalation.

---

## 8. How to Fix

### 1. Digital Signatures (Non-negotiable)
Verify software updates, artifacts, packages. Unsigned → don't run.

### 2. Integrity Checks
SHA-256+ hashes and signature validation **before** execute / load / deploy.
For external scripts in browsers: **Subresource Integrity (SRI)**.

### 3. Trusted Sources Only
Official registries and internal vetted mirrors. No random downloads, no unknown CDNs.

### 4. Secure CI/CD Pipeline
Verify inputs, sign outputs, enforce access control, immutable artifacts.

### 5. Safe Deserialization
Best: don't deserialize untrusted data.
If required: strict schema (zod), allowlist types only, never `eval` or dynamic `Function()`.

### 6. Protect Cookies / Client Data
Sign cookies and tokens (JWT with strong alg + verified signature). Never trust client-side state for authorization.

### 7. Isolate Trust Boundaries
Separate domains, scope cookies tightly, no shared sensitive context.

### 8. Review Process
Code review + config review on every change. No direct injection into production.

---

## 9. Implementation Patterns

**Signed update flow:**
```
download → verify signature → install
```

**Cookie/token protection:**
```
value = data + signature
modified → reject
```

**Safe data handling:**
```
input → validate (schema) → process
```
Never `input → trust → execute`.

---

## 10. How to Verify

| Test | Pass Criteria |
|---|---|
| Modify build artifact | Deploy rejects it |
| Replace update file | Installer refuses |
| Send crafted serialized payload | Server rejects, no execution |
| Tamper cookie/JWT | Server invalidates session |
| Inject malicious CI step | Pipeline blocks unsigned commit |
| Modify external CDN script | SRI check fails, browser blocks |

---

## 11. Common Delusions

- ❌ "It's internal, so safe"
- ❌ "It comes from our system"
- ❌ "Users won't tamper with this"
- ❌ "We trust this CDN"
- ❌ "Serialization is safe"

---

## 12. Real Impact

- Remote code execution
- Full system compromise
- Mass malware distribution
- Persistent backdoors

---

## 13. Metrics

- % signed artifacts
- Integrity verification coverage
- Deserialization surface (count and source)
- Pipeline validation checks
- SRI coverage on third-party scripts

---

## 14. Maturity Model

| Level | State |
|---|---|
| 1 | Blind trust everywhere |
| 2 | Basic hashing |
| 3 | Signature verification |
| 4 | Secure CI/CD + artifact signing |
| 5 | Zero-trust integrity model |

---

## 15. Final Truth

You don't get hacked because of what you wrote.
You get hacked because of **what you accepted without checking.**

---

## 16. Execution Plan

- Enforce signature verification
- Audit all update mechanisms
- Remove unsafe deserialization
- Secure CI/CD pipeline
- Validate all client-side data
- Isolate trust boundaries
