# OWASP A06:2025 — Insecure Design (Operator-Level Blueprint)

> Reference blueprint. Companion to `OWASP_A01..A05_DETAIL.md`.

---

## 1. What It Really Is

Insecure Design is **not a coding mistake**. It is the absence of security
thinking *before* code is written.

> If a control was never designed in, no patch can add it later — the system
> must be re-architected.

---

## 2. Critical Distinction

| Insecure Implementation | Insecure Design |
|-------------------------|-----------------|
| Bug in code | Missing control entirely |
| Patchable | Requires redesign |
| Found by SAST/DAST | Found by threat modeling |
| Example: SQL string concat | Example: no rate limit on booking |

---

## 3. Root Causes

Teams skip:
- Threat modeling
- Abuse-case definition
- Business-logic security
- Failure-state design

…and jump straight to coding.

---

## 4. Core System Thinking

A secure system must explicitly define **four** behavior classes:

1. **Expected** — happy path
2. **Allowed** — legitimate edge cases
3. **Forbidden** — explicitly blocked
4. **Failure** — what happens when something breaks

Attackers live in #3 and #4.

---

## 5. Where Insecure Design Lives

- Business logic
- Workflows / state machines
- Trust boundaries
- Implicit assumptions

### Anti-pattern catalog

| Pattern | Example | Why it fails |
|---|---|---|
| Broken identity flow | Security questions for reset | Answers are guessable |
| Business-logic abuse | Unlimited bookings/holds | Inventory exhaustion |
| No anti-automation | No bot/rate controls | Scalping, scraping |
| Trust boundary failure (CWE-501) | "Frontend validated it" | Client is hostile |
| Undefined failure state | "What if payment half-fails?" | Money/inventory drift |

---

## 6. Key CWE Mapping

| CWE | Meaning | Design failure |
|---|---|---|
| CWE-269 | Improper privilege management | No least-privilege model |
| CWE-522 | Insufficiently protected credentials | No credential lifecycle |
| CWE-434 | Unrestricted file upload | No upload trust model |
| CWE-256 | Plaintext storage of secrets | No secret-management design |
| CWE-362 | Race condition | No concurrency model |
| CWE-501 | Trust boundary violation | Client-server trust mixed |
| CWE-840 | Business logic errors | No abuse-case analysis |

---

## 7. How to Fix (Design-Phase Controls)

### 7.1 Requirements Phase
- Classify data sensitivity (public / internal / restricted / regulated).
- Define **who** can access **what** under **which** condition.
- Define what **misuse** looks like for each feature.

### 7.2 Threat Modeling (mandatory)
Use STRIDE or LINDDUN. For every feature, ask:
- How can this be abused?
- What if the user is malicious?
- What if automation is used?
- What if a limit is bypassed?
- What if two requests race?

### 7.3 Abuse Cases (paired with use cases)

| Use case | Abuse case |
|---|---|
| User books a property | User books many properties to lock inventory |
| Host uploads photos | Host uploads malware / oversize / zip-bomb |
| Guest sends message | Guest spams or harvests emails |
| Guest cancels booking | Guest cancels post-checkout to dodge charges |

### 7.4 Design Security Controls *Before* Coding
- Rate limits (per-user, per-IP, per-action)
- Access rules (RLS, role checks, ownership checks)
- Validation flows (server-side schemas)
- Idempotency keys for money operations
- Explicit failure handling

### 7.5 Define Failure States
For every external dependency, document:
- Timeout behavior
- Partial-success behavior
- Retry / idempotency policy
- User-facing recovery path

### 7.6 Segment the System
- Frontend ≠ backend trust
- Service / tenant isolation
- Read vs write keys
- Public vs admin surfaces

### 7.7 Secure Design Patterns
- **Least privilege** — default deny, grant explicitly
- **Defense in depth** — never rely on a single layer
- **Zero trust** — every request re-authenticated/authorized
- **Fail secure** — errors deny, never grant
- **Separation of duties** — no single role completes a sensitive flow alone

### 7.8 Secure SDLC
Security must exist in **every** phase:
`Design → Build → Test → Deploy → Maintain → Decommission`

---

## 8. Implementation Patterns

### User story with security baked in
```
As a guest, I can book a property
- Authenticated + email-verified
- Cannot book own property
- Cannot book overlapping dates (DB-enforced)
- Cannot exceed N concurrent pending bookings
- All state transitions audited
- Idempotent on payment intent
```

### Threat model artifact (per feature)
- Diagram (data flow + trust boundaries)
- Asset list
- Threats (STRIDE)
- Mitigations (linked to code/policy)
- Residual risk + owner

### Misuse testing
- Abuse scenarios as automated tests
- Race-condition harness
- Invalid-state harness (e.g. force booking from `settled` → `pending`)

---

## 9. How to Verify

| Activity | Pass condition |
|---|---|
| Design review | Each feature lists controls + considered attacks |
| Abuse testing | Abuse cases produce safe failures, not exploits |
| Business-logic testing | Workflows cannot be chained/skipped/replayed |
| Threat-model validation | Threats documented + mitigations implemented + tested |

---

## 10. Common Delusions

- "We'll secure it later"
- "Code review is enough"
- "The framework handles it"
- "Users won't abuse this"
- "This edge case won't happen"
- "Only admins reach this endpoint"

Attackers exploit **assumptions**, not code.

---

## 11. Metrics

- # of threat models created (per feature shipped)
- % features with documented abuse cases
- # logic flaws found in review vs production
- % security requirements with test coverage
- Mean time from design → threat-model sign-off

---

## 12. Maturity Model

| Level | State |
|---|---|
| 1 | No design security |
| 2 | Basic awareness, ad-hoc reviews |
| 3 | Threat modeling per major feature |
| 4 | Secure design patterns + SDLC enforced |
| 5 | Security-driven architecture, continuous abuse testing |

---

## 13. Final Truth

A01–A05 are **symptoms**. A06 is the **cause**.

- Weak design → access control fails (A01)
- Weak design → misconfiguration (A05/A02)
- Weak design → injection surfaces survive (A03)
- Weak design → crypto is misused (A02/A04)

Fix the design, and the rest becomes maintainable.

---

## 14. Execution Plan

1. Inventory every feature; mark which has a threat model.
2. For each unmodeled feature, write: assets, abuse cases, controls, failure states.
3. Add abuse-case tests to CI.
4. Add a "Design Review" gate in the SDLC before any feature touching auth, money, or PII.
5. Re-audit quarterly; track unmitigated threats as risk debt.

> **Next step:** say *"apply to Samsari"* to produce `OWASP_A06_SAMSARI_MAPPING.md`.
