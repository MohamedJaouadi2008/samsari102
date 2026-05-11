# OWASP A02: Security Misconfiguration — Enterprise Deep Dive

> A complete operator-level blueprint. No textbook fluff. This is what actually breaks in production and how to stop it.

---

## 1. WHAT IT REALLY IS

Security Misconfiguration is **not one bug**. It is what happens when:

> **Your system behaves differently than you think it does.**

Because:

- defaults are unsafe
- environments drift
- settings are inconsistent
- exposure is accidental
- nobody owns the full configuration surface

It is the gap between **intended state** and **actual state** of every layer of your stack.

### Formal definition

A system is **misconfigured** when:

```
ACTUAL_CONFIG(system)  ≠  INTENDED_CONFIG(system)
```

…and the delta exposes behavior, data, or capability that was never authorized.

---

## 2. CORE CONCEPT — THE FOUNDATION

Your system is not "an app." It is **layers**, and every layer has configuration:

```
┌─────────────────────────────────┐
│  Application Code               │  ← feature flags, DEBUG, error handling
├─────────────────────────────────┤
│  Framework / Libraries          │  ← default routes, sample apps, admin UIs
├─────────────────────────────────┤
│  Runtime (Node/Deno/Python...)  │  ← env vars, module resolution, TLS
├─────────────────────────────────┤
│  Operating System               │  ← users, file perms, services
├─────────────────────────────────┤
│  Network                        │  ← ports, firewall, CORS, headers
├─────────────────────────────────┤
│  Cloud / Infra                  │  ← IAM, buckets, secrets, regions
└─────────────────────────────────┘
```

**Misconfiguration = any layer exposing more than intended.**

A perfectly written app on a misconfigured bucket leaks millions of records. Your code is irrelevant if the S3 bucket is public.

---

## 3. ROOT PROBLEM — WHY YOU WILL MESS THIS UP

Be direct with yourself. Most teams:

- don't know **all** their configs
- don't control them **centrally**
- don't validate them **continuously**
- don't track **drift** between environments
- treat staging as "not important"

Result: your system slowly becomes **"whatever works" → production**.

Misconfiguration is not a coding failure. It is a **governance failure**.

---

## 4. ATTACK SURFACE — WHERE YOU'RE LEAKING

Thinking only about code is naive. Real-world exposure points:

| Surface | Example exposure |
|---|---|
| Debug endpoints | `/debug`, `/__debug__`, framework consoles (Django, Flask, Werkzeug, Spring Actuator) |
| Admin panels | `/admin`, `/phpmyadmin`, `/wp-admin` left public |
| Default credentials | `admin/admin`, vendor shipped accounts |
| Open ports | Redis 6379, Mongo 27017, Elastic 9200 bound to `0.0.0.0` |
| Cloud storage | Public S3 / GCS / R2 buckets with `ListBucket` |
| CORS | `Access-Control-Allow-Origin: *` with credentials |
| Verbose errors | Stack traces, SQL errors, file paths returned to client |
| Old services | Legacy subdomains, forgotten staging boxes, abandoned APIs |
| Unpatched software | Known CVEs in web server, framework, OS |
| Directory listing | `/uploads/`, `/backup/` browsable |
| Exposed VCS/config | `/.git/config`, `/.env`, `/config.yml` |
| Missing headers | No HSTS, no CSP, no X-Frame-Options |
| Source maps | `.js.map` in production leaking source |

**Attackers scan for all of these automatically, 24/7.** They don't need to be smart — they need to be patient and have a bot.

---

## 5. HOW TO FIX — REAL TASKS, NOT THEORY

### 🔴 5.1 Environment Hardening

**Kill defaults.**

- Remove default passwords on every service
- Disable every service you don't use
- Close every port you don't need

**Disable debug everywhere in production.**

- `DEBUG = false`
- No stack traces returned to client
- No internal paths, hostnames, or query text leaked

**Generic error handling.**

❌ Bad:
```
SQL error: column "user_password" does not exist in table "users"
  at /app/src/db/queries.ts:142
```

✔️ Good:
```
Something went wrong. Reference ID: 7f3a-91c2
```

