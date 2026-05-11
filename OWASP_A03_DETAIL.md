# OWASP A03:2025 — Software Supply Chain Failures (Full System Blueprint)

> You're not building software. You're assembling code, tools, dependencies, and pipelines. If you don't control the chain, you don't control the system.

---

## 1. WHAT IT REALLY IS (NO FLUFF)

This is not about "dependencies."

This is about **losing control of what runs in your system**.

If you cannot prove what code is running, where it came from, and who approved it → you are vulnerable.

---

## 2. EXPANDED DEFINITION

**Software Supply Chain Failures** = Any compromise in build, dependency, tooling, or delivery pipeline that allows:

- vulnerable code
- malicious code
- unverified code

…to enter production.

---

## 3. WHY THIS IS #1 IN THE SURVEY (AND YOU SHOULD CARE)

Because:

- developers import more than they write
- attacks scale through ecosystems
- one breach → thousands of apps compromised

**Real-world reality:**

- **SolarWinds hack** → ~18,000 organizations hit
- **Bybit theft** → $1.5B lost
- **Shai-Hulud npm worm** → self-propagating malware stealing tokens

You're not the target. **Your dependencies are.**

---

## 4. CORE SYSTEM MODEL

Your supply chain:

```
Developer → Code → Dependencies → Build → CI/CD → Artifacts → Deployment
```

If any node is weak → full compromise.

---

## 5. RISK CONDITIONS — TRANSLATED INTO REALITY

### 🔴 Visibility Failure
- You don't know all dependencies (including transitive)
- No SBOM

👉 Meaning: you don't know what you're running.

### 🔴 Version Chaos
- Untracked versions
- Outdated libraries
- Unmaintained components

👉 Meaning: you're running known vulnerabilities.

### 🔴 No Monitoring
- No CVE tracking
- No alerts

👉 Meaning: vulnerabilities sit silently for months.

### 🔴 No Change Control
- No tracking of CI/CD changes, repo changes, build configs

👉 Meaning: attackers can modify pipeline unnoticed.

### 🔴 No Separation of Duties
One dev can write code, approve, and deploy.

👉 That's not a system. That's blind trust.

### 🔴 Untrusted Sources
- Random GitHub repos
- Public packages without validation

👉 Equivalent to running unknown code from strangers.

### 🔴 Patch Delays
- Monthly updates
- Slow patching

👉 Attackers exploit in hours; you patch in weeks.

### 🔴 Weak Pipeline Security
- CI/CD less secure than production

👉 Attacker doesn't attack prod — they attack the build.

---

## 6. MAPPED CWEs — TECHNICAL TRANSLATION

| CWE | Meaning |
|---|---|
| CWE-1104 | Use of unmaintained third-party components |
| CWE-1395 | Dependency on vulnerable third-party component |
| CWE-1329 | Reliance on component that is not updatable |
| CWE-477 | Use of obsolete functions |
| CWE-1357 | Reliance on insufficiently trustworthy component |

**Translation:** You depend on code you cannot fix or trust.

---

## 7. HOW TO FIX — REAL OPERATIONAL SYSTEM

### 🔴 7.1 SBOM (Non-Negotiable)
Full dependency tree, including transitive. If you can't generate this instantly → you're guessing.

### 🔴 7.2 Dependency Governance
- Pin versions (no blind auto-updates)
- Remove unused dependencies
- Evaluate before adding

### 🔴 7.3 Continuous Vulnerability Monitoring
Track CVE, NVD, OSV — automated, not manual.

### 🔴 7.4 Trust Control
Only allow official sources and signed packages. No exceptions.

### 🔴 7.5 Patch Management System
Not "we update sometimes." You need:
- Risk-based prioritization
- Deadlines
- Tracking

### 🔴 7.6 CI/CD Hardening (Critical)
Pipeline must be **more** secure than production:
- MFA
- Access control
- Environment isolation
- Secrets scoped per environment
- Tamper-evident logs

### 🔴 7.7 Separation of Duties
No single person should write → approve → deploy. Code review + approval gates required.

### 🔴 7.8 Artifact Security
- Signed builds
- Immutable artifacts
- Promote artifacts across envs — don't rebuild per env

### 🔴 7.9 Toolchain Security
Secure IDEs, extensions, and dev machines. Attackers now target developers directly.

### 🔴 7.10 Change Control Everywhere
Track changes to repos, pipelines, configs, dependencies, infrastructure. If it changes → it must be logged.

---

## 8. IMPLEMENTATION MODEL — REAL PIPELINE

```
Code
  → Dependency Scan
  → Build
  → Artifact Scan
  → Sign
  → Store (immutable)
  → Deploy (controlled)
```

---

## 9. HOW TO VERIFY — STOP GUESSING

### 🔴 SBOM Check
- Complete? Includes transitive deps?

### 🔴 Dependency Audit
- Outdated? Unmaintained? Vulnerable?

### 🔴 Pipeline Attack Test
- Try injecting a malicious package
- Try modifying build output
- If it passes → you're exposed

### 🔴 Artifact Verification
- Verify signature
- Verify hash

### 🔴 Change Tracking Test
- Modify pipeline config. If no alert → failure.

### 🔴 Dev Machine Test
- Simulate a compromised npm token. If attacker can publish → system compromised.

---

## 10. REAL ATTACK SCENARIOS

**Scenario 1 — Vendor compromise**
SolarWinds: signed vendor update = malware.

**Scenario 2 — Conditional malicious behavior**
Bybit theft: payload triggers only under specific conditions.

**Scenario 3 — Self-propagating worm**
Shai-Hulud npm worm: spreads automatically, steals tokens, infects packages.

**Scenario 4 — Vulnerable component exploitation**
Log4Shell, Apache Struts RCE → full remote code execution.

---

## 11. COMMON DELUSIONS — CUT THIS OUT

- ❌ "It's open source so it's safe"
- ❌ "We trust npm/pip"
- ❌ "CI/CD is internal"
- ❌ "We'll patch later"
- ❌ "No one targets us"

**Reality:** attackers scale through ecosystems, not individuals.

---

## 12. METRICS — IF YOU DON'T TRACK, YOU'RE LOST

- % dependencies tracked (SBOM coverage)
- # vulnerable dependencies
- Patch time (MTTR)
- % signed artifacts
- Pipeline integrity violations

---

## 13. MATURITY MODEL

| Level | State |
|---|---|
| 1 | Random dependencies, no tracking |
| 2 | Basic audits |
| 3 | SBOM + scanning |
| 4 | Signed artifacts + hardened CI/CD |
| 5 | Zero-trust supply chain, continuous validation |

---

## 14. FINAL TRUTH

You're not building software. You're **assembling**:
- code
- tools
- dependencies
- pipelines

If you don't control the chain → you don't control the system.

---

## 15. EXECUTION PLAN — DO THIS, NOT THEORY

- [ ] Generate SBOM now
- [ ] Audit all dependencies
- [ ] Add SCA to CI/CD
- [ ] Lock dependency sources
- [ ] Harden CI/CD pipeline
- [ ] Implement artifact signing
- [ ] Enforce separation of duties
