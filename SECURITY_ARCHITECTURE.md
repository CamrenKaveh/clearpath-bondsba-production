# ClearPath Security Architecture - DevSecOps Hardening

**Status:** Implementation Ready  
**Date:** April 26, 2026  
**Classification:** Internal Use Only

---

## 1. SECURITY POSTURE ANALYSIS

### Current State ✅
- ✅ JWT token validation in place (Supabase auth)
- ✅ Bearer token extraction from Authorization header
- ✅ Basic role hierarchy (admin, underwriter, viewer)
- ✅ User metadata extraction from token payload

### Gaps Identified 🔴
| Gap | Severity | Impact |
|-----|----------|--------|
| No PKCE implementation for OAuth | HIGH | Vulnerable to authorization code interception |
| No MFA enforcement | HIGH | Single factor authentication insufficient for fintech |
| No audit logging | CRITICAL | Cannot track API access, financial calculations, or compliance events |
| No input sanitization layer | HIGH | Injection attack vulnerability in document parser |
| No encryption at rest | HIGH | PII/financial data exposed in database |
| No rate limiting | MEDIUM | DDoS/brute force attacks possible |
| No request signing/CORS hardening | MEDIUM | CSRF/cross-origin manipulation possible |
| Generic error messages (only 401/403) | MEDIUM | Information disclosure in error responses |

---

## 2. IMPLEMENTATION ROADMAP

### Phase 1: Google Auth PKCE (Required for OAuth compliance)
- ✅ Implement PKCE flow client-side (generate code_verifier, code_challenge)
- ✅ Add redirect URI validation middleware
- ✅ Enforce Authorization Code flow (block implicit/hybrid flows)
- ✅ Token rotation and refresh token handling

### Phase 2: Enhanced RBAC + MFA (Enterprise standard)
- ✅ Extend role hierarchy with domain-specific permissions
- ✅ MFA requirement middleware
- ✅ Permission-based access control (not just roles)
- ✅ Domain isolation enforcement (SBA/Surety boundary)

### Phase 3: Audit Logging (SOC 2 requirement)
- ✅ Immutable audit log schema (append-only)
- ✅ Track: User access, API calls, data modifications, financial calculations
- ✅ Tamper-evident logging (hash chains)
- ✅ Real-time alerting for suspicious activity

### Phase 4: Data Protection (Encryption)
- ✅ TLS enforcement (HSTS, no HTTP)
- ✅ Field-level encryption at rest (Sodium/NaCl)
- ✅ PII/financial data classification
- ✅ Key rotation strategy

### Phase 5: Input Sanitization (Injection prevention)
- ✅ Document parser input validation
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS prevention (output encoding)
- ✅ LDAP/XML injection prevention

### Phase 6: Exception Handling (Cyber insurance readiness)
- ✅ Centralized error handling with security context
- ✅ Exception tracking (Sentry integration)
- ✅ Rapid incident response framework
- ✅ Security event classification

---

## 3. MINIMAL IMPLEMENTATION (MVP FOR TRISURA PITCH)

### Core Files to Create (Total: ~800 lines)
1. **src/shared/security/pkceClient.js** (200 lines) — Client-side PKCE flow
2. **src/shared/security/auditLogger.js** (250 lines) — Immutable audit logging
3. **api/middleware/rbac.js** (180 lines) — Enhanced RBAC + MFA
4. **api/middleware/sanitization.js** (150 lines) — Input validation/sanitization
5. **api/middleware/exceptions.js** (100 lines) — Centralized error handling
6. **api/middleware/security-headers.js** (80 lines) — CORS, CSP, HSTS

### Existing Files to Enhance
1. **api/middleware/auth.js** — Add PKCE validation
2. **.env.example** — Add security configuration

---

## 4. GOOGLE AUTH PKCE FLOW ARCHITECTURE

