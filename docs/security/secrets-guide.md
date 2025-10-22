# Secrets Management Guide

## Overview
This guide explains how to handle secrets (API keys, tokens, credentials) in the AP Statistics Consensus Quiz application.

## Key Types

### Public Keys (Client-Safe) ✅
These can be safely exposed in client-side code:

**SUPABASE_URL**
- Your Supabase project URL
- Example: `https://xxxxxxxxxxxxx.supabase.co`
- Public, no security risk
- Used in client and server

**SUPABASE_ANON_KEY**
- Public anonymous key from Supabase
- Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- Protected by Row-Level Security (RLS) policies
- Safe to bundle in client JavaScript
- Read-only or limited write access

### Private Keys (Server-Only) ⚠️
These must NEVER appear in client code:

**SUPABASE_SERVICE_KEY**
- Full database admin access
- Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (different token)
- Bypasses RLS policies
- Server-only (Railway server)
- ⚠️ Leaked key = complete data breach

## Where Keys Live

### Client-Side (Frontend)
```
Files: supabase_config.js, railway_config.js
Keys Allowed: SUPABASE_URL, SUPABASE_ANON_KEY, RAILWAY_SERVER_URL
Security: Public keys with RLS protection
```

### Server-Side (Railway)
```
Files: railway-server/.env (not committed)
Keys Allowed: All keys including SERVICE_KEY
Security: Environment variables, never in source code
```

## Local Development Setup

### Step 1: Copy example files
```bash
# Root directory (client config)
cp .env.example .env

# Railway server directory
cp railway-server/.env.example railway-server/.env
```

### Step 2: Get actual keys from Supabase

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to: Settings > API
4. Copy keys:
   - **URL:** Project URL section
   - **anon/public:** "Project API keys" section (anon/public key)
   - **service_role:** "Project API keys" section (service_role key) ⚠️

### Step 3: Add keys to .env files

**Client .env (optional - can use supabase_config.js directly):**
```env
SUPABASE_URL=https://your-actual-project.supabase.co
SUPABASE_ANON_KEY=eyJ...your-actual-anon-key...
```

**Server railway-server/.env:**
```env
SUPABASE_URL=https://your-actual-project.supabase.co
SUPABASE_ANON_KEY=eyJ...your-actual-anon-key...
SUPABASE_SERVICE_KEY=eyJ...your-actual-service-key...
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:8000,http://127.0.0.1:8000
```

### Step 4: Verify .gitignore

Ensure `.env` files are never committed:

```bash
# Check .gitignore contains:
cat .gitignore | grep .env

# Should output:
.env
railway-server/.env
```

If not, add them:
```bash
echo ".env" >> .gitignore
echo "railway-server/.env" >> .gitignore
```

## Production Deployment

### Railway Server Deployment

**DO NOT use .env files in production.** Use Railway's environment variable manager:

1. Go to [Railway Dashboard](https://railway.app/)
2. Select your project
3. Click "Variables" tab
4. Add each variable:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_KEY=eyJ...   ⚠️ Server-only
   NODE_ENV=production
   ALLOWED_ORIGINS=https://yourdomain.com
   ```
5. Click "Deploy" to restart with new variables

**Note:** `PORT` is set automatically by Railway - don't override it.

### Client Deployment (Netlify/Vercel/GitHub Pages)

Since client uses public keys, you can either:

**Option A: Hardcode in `supabase_config.js` (simple)**
```javascript
// supabase_config.js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...your-anon-key...';
```
This is safe - anon key is public with RLS protection.

**Option B: Build-time environment variables (advanced)**
If using a build process (Netlify/Vercel):
```bash
# In Netlify/Vercel dashboard, set build variables
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

Then in your build script, replace placeholders.

## Security Checks

### Automated Check: Verify no secrets in code
```bash
# Run boundary validation script
node tools/verify_boundaries.js

# Should check:
# ✓ No SERVICE_KEY in client files
# ✓ No hardcoded secrets in source
# ✓ All .env files in .gitignore
```

### Manual Check: grep for secrets
```bash
# Search for potential secret leaks
grep -r "eyJhbGci" --exclude-dir=node_modules .

# Should only appear in:
# - .env files (not committed)
# - supabase_config.js (anon key only)
# - railway-server/.env (not committed)
```

### Check git history for accidents
```bash
# Search commit history for potential leaks
git log -p | grep -i "service.*key\|secret\|password"

# If found, rotate keys immediately
```

## Key Rotation

If a key is leaked:

### Rotate SUPABASE_ANON_KEY
1. Go to Supabase Dashboard > Settings > API
2. Click "Regenerate" next to anon key
3. Update in all locations:
   - `supabase_config.js` (client)
   - Railway environment variables
   - Local `.env` files
4. Redeploy Railway server
5. Clear CDN cache if applicable

### Rotate SUPABASE_SERVICE_KEY ⚠️
1. Go to Supabase Dashboard > Settings > API
2. Click "Regenerate" next to service_role key
3. Update ONLY in Railway environment variables
4. Redeploy Railway server immediately
5. Old key invalidated instantly

## Common Mistakes to Avoid

### ❌ DON'T: Commit .env files
```bash
git add .env              # NEVER DO THIS
git commit -m "Add env"   # NEVER DO THIS
```

### ❌ DON'T: Put SERVICE_KEY in client code
```javascript
// supabase_config.js
const SUPABASE_SERVICE_KEY = 'eyJ...';  // ❌ NEVER!
```

### ❌ DON'T: Hardcode production secrets
```javascript
// Bad - hardcoded production secret
const API_KEY = 'sk_live_abc123';

// Good - use environment variables
const API_KEY = process.env.API_KEY;
```

### ❌ DON'T: Log secrets to console
```javascript
console.log('Key:', SUPABASE_SERVICE_KEY);  // ❌ NEVER!
```

### ✅ DO: Use placeholders in examples
```javascript
// .env.example
SUPABASE_ANON_KEY=eyJ...xxxxx...   // Fake placeholder
```

### ✅ DO: Validate secrets on server startup
```javascript
// railway-server/middleware/secrets.js
if (!process.env.SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_SERVICE_KEY');
    process.exit(1);
}
```

## Troubleshooting

### Error: "Missing environment variables"
**Cause:** .env file not loaded or missing keys
**Solution:**
```bash
# Check file exists
ls -la railway-server/.env

# Check keys present
cat railway-server/.env | grep SUPABASE_URL
```

### Error: "Invalid JWT token"
**Cause:** Wrong key or expired token
**Solution:**
1. Copy key exactly from Supabase dashboard (no extra spaces)
2. Ensure using anon key in client, service key in server
3. Check key hasn't been rotated

### Error: "CORS policy blocked"
**Cause:** `ALLOWED_ORIGINS` doesn't match client domain
**Solution:**
```env
# railway-server/.env
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

## Audit Checklist

Before deploying to production:

- [ ] ✅ `.env` files in `.gitignore`
- [ ] ✅ No secrets in git history (check `git log -p`)
- [ ] ✅ `SUPABASE_SERVICE_KEY` only in Railway variables
- [ ] ✅ `ALLOWED_ORIGINS` set to production domain only
- [ ] ✅ `NODE_ENV=production` in Railway
- [ ] ✅ Railway environment variables set (not .env file)
- [ ] ✅ Supabase RLS policies enabled
- [ ] ✅ `verify_boundaries.js` passes
- [ ] ✅ No console.log of secrets in code

## References
- Supabase docs: https://supabase.com/docs/guides/api#api-keys
- Railway docs: https://docs.railway.app/deploy/variables
- Security ADR: `docs/architecture/adr-004-anonymous-auth.md`
- Validation script: `tools/verify_boundaries.js`