Log the real error server-side with the reference ID. Return nothing useful to the attacker.

---

### 🔴 5.2 Server Configuration

- Disable directory listing (`Options -Indexes` on Apache, `autoindex off` on nginx)
- Remove backup files: `.zip`, `.bak`, `.old`, `.swp`, `~`, `.orig`
- Block access to:
  - `.git/`
  - `.env`, `.env.*`
  - `config/`, `*.yml`, `*.ini`
  - `node_modules/`
  - Source maps in production

```nginx
# nginx example
location ~ /\.(git|env|ht|svn) { deny all; return 404; }
location ~ \.(bak|old|orig|swp|sql)$ { deny all; return 404; }
```

---

### 🔴 5.3 Security Headers

You're probably ignoring these. That's a mistake.

| Header | Purpose | Safe value |
|---|---|---|
| `Strict-Transport-Security` | Force HTTPS | `max-age=31536000; includeSubDomains; preload` |
| `X-Content-Type-Options` | Stop MIME sniffing | `nosniff` |
| `X-Frame-Options` | Stop clickjacking | `DENY` or `SAMEORIGIN` |
| `Content-Security-Policy` | Control script/style/image origins | Strict, per-app policy |
| `Referrer-Policy` | Limit referrer leak | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Disable unused browser APIs | `camera=(), microphone=(), geolocation=(self)` |
| `Cross-Origin-Opener-Policy` | Isolate browsing context | `same-origin` |
| `Cross-Origin-Resource-Policy` | Restrict cross-origin loads | `same-origin` or `same-site` |

**Verify with `curl -I https://yoursite.com`.** If these are missing, you're failing.

---

### 🔴 5.4 CORS Configuration

❌ Never:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
```
(This combination is actually rejected by browsers, but many servers try it and misbehave. More importantly, `*` is almost always wrong for APIs.)

✔️ Instead:
```
Access-Control-Allow-Origin: https://app.yourdomain.com
Access-Control-Allow-Methods: GET, POST
Access-Control-Allow-Headers: authorization, content-type
Access-Control-Allow-Credentials: true
Vary: Origin
```

**Rules:**
- Maintain a whitelist of allowed origins
- Echo the request `Origin` back **only if it matches** the whitelist
- Never trust `Origin` blindly
- `Vary: Origin` so caches don't mix responses

---

### 🔴 5.5 Dependency / Framework Config

- Disable default accounts (e.g., Tomcat manager, Jenkins admin)
- Remove sample apps and demo pages shipped with frameworks
- Update frameworks regularly — subscribe to security advisories
- Replace default configs with hardened configs (not the shipped ones)
- Pin versions; don't silently upgrade across majors

---

### 🔴 5.6 Cloud Configuration (Most Common Failure)

Most breaches in the last decade are cloud misconfig, not clever exploits.

- **Storage buckets**: private by default, signed URLs for access, block public ACLs at account level
- **IAM**: least privilege, no wildcard `*` actions or resources
- **Secrets**: in a secret manager (AWS SSM, GCP Secret Manager, Vault, Supabase Secrets). **Never** in code, env files committed to git, or client bundles
- **Networking**: security groups deny-by-default, only required ports open
- **Logging**: CloudTrail / audit logs **enabled and monitored**, not just enabled
- **Regions**: lock data to approved regions (compliance + blast radius)
- **MFA**: mandatory on root / billing / admin accounts

---

### 🔴 5.7 Container / DevOps

- No root user inside containers (`USER 1000`)
- Minimal base images (`distroless`, `alpine`, `scratch`)
- Remove build tools from final image (multi-stage builds)
- Scan every image for CVEs (`trivy`, `grype`, ECR scan)
- Pin image digests, not just tags (`@sha256:...`)
- Read-only filesystem where possible
- No `:latest` tags in production

---

## 6. IMPLEMENTATION — WHAT REAL ENGINEERING LOOKS LIKE

### 6.1 Infrastructure as Code (Mandatory)

If you configure manually, you **will** drift.

```yaml
# terraform / yaml example (simplified)
security:
  debug: false
  tls:
    min_version: "1.2"
  cors:
    allowed_origins:
      - https://app.yourdomain.com
  headers:
    hsts: "max-age=31536000; includeSubDomains; preload"
    csp: "default-src 'self'; script-src 'self'"
  storage:
    public_access: blocked
    encryption: enforced
