# OWASP A05:2025 — INJECTION (OPERATOR-LEVEL BLUEPRINT)

## 1. WHAT IT REALLY IS
Injection = **untrusted input becomes executable instructions inside an interpreter.**

Key word: **EXECUTION**. If user input changes a query, command, script, or template → you've lost control.

## 2. CORE CONCEPT
Enforce: **DATA ≠ CODE**. If user input ever becomes part of command structure → Injection exists.

## 3. ATTACK SURFACE
Same root problem, different interpreters:
- SQL (CWE-89), NoSQL
- OS commands (CWE-78)
- LDAP (CWE-90), XPath/XML (CWE-91)
- Template injection (SSTI)
- Expression languages (CWE-917)
- XSS (CWE-79)
- HTTP header injection (CWE-113)
- File inclusion (CWE-98)
- Reflection (CWE-470)
- **LLM Prompt Injection** (new)

## 4. ROOT CAUSE
You: concatenate strings → trust input → mix logic with data.

## 5. REAL EXAMPLES

### SQL Injection
```java
String q = "SELECT * FROM accounts WHERE custID='" + id + "'";
// Attack: ' OR '1'='1  → full DB exposure
```

### ORM Injection (ORM ≠ protection)
```js
db.raw("FROM accounts WHERE custID='" + id + "'")
```

### Command Injection
```js
exec("nslookup " + domain)
// Attack: example.com; cat /etc/passwd → RCE
```

## 6. HOW TO FIX

### 1. Parameterization (NON-NEGOTIABLE)
```sql
-- Wrong: "SELECT * FROM users WHERE id = " + id
-- Right:
SELECT * FROM users WHERE id = ?
```

### 2. Safe APIs
- Prepared statements
- ORM (used correctly — no `.raw()` with concat)
- Query builders

### 3. Input Validation (secondary defense)
- Whitelist validation
- Strict formats (regex, zod, schema)

### 4. Output Encoding (XSS)
- HTML/JS/URL context-aware encoding
- React auto-escapes by default — never `dangerouslySetInnerHTML` with user input

### 5. Avoid Dynamic Execution
Never: `eval(userInput)`, `exec(userInput)`, `new Function(userInput)`

### 6. Limit Query Structure Control
Never let users control: table names, column names, ORDER BY columns, LIMIT direction.

### 7. Escaping (last resort)
Fragile. Only when parameterization is impossible.

## 7. SAFE PATTERNS
```ts
// SQL
db.query("SELECT * FROM users WHERE id = $1", [id])

// Command
execFile("nslookup", [domain])  // not exec(string)

// Templates
// Use auto-escaping frameworks (React, Handlebars w/ {{ }})
```

## 8. VERIFICATION

### Manual tests
- SQLi: `' OR 1=1 --`
- Command: `; ls`
- XSS: `<script>alert(1)</script>`

### Automated
- **SAST**: detect string concat in queries
- **DAST**: simulate attacks
- **IAST**: runtime detection
- **Fuzzing**: inputs, headers, cookies, JSON bodies

## 9. ANTI-PATTERNS
- ❌ "We use ORM, so we're safe"
- ❌ "We sanitize input"
- ❌ "We escape everything"
- ❌ "Only admins can access this"

## 10. IMPACT
Full DB dump → RCE → system takeover → credential theft.

## 11. METRICS
- % parameterized queries
- Injection points found
- Unsafe dynamic queries
- Input test coverage

## 12. MATURITY MODEL
- L1: concat everywhere
- L2: partial parameterization
- L3: full parameterization
- L4: SAST + DAST automated
- L5: zero dynamic execution + continuous fuzzing

## 13. LLM INJECTION (NEW)
- Prompt injection
- System prompt leakage
- Tool/function abuse
- Same principle: user input controls system behavior

## 14. FINAL TRUTH
Injection exists because **you let users write part of your program**. Eliminate that → injection disappears.

## 15. EXECUTION PLAN
1. Find all dynamic queries
2. Replace with parameterized queries
3. Audit command execution sites
4. Implement schema-based input validation
5. Add SAST + DAST to CI
6. Fuzz all inputs

---

**Pattern across A01–A05:**
- A01 → control **access**
- A02 → control **configuration**
- A03 → control **dependencies**
- A04 → control **data protection**
- A05 → control **execution**

Miss one → the whole system collapses.
