# Security Review Checklist - Phases 2-5

Quick reference for security review findings. See [SECURITY_REVIEW_REPORT.md](./SECURITY_REVIEW_REPORT.md) for full details.

## Critical Issues - MUST FIX BEFORE DEPLOYMENT

- [ ] **P0:** Fix SSRF subdomain bypass vulnerability in `/app/api/image-proxy/route.ts:48-50`
  - Replace `.endsWith(domain)` with exact match: `url.hostname === domain || url.hostname.endsWith('.' + domain)`
  - Add private IP range blocking
  - Test with malicious subdomains

## High Priority - Fix Within 1 Week

- [ ] **P1:** Add private IP range blocking to image proxy
  - Block 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16
  
- [ ] **P1:** Fix TypeScript compilation errors in test suite (32+ errors)
  - Fix mock types in test files
  - Ensure tests actually run

- [ ] **P1:** Add request body size limits
  - Implement 1MB max for JSON payloads
  - Add to validation middleware

- [ ] **P1:** Refactor E2E bypass logic
  - Move from production routes to test-only middleware
  - Files: `/app/api/plan-session/route.ts:127-139`, `/app/api/intel/route.ts:267-279`

## Medium Priority - Fix Within 1 Month

- [ ] **P2:** Add explicit XSS sanitization
  - Comments: `/app/api/sessions/[id]/comments/route.ts`
  - Intel posts: `/app/api/intel/route.ts`
  - Use DOMPurify or HTML entity encoding

- [ ] **P2:** Upgrade vulnerable dependencies
  - `undici` in Firebase (moderate severity)
  - `js-yaml` in ESLint (moderate severity)

- [ ] **P2:** Implement distributed rate limiting
  - Current in-memory solution won't scale across Vercel instances
  - Plan for Redis/Upstash migration

- [ ] **P2:** Add Sentry alerting for rate limiter errors
  - High-severity alerts when rate limiter fails
  - Currently errors are silent

## Low Priority - Nice to Have

- [ ] **P3:** Add Content-Security-Policy headers to API routes
- [ ] **P3:** Implement request size metrics
- [ ] **P3:** Add performance budgets to CI/CD
- [ ] **P3:** Fix ESLint warnings (10 non-security issues)

## Testing Checklist

After fixes, verify:

- [ ] SSRF fix tested with malicious domains
- [ ] Private IP blocking tested
- [ ] Rate limiting tested (429 responses)
- [ ] Input validation tested (invalid inputs rejected)
- [ ] Error boundaries don't leak sensitive data
- [ ] Build passes without errors
- [ ] All tests pass

## Deployment Checklist

- [ ] All P0 issues fixed
- [ ] Security review approved
- [ ] Tests passing
- [ ] Build successful
- [ ] Staging deployment tested
- [ ] Production deployment approved

---

**Last Updated:** 2025-11-14  
**Status:** BLOCKED (P0 SSRF vulnerability)