```
┌─ BROWSER (Frontend) ──────────────────────────────┐
│                                                    │
│  1. generateCodeChallenge()                       │
│     └─ Create code_verifier (43-128 chars)       │
│     └─ Derive code_challenge (SHA256)            │
│                                                    │
│  2. Redirect to Google OAuth with:                │
│     ├─ client_id                                 │
│     ├─ redirect_uri (EXACT match in Google)      │
│     ├─ code_challenge                            │
│     ├─ code_challenge_method=S256                │
│     └─ scope (openid,email,profile)              │
│                                                    │
│  3. Google returns:                               │
│     └─ authorization_code (temporary, 10min)     │
│                                                    │
│  4. Exchange code + code_verifier with backend   │
│                                                    │
└────────────────────────────────────────────────────┘

┌─ BACKEND (API) ───────────────────────────────────┐
│                                                    │
│  POST /api/auth/google/callback                   │
│  { code, code_verifier }                          │
│                                                    │
│  1. Validate code_verifier matches code_challenge│
│  2. Exchange code for ID token + refresh token   │
│  3. Verify ID token signature (RS256, Google key)│
│  4. Validate iss=https://accounts.google.com     │
│  5. Validate aud=client_id (exact)               │
│  6. Create Supabase user + session               │
│  7. Return JWT + refresh token (HttpOnly cookie) │
│                                                    │
└────────────────────────────────────────────────────┘
```

**PKCE Security Guarantees:**
- ✅ Authorization code interception useless without code_verifier
- ✅ Authorization code valid only for 10 minutes
- ✅ Redirect URI must match exactly (no subdomain variation)
- ✅ No implicit grant (no token in URL)
- ✅ No client_secret needed (public clients only)

---

## 5. RBAC + MFA MATRIX

### Role Definitions
```
ADMIN (Domain: All)
├─ Create users
├─ Assign roles
├─ View audit logs
├─ Override policies
└─ MFA: REQUIRED

UNDERWRITER (Domain: SBA/Surety)
├─ Analyze applications
├─ Generate term sheets
├─ Upload documents
├─ View own submissions
└─ MFA: REQUIRED

ANALYST (Domain: SBA/Surety)
├─ View applications (read-only)
├─ Generate reports
└─ MFA: OPTIONAL

VIEWER (Domain: Reports only)
├─ View dashboard metrics
└─ MFA: OPTIONAL
```

### Permission Matrix
```
CREATE_APPLICATION  → underwriter + domain match
READ_APPLICATION    → own user OR admin OR underwriter (same domain)
MODIFY_APPLICATION  → own user OR admin
DELETE_APPLICATION  → admin only
CALCULATE_PREMIUM   → underwriter + domain match
GENERATE_TERM_SHEET → underwriter + domain match
UPLOAD_DOCUMENT     → underwriter + domain match
VIEW_AUDIT_LOG      → admin only
EXPORT_DATA         → admin + audit entry
```

---

## 6. AUDIT LOGGING DESIGN

### Immutable Append-Only Schema
```sql
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  
  -- Identity
  user_id UUID NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  
  -- Action
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255),
  
  -- Context
  api_endpoint VARCHAR(255),
  http_method VARCHAR(10),
  ip_address INET,
  user_agent TEXT,
  
  -- Details
  request_body JSONB,
  response_status INT,
  error_message TEXT,
  
  -- Financial Context (if applicable)
  financial_data JSONB,
  calculation_hash VARCHAR(64),
  
  -- Integrity
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hash_chain VARCHAR(64),  -- Hash of previous row
  signature VARCHAR(512),  -- HMAC-SHA256
  
  -- Immutability
  CONSTRAINT no_updates CHECK (true)
) WITH (fillfactor=90);

CREATE INDEX idx_audit_user_time ON audit_logs(user_id, timestamp);
CREATE INDEX idx_audit_action_time ON audit_logs(action, timestamp);
```

**Hash Chain (Tamper Detection):**
```
Row 1: hash = HMAC-SHA256(id|user|action|timestamp, secret_key)
Row 2: hash = HMAC-SHA256(id|user|action|timestamp|row1_hash, secret_key)
Row 3: hash = HMAC-SHA256(id|user|action|timestamp|row2_hash, secret_key)

If any row is modified, entire chain breaks.
Detected by: new_hash ≠ computed_hash
```

---

