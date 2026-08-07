# Deployment Quick Reference Guide
## Critical SSRF Fix & Performance Optimizations

**Deployment Date**: November 15, 2025  
**Priority**: P0 CRITICAL  

---

## Pre-Flight Checklist (30 minutes)

```bash
# 1. Run all tests
yarn test:unit && yarn test:e2e

# 2. Security audit
yarn audit --level=critical

# 3. Check for console logs
grep -r "console.log" app/ components/ lib/ --exclude-dir=__tests__

# 4. Verify environment variables in Vercel
vercel env ls production

# 5. Capture baseline metrics
curl https://api.quiversurf.app/api/metrics/baseline > baseline.json
```

---

## Deployment Commands

### Phase 1: Canary (10% Traffic) - 9:30 AM PST
```bash
# Deploy to 10% of users
vercel deploy --prod --skew-protection=10

# Monitor dashboard
open https://vercel.com/[team]/quiver/analytics
```

**Decision Point (11:30 AM)**: Error rate <0.1%? → Continue to Phase 2

### Phase 2: Partial (50% Traffic) - 12:00 PM PST
```bash
# Expand to 50% of users
vercel promote [deployment-url] --prod --skew-protection=50
```

**Decision Point (6:00 PM)**: All metrics green? → Continue to Phase 3

### Phase 3: Full Rollout (100% Traffic) - 6:30 PM PST
```bash
# Complete rollout
vercel promote [deployment-url] --prod --skew-protection=100
```

---

## Monitoring Dashboard URLs

- **Vercel Analytics**: https://vercel.com/[team]/quiver/analytics
- **Sentry Errors**: https://sentry.io/organizations/[org]/issues/
- **Supabase Metrics**: https://app.supabase.com/project/[project]/database/query-performance
- **Status Page**: https://status.quiversurf.app

---

## Quick Validation Tests

### Test SSRF Protection (Expected: 403)
```bash
curl -I "https://api.quiversurf.app/api/image-proxy?url=http://169.254.169.254"
```

### Test Rate Limiting (Expected: 429 after 10 requests)
```bash
for i in {1..15}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    "https://api.quiversurf.app/api/beaches/nearby?lat=34&lon=-118"
done
```

### Test Performance (Expected: <500ms)
```bash
time curl -s "https://api.quiversurf.app/api/v1/recommendations" > /dev/null
```

---

## Alert Thresholds

| Metric | Normal | Warning | Critical (Rollback) |
|--------|--------|---------|---------------------|
| 5xx Errors | <0.1% | 0.1-0.5% | >0.5% |
| API Response P95 | <500ms | 500-1000ms | >1000ms |
| Memory | <70% | 70-85% | >85% |
| SSRF Blocks | <10/min | 10-50/min | >50/min |

---

## Emergency Rollback

### Immediate Rollback
```bash
vercel rollback --yes
```

### Manual Rollback to Specific Version
```bash
vercel ls  # Find previous deployment
vercel promote [previous-url] --prod
```

---

## Communication Templates

### Slack Update (Success)
```
✅ SSRF Fix Deployment Update
Phase: [Canary/Partial/Full]
Traffic: [10%/50%/100%]
Error Rate: 0.0X%
P95 Response: XXXms
Status: All systems green
```

### Incident Alert
```
🔴 DEPLOYMENT ISSUE
Metric: [Metric exceeding threshold]
Value: [Current value]
Action: [Investigating/Rolling back]
ETA: [Time estimate]
```

---

## Key Contacts

- **On-Call**: Check PagerDuty
- **Vercel Support**: support@vercel.com
- **Incident Channel**: #incidents (Slack)

---

## Success Criteria

- [ ] Error rate <0.1%
- [ ] P95 latency <1s
- [ ] No P0/P1 incidents
- [ ] SSRF protection working
- [ ] Rate limiting active
- [ ] Performance improved by >90%

---

**Remember**: 
- Keep deployment channel updated every 30 minutes
- Screenshot metrics at each phase
- Document any anomalies
- Rollback immediately if thresholds exceeded

---

*Quick Reference v1.0 - Keep this guide open during deployment*
