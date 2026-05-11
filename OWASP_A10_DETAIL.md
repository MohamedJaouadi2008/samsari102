# OWASP A10:2025 — Mishandling of Exceptional Conditions (Operator-Level Blueprint)

## 1. What It Really Is
Not "bugs". This is: **what happens when your system leaves the expected path**.
Uncomfortable truth: your system spends more time in edge cases than you think.

## 2. Core Failure Model
Every failure falls into one of these:
1. You didn't prevent it
2. You didn't detect it
3. You handled it badly

Most systems fail in **all three**.

## 3. The Real Problem
You design for: normal inputs, normal flows, happy paths.
Attackers operate in: invalid states, partial failures, inconsistent systems.

## 4. Critical Failure Types

### 🔴 1. Failing Open (CWE-636)
System error → access **granted** instead of denied. Catastrophic.

### 🔴 2. Error Message Leaks (CWE-209 / CWE-550)
Exposes stack traces, DB queries, internal paths → attacker uses for precision attacks.

### 🔴 3. Uncaught Exceptions (CWE-248)
App crashes → undefined state → unpredictable behavior = exploit surface.

### 🔴 4. Partial Transactions (State Corruption)
Debit → crash → no rollback → money disappears or duplicates.

### 🔴 5. Resource Leaks
Error → resources not released → repeat → exhaustion → DoS.

### 🔴 6. Invalid Input Handling Failure (CWE-234 / 235)
Missing or extra parameters → unpredictable behavior.

### 🔴 7. Silent Failures (CWE-390 / 391)
Error detected → no action taken → system continues broken.

### 🔴 8. Generic Exception Handling (CWE-396)
`catch (Exception e)` → hides real issue, prevents correct handling.

### 🔴 9. Null Pointer / Runtime Failures (CWE-476)
Unhandled null → crash or logic bypass.

## 5. Root Cause (Brutal Truth)
You assume things will work. Instead, design for: **things will break constantly**.

## 6. Attack Strategy
Attackers:
- Trigger errors intentionally
- Observe behavior
- Exploit inconsistent state

They don't break your system. They let you break it yourself.

## 7. Real Attack Scenarios
- **Resource exhaustion** → upload triggers exception, resources not freed → repeat = crash.
- **Error leakage** → force DB errors → extract schema → build precise injection.
- **Transaction manipulation** → interrupt mid-operation → inconsistent financial state.

## 8. How to Fix (Real System Design)

### 🔴 1. Fail Closed (Mandatory)
On any error: deny action + rollback everything. Never continue partially.

### 🔴 2. Localized Error Handling
Handle errors **where they occur**, not just globally.

### 🔴 3. Global Exception Handler
Catch anything missed: log + alert + safe response.

### 🔴 4. Transaction Safety
All critical operations: atomic, rollback on failure.

### 🔴 5. Input Validation (Strict)
Reject missing or unexpected params.

### 🔴 6. Resource Management
Always: allocate → use → release. Even on failure.

### 🔴 7. Safe Error Responses
User sees generic message. System logs detailed error.

### 🔴 8. Rate Limiting / Throttling
Prevent resource exhaustion + repeated error abuse.

### 🔴 9. Centralized Error Handling Policy
One standard across system. Same behavior everywhere.

### 🔴 10. Monitoring + Alerting (A09 Link)
Repeated errors → trigger alerts.

## 9. Implementation Patterns

### Safe Flow
```
input → validate → process → commit
         ↓ error
     rollback + log + alert
```

### Bad Flow
```
input → process → error → continue anyway
```

### Transaction Model
```
BEGIN
→ operation
→ operation
IF error → ROLLBACK
ELSE → COMMIT
```

## 10. How to Verify
- **Error forcing**: invalid input, missing params → if system breaks = failure
- **Transaction test**: interrupt mid-operation → if inconsistent = critical failure
- **Resource test**: trigger repeated errors → if slows/crashes = failure
- **Error message test**: if internal details exposed = failure
- **Fail-open test**: force error during auth → if access granted = catastrophic

## 11. Common Delusions
- ❌ "This error won't happen"
- ❌ "We'll fix it later"
- ❌ "Edge cases are rare"
- ❌ "The framework handles it"
- ❌ "Crashes are harmless"

## 12. Reality
Edge cases are **where attackers live**.

## 13. Metrics
- Error rate
- Unhandled exceptions
- Rollback success rate
- System recovery time

## 14. Maturity Model
- **Level 1** — crashes everywhere
- **Level 2** — partial error handling
- **Level 3** — structured handling
- **Level 4** — fail-safe architecture
- **Level 5** — resilient, self-healing systems

## 15. Final Truth
Your system is not defined by how it works. It's defined by **how it behaves when things go wrong**.

## 16. Execution Plan
- [ ] Enforce fail-closed logic everywhere
- [ ] Implement transaction rollback
- [ ] Audit all error handling paths
- [ ] Remove sensitive error messages
- [ ] Add centralized exception handling
- [ ] Stress test edge cases