```

Every environment is rebuilt from this config. Manual kubectl/console changes are **forbidden** (and revoked on next apply).

### 6.2 Config Validation Pipeline

Every deploy must fail the build if:

- `DEBUG=true` in prod config
- secrets present in source
- open ports detected beyond whitelist
- CORS allows `*`
- TLS < 1.2
- IAM policy contains `"*"` on sensitive actions
- container runs as root

Tools: `gitleaks`, `trufflehog`, `checkov`, `tfsec`, `kube-linter`, `conftest`.

### 6.3 Config Baseline ("Golden Config")

Define:

- `config/prod.yaml` — the only truth for production
- `config/staging.yaml` — same structure, different values
- A diff tool that compares **live environment** vs **declared config** and alerts on drift

If live ≠ declared → page someone.

---

## 7. HOW TO VERIFY — STOP TRUSTING YOURSELF

### 7.1 Automated Scans

- **Network**: `nmap` against your own prod and staging
- **Web**: `nikto`, `zap-baseline`, `testssl.sh`
- **Headers**: `securityheaders.com`, `observatory.mozilla.org`
- **TLS**: `ssllabs.com/ssltest`
- **Cloud**: `scout suite`, `prowler`, `cloudsploit`
- **Secrets**: `gitleaks`, `trufflehog` in CI on every commit
- **Dependencies**: `npm audit`, `pip-audit`, `trivy`

Run these on a **schedule**, not once.

### 7.2 Manual Tests

**1. Directory listing**

```
GET /uploads/
GET /backup/
GET /static/
```
If you see a file index → **failure**.

**2. Sensitive files**

```
GET /.env
GET /.git/config
GET /.git/HEAD
GET /config.yml
GET /docker-compose.yml
GET /web.config
```
If any return 200 with content → **critical failure**.

**3. Error leaks**

Force errors:
- invalid JSON body
- missing required fields
- bad SQL-looking input (`' OR 1=1--`)
- absurdly large payloads

If the response contains stack traces, file paths, SQL fragments, or framework version → **failure**.

**4. CORS test**

```bash
curl -I -H "Origin: https://evil.com" https://api.yourdomain.com/me
```
If `Access-Control-Allow-Origin: https://evil.com` or `*` comes back on an authenticated endpoint → **misconfigured**.

**5. Port scan**

```bash
nmap -p- -sV your.prod.ip
```
If you see services you forgot (Redis, Mongo, admin UIs, old SSH) → **you lost control of the box**.

**6. Headers check**

```bash
curl -I https://yoursite.com | grep -iE 'strict-transport|x-frame|x-content|content-security|referrer'
```
Missing any of these → **gap to close**.

**7. Default credentials**

Try vendor defaults on every admin surface (`admin/admin`, `root/root`, `guest/guest`). If any work → **immediate incident**.

---

## 8. COMMON ANTI-PATTERNS — YOU'RE PROBABLY DOING THESE

- ❌ "It's just staging, doesn't matter" — staging has real data and real credentials more often than you admit
- ❌ "We'll secure it later" — later never comes; attackers do
- ❌ "Default config is fine" — defaults are designed for **setup**, not **production**
- ❌ "Nobody knows this endpoint" — security through obscurity is not security; bots enumerate everything
- ❌ "Debug helps us" — debug helps attackers more than it helps you
- ❌ "It's behind a VPN" — VPN ≠ zero-trust; one compromised laptop and you're done
- ❌ "We did a pentest last year" — config drifts weekly; one-off audits are theater

---

## 9. REAL-WORLD FAILURES

These are not exotic attacks. They are lazy mistakes that happen constantly:

- **Public S3 bucket** → millions of records leaked (Capital One, Accenture, US Voter DB, etc.)
- **Debug mode in prod** → full paths, env vars, secrets dumped in error page
- **Open admin panel** → full takeover via default password
- **Default credentials on DB** → ransomware within hours (MongoDB, Elasticsearch extortion waves)
- **Unpatched server** → remote code execution from a public CVE
- **Exposed `.git/`** → full source + history + sometimes secrets
- **Misconfigured CORS** → attacker site reads authenticated responses
- **Missing HSTS** → SSL-strip on public WiFi
- **Verbose SQL errors** → SQL injection discovery 100× easier

