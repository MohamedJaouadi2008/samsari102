# OWASP A09:2025 — Security Logging & Alerting Failures (Operator-Level Blueprint)

## 1. What It Really Is
Not about logs. About this: **Can you detect an attack while it's happening — and act on it?**
If not → you're blind.

## 2. Core Truth
Security isn't just prevention.
- You **WILL** be attacked
- You **WILL** have failures

If you can't detect them → attacker operates freely inside your system.

## 3. The Real Problem
Most teams think:
- "We log errors"
- "We have console logs"
- "We can check logs if needed"

That's **not security logging**. That's post-mortem debugging at best.

## 4. What Actually Breaks

### 🔴 1. No Logging of Critical Events
Missing logs for: login attempts (especially failures), access control violations, sensitive operations.
👉 Attacker brute-forces → you see nothing.

### 🔴 2. No Alerting
Logs without alerting = **dead data**. No one is watching.

### 🔴 3. Log Tampering (CWE-117 / CWE-778)
Attacker deletes or injects fake entries → you trust corrupted evidence.

### 🔴 4. Sensitive Data in Logs (CWE-532)
Logging passwords, tokens, PII → logs become a goldmine.

### 🔴 5. No Monitoring
Logs exist but: not analyzed, not correlated, not reviewed.

### 🔴 6. Too Many Alerts (Noise)
SOC gets thousands of useless alerts → real attack ignored.

### 🔴 7. No Incident Response
Even if alert fires → no action plan.

### 🔴 8. Local Log Storage Only
Stored on same server → attacker deletes everything.

### 🔴 9. No Integrity Protection
Logs can be modified or deleted → forensic analysis useless.

## 5. CWE Breakdown
- **CWE-778** → not logging enough
- **CWE-532** → logging too much (sensitive data)
- **CWE-117** → logs can be injected/manipulated
- **CWE-223** → missing critical security data

⚠️ **Contradiction to solve**: log enough → but not sensitive data.

## 6. Real Attack Pattern
1. Attacker probes system
2. Brute force / injection attempts
3. Gains access
4. Escalates privileges
5. Exfiltrates data

Without logging → you see **NONE** of it.

## 7. Real Incidents
- **Health provider breach** → no logging/monitoring → breach lasted 7 years
- **Airline breach** → third-party compromise → delayed detection → millions leaked
- **Payment breach** → no alerting → fines + reputation damage

## 8. How to Fix (Real System)

### 🔴 1. Log Everything Security-Relevant
- Login success + failure
- Access control decisions
- Input validation failures
- Privilege changes
- Sensitive transactions

### 🔴 2. Centralized Logging
Never store logs locally only. Use centralized + remote storage.

### 🔴 3. Log Integrity
Append-only, signed logs, tamper detection.

### 🔴 4. Real-Time Monitoring
Logs must be **actively analyzed**, not stored for later.

### 🔴 5. Alerting System
Triggers: multiple failed logins, abnormal activity, privilege escalation, unusual traffic.

### 🔴 6. Alert Quality
Avoid noise. Focus on **high-signal alerts**.

### 🔴 7. Incident Response Playbook
Who acts? What action? How fast? If unknown → not ready.

### 🔴 8. Remove Sensitive Data From Logs
Never log: passwords, tokens, full PII.

### 🔴 9. Fail Closed
If error occurs → deny action + log it.

### 🔴 10. Honeytokens (Advanced)
Plant fake credentials/records → if accessed = guaranteed attacker.

## 9. Implementation Patterns

### Log Format (Structured)
```json
{
  "event": "login_failed",
  "user": "id123",
  "ip": "x.x.x.x",
  "timestamp": "..."
}
```

### Alert Flow
`event → log → detection rule → alert → response`

### Security Events Pipeline
`app → log collector → SIEM → alert system`

## 10. How to Verify
- **Attack simulation**: brute force, injection → no alert = failure
- **Log tampering test**: try delete/modify → if possible = critical failure
- **Alert latency**: time from attack → alert. Slow = useless
- **Data leak test**: scan logs for sensitive data
- **Coverage test**: all critical actions logged

## 11. Common Delusions
- ❌ "We'll check logs if something happens"
- ❌ "We have logs, so we're safe"
- ❌ "Monitoring is optional"
- ❌ "Security team will handle it"
- ❌ "No one targets us"

## 12. Reality
Most breaches are not stopped. They are **detected too late** — or never detected.

## 13. Metrics
- **MTTD** — Mean time to detect
- **MTTR** — Mean time to respond
- % of events logged
- False positive rate

## 14. Maturity Model
- **Level 1** — no logs
- **Level 2** — basic logs
- **Level 3** — centralized logging
- **Level 4** — alerting + monitoring
- **Level 5** — automated response + detection engineering

## 15. Final Truth
Security without visibility is **illusion**.
You don't have security. You have hope.

## 16. Execution Plan
- [ ] Log all security-critical events
- [ ] Centralize logs
- [ ] Implement real-time alerting
- [ ] Define incident response playbooks
- [ ] Remove sensitive data from logs
- [ ] Test detection with simulated attacks