## 7. INPUT SANITIZATION STRATEGY

### Defense Layers
1. **Type Validation** — JSON schema validation
2. **Size Limits** — Max request size, max field length
3. **Character Whitelisting** — Alphanumeric + safe symbols only
4. **SQL Injection Prevention** — Parameterized queries always
5. **XSS Prevention** — Output encoding, no inline scripts
6. **Document Parsing** — Sandbox parser, validate MIME type

### Example: Financial Data Sanitization
```javascript
FINANCIAL_FIELDS = {
  revenue: { type: 'number', min: 0, max: 1e12, pattern: /^\d+(\.\d{1,2})?$/ },
  expenses: { type: 'number', min: 0, max: 1e12, pattern: /^\d+(\.\d{1,2})?$/ },
  businessAge: { type: 'integer', min: 0, max: 100 },
  industryType: { 
    type: 'string', 
    enum: ['manufacturing', 'construction', 'service', 'retail', 'general']
  },
};
```

---

## 8. EXCEPTION HANDLING FRAMEWORK

### Error Classification
```
SEVERITY_CRITICAL
├─ Unauthorized access attempt
├─ Data integrity violation
├─ Financial calculation anomaly
└─ → Immediate audit + alert + incident creation

SEVERITY_HIGH
├─ Permission denied
├─ Invalid input
├─ Rate limit exceeded
└─ → Log + audit + monitoring

SEVERITY_MEDIUM
├─ Deprecated endpoint
├─ Slow query detected
└─ → Log + monitoring

SEVERITY_LOW
├─ Successful operations
├─ Informational
└─ → Log only
```

### Response Pattern
```javascript
{
  success: false,
  error: {
    code: "UNAUTHORIZED_DOMAIN_ACCESS",
    message: "Your account does not have access to Surety domain",
    incident_id: "INC-2026-04-26-001",  // For support
    timestamp: "2026-04-26T12:34:56Z",
    // NOT INCLUDED in response:
    // - Internal stack traces
    // - SQL queries
    // - System paths
    // - API keys or secrets
  }
}
```

---

## 9. DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] All environment variables set (no defaults in code)
- [ ] Database encryption keys rotated
- [ ] Redirect URIs match Google Console exactly
- [ ] HSTS enabled for 1 year minimum
- [ ] CSP headers configured
- [ ] CORS restricted to known domains
- [ ] Rate limiting enabled
- [ ] Audit logging tested (write + read + hash verification)
- [ ] MFA tested for all roles
- [ ] Incident response playbook documented

### Post-Deployment
- [ ] Monitor audit logs for anomalies
- [ ] Check TLS certificate validity
- [ ] Verify rate limiting is working
- [ ] Test OAuth flow with real Google credentials
- [ ] Verify MFA enrollment for all users
- [ ] Run penetration test (OWASP Top 10)

---

## 10. COMPLIANCE MAPPING

### SOC 2 Type II
- ✅ Access Control (RBAC, MFA)
- ✅ Change Management (audit logs)
- ✅ Monitoring (exception tracking)
- ✅ Encryption (TLS + at-rest)

### NIST Cybersecurity Framework
- ✅ Identify (asset inventory, data classification)
- ✅ Protect (access control, encryption)
- ✅ Detect (audit logs, anomaly detection)
- ✅ Respond (incident tracking, alerts)
- ✅ Recover (backup + restore procedures)

### Fintech Security Standards (SFIDA/FinCEN)
- ✅ Identity verification (Google OAuth)
- ✅ Data protection (encryption + audit)
- ✅ Access control (RBAC + MFA)
- ✅ Transaction monitoring (audit logs)

---

## 11. NEXT STEPS

1. **Immediate (Week 1):** Implement PKCE flow + audit logging
2. **Near-term (Week 2):** Deploy RBAC + MFA enforcement
3. **Medium-term (Week 3):** Add encryption at rest + sanitization
4. **Long-term (Month 2):** Full penetration test + SOC 2 audit

---

**Document Owner:** Lead DevSecOps Engineer  
**Last Updated:** 2026-04-26  
**Next Review:** 2026-05-26