None of these require skill. They require the defender to fall asleep.

---

## 10. METRICS — IF YOU DON'T TRACK THIS, YOU'RE BLIND

Track and report weekly:

| Metric | Target |
|---|---|
| Exposed services (open ports beyond baseline) | 0 |
| % systems built from IaC (no manual config) | 100% |
| Config drift incidents per month | trending to 0 |
| Mean time to patch critical CVE | < 7 days |
| Secrets exposed in repos (gitleaks hits) | 0 |
| Images with critical CVEs in prod | 0 |
| Endpoints missing required security headers | 0 |
| IAM policies with wildcard `*` on sensitive actions | 0 |
| Public storage buckets | 0 (unless explicitly approved and documented) |
| Failed deploys blocked by config validation | tracked (proves pipeline works) |

If you can't produce these numbers on demand, you are not managing configuration — configuration is managing you.

---

## 11. THE ONE-PAGE CHECKLIST

- [ ] `DEBUG=false` in every non-dev environment
- [ ] Generic error responses; real errors only in server logs
- [ ] All security headers set (HSTS, CSP, X-Frame, X-Content, Referrer, Permissions)
- [ ] CORS on a strict whitelist, never `*` on authenticated endpoints
- [ ] Directory listing disabled
- [ ] `.git/`, `.env`, backup files blocked at web server
- [ ] No source maps in production
- [ ] Default credentials removed on every service
- [ ] Unused services and ports disabled
- [ ] TLS ≥ 1.2, HSTS with preload
- [ ] Storage buckets private by default, public access blocked at account level
- [ ] Secrets only in a secret manager, never in code or client bundles
- [ ] IAM least privilege, no wildcards on sensitive actions
- [ ] Containers non-root, minimal base image, scanned for CVEs
- [ ] Infrastructure managed via IaC, manual changes forbidden
- [ ] Config validation blocking in CI (debug, secrets, open ports, weak TLS)
- [ ] Drift detection comparing live vs declared config
- [ ] Automated scans (network, web, cloud, secrets, deps) on a schedule
- [ ] Manual verification pass before each release
- [ ] Metrics tracked and reviewed weekly

If every box is ticked, you are **ahead of 95% of production systems**. If any box is empty, that is your next ticket.

---

**Bottom line:** Security Misconfiguration is a discipline problem, not a knowledge problem. The fix is not "learn more" — it is **codify, validate, monitor, repeat**, forever.

---

## 12. OFFICIAL OWASP A02:2025 REFERENCE

### 12.1 Background

Moving up from #5 in the previous edition, **100% of applications tested** were found to have some form of misconfiguration, with an **average incidence rate of 3.00%**, and over **719,000 occurrences** of a Common Weakness Enumeration (CWE) in this risk category. With more shifts into highly configurable software, it's not surprising to see this category moving up. Notable CWEs included are **CWE-16 Configuration** and **CWE-611 Improper Restriction of XML External Entity Reference (XXE)**.

### 12.2 Score Table

| Metric | Value |
|---|---|
| CWEs Mapped | 16 |
| Max Incidence Rate | 27.70% |
| Avg Incidence Rate | 3.00% |
| Max Coverage | 100.00% |
| Avg Coverage | 52.35% |
| Avg Weighted Exploit | 7.96 |
| Avg Weighted Impact | 3.97 |
| Total Occurrences | 719,084 |
| Total CVEs | 1,375 |

### 12.3 Description

Security misconfiguration is when a system, application, or cloud service is set up incorrectly from a security perspective, creating vulnerabilities.

The application might be vulnerable if:

