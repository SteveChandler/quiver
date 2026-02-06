# ML Model Deployment Setup

This document describes how to set up automated ML model deployment from the retraining pipeline to Fly.io.

## Overview

The ML retraining pipeline (`/api/cron/ml/retrain`) automatically:
1. Trains a new model version using production data
2. Validates the model meets quality gates
3. **Deploys the model to Fly.io** (if validation passes)
4. Updates the model registry

This document focuses on step 3: the automated deployment to Fly.io.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ ML Retrain Pipeline (/api/cron/ml/retrain)                  │
│                                                              │
│  1. Train model on ML service                                │
│  2. ML service returns model artifact URL                    │
│  3. deployToFly() function:                                  │
│     ├─> Upload model to Supabase Storage (ml-artifacts)     │
│     ├─> Get Fly.io machines via API                          │
│     ├─> Update MODEL_VERSION & MODEL_PATH env vars          │
│     ├─> Restart machines                                     │
│     └─> Poll /health until new version confirmed            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │ Supabase Storage      │
                  │ Bucket: ml-artifacts  │
                  │ Path: ml-models/*.json│
                  └───────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │ Fly.io API            │
                  │ (Machines API)        │
                  │ - Update env vars     │
                  │ - Restart machines    │
                  └───────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │ ML Service (Fly.io)   │
                  │ https://quiver-ml.fly.dev│
                  │ - Loads new model     │
                  │ - /health reports ver │
                  └───────────────────────┘
```

## Required Environment Variables

Add these to your `.env.local` (development) and Vercel environment variables (production):

### ML Service Configuration

```bash
# ML service endpoint
ML_SERVICE_URL=https://quiver-ml.fly.dev

# Internal secret for authenticating requests to ML service
# Generate with: openssl rand -hex 32
ML_INTERNAL_SECRET=your_ml_internal_secret_here
```

### Fly.io Deployment Credentials

```bash
# Fly.io API token for automated deployments
# Get from: https://fly.io/dashboard/personal/tokens
# Required scopes: read machines, write machines
FLY_API_TOKEN=your_fly_api_token_here

# Fly.io app name (default: quiver-ml)
FLY_APP_NAME=quiver-ml
```

### Supabase Configuration

These should already be set, but are required for model upload:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Setup Instructions

### 1. Create Fly.io API Token

1. Visit https://fly.io/dashboard/personal/tokens
2. Click "Create Token"
3. Name: "Quiver ML Auto-Deploy"
4. Expiry: Choose appropriate expiration (recommend: 1 year)
5. Scopes: Ensure "read" and "write" access to machines
6. Copy the token (you won't see it again!)
7. Add to `.env.local` as `FLY_API_TOKEN`

### 2. Configure Supabase Storage Bucket

The `ml-artifacts` storage bucket is automatically created by migration:

```bash
supabase migration up --file 20260203000000_create_ml_artifacts_bucket.sql
```

This creates:
- Bucket: `ml-artifacts`
- Public read access (ML service needs to download without auth)
- Service role can upload/update/delete
- 50 MB file size limit
- Allowed MIME types: `application/json`, `application/octet-stream`

### 3. Configure ML Service Secret

The ML service needs to authenticate requests from the retrain pipeline:

```bash
# Generate a secure secret
openssl rand -hex 32

# Set on both sides:
# 1. Add to .env.local as ML_INTERNAL_SECRET
# 2. Set on Fly.io as secret:
fly secrets set ML_INTERNAL_SECRET="your_secret_here" -a quiver-ml
```

### 4. Verify Deployment Configuration

Check that the ML service is configured to accept dynamic model loading:

```bash
# Check current environment variables on Fly.io
fly config env -a quiver-ml

# Should include:
# - MODEL_PATH (will be updated by deployment)
# - MODEL_VERSION (will be updated by deployment)
# - FALLBACK_MODEL_PATH (static fallback)
```

### 5. Test the Deployment (Optional)

Trigger a test deployment manually:

```bash
# Trigger the retrain pipeline
curl -X POST https://your-app.vercel.app/api/cron/ml/retrain \
  -H "Authorization: Bearer ${CRON_SECRET_TOKEN}"

# Monitor logs
# 1. Vercel logs (retrain pipeline)
# 2. Fly.io logs (ML service restart)
fly logs -a quiver-ml
```

## Deployment Flow Details

### Phase 1: Model Upload (30 seconds)

```typescript
// 1. Download model from training output URL
const modelResponse = await fetch(modelUrl);
const modelData = await modelResponse.arrayBuffer();

// 2. Upload to Supabase Storage
await supabase.storage
  .from('ml-artifacts')
  .upload(`ml-models/${modelVersion}.json`, modelData);

// 3. Get public URL
const { data } = supabase.storage
  .from('ml-artifacts')
  .getPublicUrl(`ml-models/${modelVersion}.json`);
```

### Phase 2: Machine Update (30 seconds)

```typescript
// 1. Get list of machines
const machines = await fetch(
  `https://api.machines.dev/v1/apps/${FLY_APP_NAME}/machines`,
  { headers: { Authorization: `Bearer ${FLY_API_TOKEN}` } }
);

// 2. For each machine, update env vars
for (const machine of machines) {
  await fetch(
    `https://api.machines.dev/v1/apps/${FLY_APP_NAME}/machines/${machine.id}`,
    {
      method: 'POST',
      body: JSON.stringify({
        config: {
          ...machineConfig,
          env: {
            ...machineConfig.env,
            MODEL_VERSION: modelVersion,
            MODEL_PATH: publicModelUrl,
          },
        },
      }),
    }
  );
}
```

### Phase 3: Machine Restart (15 seconds)

```typescript
// Restart each machine to load new model
for (const machine of machines) {
  await fetch(
    `https://api.machines.dev/v1/apps/${FLY_APP_NAME}/machines/${machine.id}/restart`,
    { method: 'POST' }
  );
}
```

### Phase 4: Health Check Polling (60 seconds max)

```typescript
// Poll /health endpoint until new version is confirmed
while (Date.now() - startTime < HEALTH_CHECK_TIMEOUT) {
  const health = await fetch(`${ML_SERVICE_URL}/health`).json();

  if (health.model_version === modelVersion) {
    // Success! New model is live
    return { success: true };
  }

  await sleep(3000); // Wait 3 seconds before next check
}
```

## Timeouts and Limits

- **Total deployment timeout**: 2 minutes
- **Model download timeout**: 30 seconds
- **Storage upload timeout**: Default (30 seconds)
- **Fly.io API timeout**: 10 seconds per request
- **Machine restart timeout**: 30 seconds per machine
- **Health check interval**: 3 seconds
- **Health check timeout**: 60 seconds

## Error Handling

The deployment function handles failures gracefully:

### Model Upload Failures
- **Error**: Storage upload fails
- **Behavior**: Return error, don't update machines
- **Recovery**: Retry the entire pipeline

### Machine Update Failures
- **Error**: Fly.io API returns 4xx/5xx
- **Behavior**: Return error immediately
- **Recovery**: Manual investigation required

### Health Check Failures
- **Error**: Health endpoint doesn't confirm new version
- **Behavior**: Return error after timeout
- **Recovery**: Check Fly.io logs, may need manual rollback

### Partial Failures
- **Error**: Some machines update, others fail
- **Behavior**: Return error with details
- **Recovery**: May result in mixed versions; manual intervention required

## Monitoring and Debugging

### Vercel Logs (Retrain Pipeline)

```bash
# View deployment logs in Vercel dashboard
# Look for:
[deployToFly] Starting deployment of v3.20260203
[deployToFly] Model uploaded to: https://...
[deployToFly] Found 1 machine(s)
[deployToFly] Machine abc123 configuration updated
[deployToFly] Machine abc123 restarted successfully
[deployToFly] Health check confirmed new model version
[deployToFly] Deployment completed successfully in 45.2s
```

### Fly.io Logs (ML Service)

```bash
fly logs -a quiver-ml

# Look for:
# - Machine restart events
# - Model loading messages
# - Health check requests
# - Any errors during model load
```

### Health Endpoint Check

```bash
# Manual health check
curl https://quiver-ml.fly.dev/health

# Expected response:
{
  "status": "healthy",
  "model_version": "v3.20260203",
  "model_loaded": true,
  "uptime_seconds": 123
}
```

## Security Considerations

### API Token Security
- Store `FLY_API_TOKEN` as a Vercel environment variable (encrypted)
- Never commit tokens to git
- Rotate tokens every 6-12 months
- Use minimal required scopes (read/write machines only)

### Storage Security
- `ml-artifacts` bucket is **public** (ML service needs access)
- Only service role can upload/delete
- Models contain no sensitive data (just statistical parameters)
- Consider adding authentication if models become proprietary

### ML Service Secret
- `ML_INTERNAL_SECRET` protects ML service endpoints
- Required for `/train` endpoint
- Should be different from `CRON_SECRET_TOKEN`
- Generate with `openssl rand -hex 32`

## Rollback Procedure

If a deployment fails or causes issues:

### Option 1: Automatic Fallback
The ML service has a `FALLBACK_MODEL_PATH` configured:
```bash
# Check fallback configuration
fly config env -a quiver-ml | grep FALLBACK

# The service should automatically fall back if MODEL_PATH fails
```

### Option 2: Manual Rollback
```bash
# 1. Find previous working version in ml_model_registry
SELECT version, deployed_at
FROM ml_model_registry
WHERE status = 'deployed'
ORDER BY deployed_at DESC
LIMIT 5;

# 2. Get the public URL from storage
# https://{project}.supabase.co/storage/v1/object/public/ml-artifacts/ml-models/{version}.json

# 3. Update Fly.io environment variables manually
fly secrets set MODEL_VERSION="v3.20260201" -a quiver-ml
fly secrets set MODEL_PATH="https://..." -a quiver-ml

# 4. Restart machines
fly machine restart -a quiver-ml
```

### Option 3: Database Rollback
Update the `ml_model_registry` to reflect the current deployed version:

```sql
UPDATE ml_model_registry
SET status = 'active'
WHERE version = 'v3.20260201';

UPDATE ml_model_registry
SET status = 'failed', notes = 'Rolled back due to deployment issues'
WHERE version = 'v3.20260203';
```

## Production Deployment Checklist

Before enabling automated deployments in production:

- [ ] `FLY_API_TOKEN` set in Vercel production environment
- [ ] `ML_INTERNAL_SECRET` set in both Vercel and Fly.io
- [ ] `ml-artifacts` storage bucket created and configured
- [ ] ML service `/health` endpoint returns correct format
- [ ] ML service can download from Supabase Storage (test with public URL)
- [ ] Test manual deployment with a dummy model
- [ ] Verify health check polling works correctly
- [ ] Set up monitoring/alerts for deployment failures
- [ ] Document rollback procedure for team
- [ ] Test rollback procedure once

## Troubleshooting

### Issue: "FLY_API_TOKEN environment variable not set"
**Solution**: Add `FLY_API_TOKEN` to Vercel environment variables

### Issue: "Failed to fetch Fly.io machines: 401"
**Solution**: Token is invalid or expired. Generate a new one.

### Issue: "Failed to upload model to storage"
**Solution**: Check Supabase service role key and bucket permissions

### Issue: "Health check failed to confirm new model version"
**Solution**:
1. Check Fly.io logs: `fly logs -a quiver-ml`
2. Verify model URL is accessible: `curl {MODEL_PATH}`
3. Check if ML service can load the model format

### Issue: "Deployment timed out"
**Solution**: Check if Fly.io region is experiencing issues, increase timeout if needed

## References

- [Fly.io Machines API Documentation](https://fly.io/docs/machines/api/)
- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [ML Service Architecture](../ml/README.md)
- [ML Retraining Pipeline Design](./plans/2026-02-01-ml-rolling-pipeline-design.md)
- [Model Registry Schema](../supabase/migrations/20260201120000_ml_model_registry.sql)
