# OWASP A04:2025 — Cryptographic Failures (Operator-Level Blueprint)

## 1. What It Really Is
Failure to correctly protect data using cryptography across its entire lifecycle: generation, storage, transmission, validation, destruction.

## 2. Core Reality
Crypto fails not because of math, but because of bad implementation, wrong usage, and poor key management.

## 3. Data-First Thinking
Classify before protecting: passwords, tokens, PII, financial data, business secrets.

## 4. Core Failure Areas
1. **No encryption** — HTTP, plaintext storage
2. **Weak algorithms** — MD5, SHA1, ECB, weak RSA
3. **Randomness failure** — predictable PRNG, low entropy
4. **Key management failure** — hardcoded, reused, no rotation, exposed
5. **Bad implementation** — wrong IV, no AEAD, insecure modes
6. **Cert validation failure** — accepting invalid certs (MITM)
7. **Password storage failure** — no salt, fast hash

## 5. Required Controls
- TLS ≥ 1.2 (prefer 1.3) + HSTS, no HTTP fallback
- Encrypt data at rest (DB, backups, sensitive fields)
- Strong algos only: AES-GCM, ChaCha20-Poly1305, RSA-OAEP, ECC
- Password hashing: Argon2 / bcrypt / scrypt / PBKDF2 with salt + work factor
- Keys in KMS/HSM, never in code; enforce rotation + access control
- CSPRNG only — never `Math.random()` for security
- Authenticated encryption (AEAD) — AES-GCM
- Unique IVs, never reused with same key
- Don't store what you don't need (tokenize/truncate/delete early)
- Disable caching for sensitive data (CDN, browser, server)

## 6. Mapped CWEs
CWE-259 (hardcoded password), CWE-327 (broken algo), CWE-331 (insufficient entropy), CWE-326 (weak crypto strength), CWE-310, CWE-319 (cleartext transmission), CWE-321 (hardcoded crypto key), CWE-328 (weak hash), CWE-916 (weak password hash).

## 7. Verification
- TLS test (no downgrade)
- Password crack test on dumped DB
- Secret scan in repo + logs
- RNG audit (CSPRNG?)
- Cert pinning / MITM test
- Crypto config scan for weak algos
- Side-channel (timing, padding oracle)

## 8. Anti-Patterns to Eliminate
- "We encrypted it" without AEAD
- SHA256 for passwords
- Keys in env files treated as secure storage
- One-time TLS check

## 9. Maturity Model
L1 basic → L2 TLS+hashing → L3 strong algos + KMS → L4 HSM + full lifecycle → L5 crypto agility + post-quantum ready.

## 10. Post-Quantum
Plan migration to quantum-safe algorithms (~2030 horizon) for long-lived systems.