- It is missing appropriate security hardening across any part of the application stack or improperly configured permissions on cloud services.
- Unnecessary features are enabled or installed (e.g., unnecessary ports, services, pages, accounts, testing frameworks, or privileges).
- Default accounts and their passwords are still enabled and unchanged.
- A lack of central configuration for intercepting excessive error messages. Error handling reveals stack traces or other overly informative error messages to users.
- For upgraded systems, the latest security features are disabled or not configured securely.
- Excessive prioritization of backward compatibility leading to insecure configuration.
- The security settings in the application servers, application frameworks (e.g., Struts, Spring, ASP.NET), libraries, databases, etc., are not set to secure values.
- The server does not send security headers or directives, or they are not set to secure values.

Without a concerted, repeatable application security configuration hardening process, systems are at a higher risk.

### 12.4 How to Prevent

Secure installation processes should be implemented, including:

- **Repeatable hardening process** enabling fast and easy deployment of another environment that is appropriately locked down. Development, QA, and production environments should all be configured identically, with different credentials used in each environment. Automate this to minimize effort.
- **Minimal platform** without any unnecessary features, components, documentation, or samples. Remove or do not install unused features and frameworks.
- **Review and update configurations** appropriate to all security notes, updates, and patches as part of the patch management process (see A03 Software Supply Chain Failures). Review cloud storage permissions (e.g., S3 bucket permissions).
- **Segmented application architecture** providing effective and secure separation between components or tenants, with segmentation, containerization, or cloud security groups (ACLs).
- **Sending security directives to clients**, e.g., Security Headers.
- **Automated process to verify** the effectiveness of configurations and settings in all environments.
- **Proactively add central configuration** to intercept excessive error messages as a backup.
- If verifications are not automated, they should be manually verified at least annually.
- **Use identity federation, short-lived credentials, or role-based access mechanisms** provided by the underlying platform instead of embedding static keys or secrets in code, configuration files, or pipelines.

### 12.5 Example Attack Scenarios

**Scenario #1 — Sample apps left in production**
The application server ships with sample applications not removed from the production server. These sample applications have known security flaws that attackers use to compromise the server. If one of these is the admin console and default accounts weren't changed, the attacker logs in with the default password and takes over.

**Scenario #2 — Directory listing enabled**
Directory listing is not disabled on the server. An attacker lists directories, finds and downloads the compiled Java classes, decompiles and reverse engineers them to view the code, then finds a severe access control flaw in the application.

**Scenario #3 — Verbose error messages**
The application server's configuration allows detailed error messages, such as stack traces, to be returned to users. This exposes sensitive information or underlying flaws, such as component versions that are known to be vulnerable.

**Scenario #4 — Open cloud storage defaults**
A cloud service provider (CSP) defaults to having sharing permissions open to the Internet. This allows sensitive data stored within cloud storage to be accessed.

### 12.6 References

- OWASP Testing Guide: Configuration Management
- OWASP Testing Guide: Testing for Error Codes
- Application Security Verification Standard V13 Configuration
- NIST Guide to General Server Hardening
- CIS Security Configuration Guides/Benchmarks
- Amazon S3 Bucket Discovery and Enumeration
- ScienceDirect: Security Misconfiguration

### 12.7 List of Mapped CWEs

| CWE | Title |
|---|---|
| CWE-5 | J2EE Misconfiguration: Data Transmission Without Encryption |
| CWE-11 | ASP.NET Misconfiguration: Creating Debug Binary |
| CWE-13 | ASP.NET Misconfiguration: Password in Configuration File |
| CWE-15 | External Control of System or Configuration Setting |
| CWE-16 | Configuration |
| CWE-260 | Password in Configuration File |
| CWE-315 | Cleartext Storage of Sensitive Information in a Cookie |
| CWE-489 | Active Debug Code |
| CWE-526 | Exposure of Sensitive Information Through Environmental Variables |
| CWE-547 | Use of Hard-coded, Security-relevant Constants |
| CWE-611 | Improper Restriction of XML External Entity Reference |
| CWE-614 | Sensitive Cookie in HTTPS Session Without 'Secure' Attribute |
| CWE-776 | Improper Restriction of Recursive Entity References in DTDs ('XML Entity Expansion') |
| CWE-942 | Permissive Cross-domain Policy with Untrusted Domains |
| CWE-1004 | Sensitive Cookie Without 'HttpOnly' Flag |
| CWE-1174 | ASP.NET Misconfiguration: Improper Model Validation |
