# Deployment Guide

This guide covers deployment of both the frontend (static files) and the Railway server (Node.js backend).

## Table of Contents

- [Deployment Overview](#deployment-overview)
- [Frontend Deployment](#frontend-deployment)
  - [GitHub Pages](#github-pages)
  - [Netlify](#netlify)
  - [Vercel](#vercel)
  - [Railway Static Site](#railway-static-site)
- [Railway Server Deployment](#railway-server-deployment)
  - [Prerequisites](#prerequisites)
  - [Initial Setup](#initial-setup)
  - [Environment Variables](#environment-variables)
  - [Deployment Process](#deployment-process)
- [Supabase Setup](#supabase-setup)
- [Post-Deployment Checklist](#post-deployment-checklist)
- [Monitoring & Health Checks](#monitoring--health-checks)
- [Rollback Procedures](#rollback-procedures)
- [Troubleshooting](#troubleshooting)

## Deployment Overview

The application has two components that can be deployed independently:

1. **Frontend** (Static files) - HTML, CSS, JavaScript
   - No build step required
   - Can be hosted on any static file server
   - Works standalone with localStorage only

2. **Railway Server** (Optional) - Node.js Express + WebSocket
   - Provides caching, real-time sync, JWT authentication
   - Reduces Supabase queries by 97%
   - Requires Node.js 18+ hosting

**Deployment Modes:**

| Mode | Frontend | Backend | Sync | Use Case |
|------|----------|---------|------|----------|
| Local-only | Static host | None | localStorage | Testing, offline use |
| Turbo Mode | Static host | None | Direct Supabase | Small classes (<10 students) |
| Railway Mode | Static host | Railway | Railway → Supabase | Production (recommended) |

## Frontend Deployment

The frontend is a collection of static files with no build step required.

### GitHub Pages

Free hosting for public repositories.

**Steps:**

```bash
# 1. Create gh-pages branch
git checkout -b gh-pages

# 2. Push to GitHub
git push origin gh-pages

# 3. Enable GitHub Pages
# Go to: Settings → Pages → Source → gh-pages branch → Save
```

**Configure:**

Edit `railway_config.js` with your Railway server URL:
```javascript
window.USE_RAILWAY = true;
window.RAILWAY_SERVER_URL = 'https://your-app.up.railway.app';
```

**Access:**
`https://YOUR_USERNAME.github.io/apstats-consensus-quiz/`

**Pros:** Free, automatic HTTPS, integrated with GitHub
**Cons:** Public repositories only, custom domain requires DNS setup

### Netlify

Continuous deployment with preview branches.

**Steps:**

1. **Connect Repository**
   - Go to [netlify.com](https://netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Choose GitHub and select your repository

2. **Build Settings**
   - Build command: (leave empty)
   - Publish directory: `/`
   - No build needed—it's all static!

3. **Deploy**
   - Click "Deploy site"
   - Netlify auto-deploys on every push to `main`

**Environment Variables (Netlify):**

Go to: Site settings → Build & deploy → Environment
```
RAILWAY_SERVER_URL=https://your-app.up.railway.app
```

**Custom Domain:**
- Go to: Site settings → Domain management → Add custom domain
- Update DNS records at your registrar
- Netlify provides automatic HTTPS

**Access:**
`https://your-site-name.netlify.app`

**Pros:** Free tier, preview deploys, automatic HTTPS, excellent CI/CD
**Cons:** None significant for static sites

### Vercel

Fast deployment with edge network.

**Steps:**

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   # Follow prompts to link project
   ```

3. **Production Deploy**
   ```bash
   vercel --prod
   ```

**Configuration File (`vercel.json`):**

```json
{
    "version": 2,
    "public": true,
    "cleanUrls": true,
    "trailingSlash": false,
    "headers": [
        {
            "source": "/(.*)",
            "headers": [
                {
                    "key": "X-Content-Type-Options",
                    "value": "nosniff"
                },
                {
                    "key": "X-Frame-Options",
                    "value": "DENY"
                }
            ]
        }
    ]
}
```

**Access:**
`https://your-project.vercel.app`

**Pros:** Fast edge network, great developer experience
**Cons:** Function limits on free tier (not applicable for static sites)

### Railway Static Site

Deploy frontend and backend on the same platform.

**Steps:**

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository

3. **Configure Static Site Service**
   - Add "Empty Service"
   - Settings → Source → Connect to root directory
   - Build command: (leave empty)
   - Start command: `npx http-server -p $PORT`

4. **Generate Domain**
   - Settings → Networking → Generate Domain

**Access:**
`https://apstats-frontend.up.railway.app`

**Pros:** Same platform as backend, simple setup
**Cons:** Uses compute credits (backend is more important)

## Railway Server Deployment

Production deployment of the Node.js backend.

### Prerequisites

- **Railway Account** - [railway.app](https://railway.app) (free tier available)
- **Supabase Project** - [supabase.com](https://supabase.com) with database schema applied
- **GitHub Repository** - Code pushed to GitHub
- **Environment Variables** - See [Environment Variables](#environment-variables) section

### Initial Setup

**1. Create Railway Project**

```bash
# Option A: Via Railway CLI
npm install -g @railway/cli
railway login
cd railway-server
railway init
railway up

# Option B: Via Railway Dashboard
# Go to railway.app → New Project → Deploy from GitHub
```

**2. Link GitHub Repository**

If using dashboard:
1. New Project → "Deploy from GitHub repo"
2. Select your repository
3. Railway detects Node.js and configures automatically

**3. Configure Build Settings**

Railway uses `railway.toml` (already configured):

```toml
[build]
builder = "NIXPACKS"
buildCommand = "cd railway-server && npm ci --production"

[deploy]
startCommand = "cd railway-server && npm start"
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

### Environment Variables

**Required Variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Public anon key | `eyJhbGciOiJIUzI1NiI...` |
| `SUPABASE_SERVICE_KEY` | Service role key (server-only) | `eyJhbGciOiJIUzI1NiI...` |
| `JWT_SECRET` | 256-bit secret for JWT signing | (generate with command below) |
| `NODE_ENV` | Environment name | `production` |

**Optional Variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port (Railway sets this) | `3000` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `*` |
| `CACHE_TTL` | Cache TTL in seconds | `30` |
| `MAX_CACHE_SIZE` | Max cached entries | `1000` |
| `PRESENCE_TTL_MS` | Presence timeout | `45000` |
| `REDIS_URL` | Redis URL for distributed rate limiting | (optional) |

**Generate JWT Secret:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Setting Variables in Railway:**

1. Go to: Project → Variables tab
2. Click "New Variable"
3. Add each variable from the table above
4. Click "Deploy" to apply changes

**Security Notes:**
- Railway encrypts all environment variables
- Never commit `.env` files to Git
- Use Railway's secret scanner to detect leaks
- Rotate `JWT_SECRET` periodically

### Deployment Process

#### Automatic Deployment (Recommended)

The project includes GitHub Actions workflows for automated deployment.

**Staging Environment:**

```yaml
# .github/workflows/deploy.yml
# Auto-deploys on push to main branch

Trigger: Push to main
Actions:
1. Run tests (npm test)
2. Deploy to Railway staging environment
3. Run health checks
4. Post deployment status to commit
```

**To Deploy to Staging:**
```bash
git push origin main
# GitHub Actions automatically deploys
```

**Production Environment:**

```yaml
# Manual deployment or release trigger

Trigger: Manual workflow_dispatch OR published release
Actions:
1. Run full test suite (npm run test:all)
2. Deploy to Railway production environment
3. Run health checks with extended retries
4. Create deployment tag
5. Notify on success/failure
```

**To Deploy to Production:**

```bash
# Option A: Manual trigger via GitHub Actions UI
# Go to: Actions → Deploy to Railway → Run workflow → Select "production"

# Option B: Create release
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
# Then create release on GitHub
```

#### Manual Deployment

**Via Railway CLI:**

```bash
cd railway-server

# Link to project (first time only)
railway link

# Deploy to staging
railway up --environment staging

# Deploy to production
railway up --environment production
```

**Via Railway Dashboard:**

1. Go to: Project → Deployments
2. Click "Deploy" on latest commit
3. Select environment (staging/production)
4. Confirm deployment

### Deployment Checklist

Before deploying to production:

- [ ] All tests pass (`npm run test:all`)
- [ ] Environment variables set in Railway
- [ ] Supabase schema applied
- [ ] CORS origins configured (not wildcard)
- [ ] JWT secret generated and set
- [ ] Health check endpoint tested
- [ ] Staging deployment successful
- [ ] Rollback plan prepared

## Supabase Setup

The Railway server requires a Supabase database.

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up / Log in
3. Click "New Project"
4. Choose organization, name, database password, region
5. Wait for project to initialize (~2 minutes)

### 2. Apply Database Schema

1. Go to: SQL Editor in Supabase dashboard
2. Copy SQL from `docs/supabase_schema.sql`
3. Paste and click "Run"
4. Verify tables created: `answers`, `votes`, `badges`, `user_activity`

**Schema Overview:**
```sql
-- Student answers
CREATE TABLE answers (
    username TEXT NOT NULL,
    question_id TEXT NOT NULL,
    answer_value TEXT NOT NULL,
    submitted_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (username, question_id)
);

-- Peer votes
CREATE TABLE votes (
    vote_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id TEXT NOT NULL,
    voter_username TEXT NOT NULL,
    target_username TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Badges/achievements
CREATE TABLE badges (
    badge_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    badge_type TEXT NOT NULL,
    username TEXT NOT NULL,
    earned_date TIMESTAMP DEFAULT NOW()
);

-- Real-time presence
CREATE TABLE user_activity (
    username TEXT PRIMARY KEY,
    activity_state TEXT,
    question_id TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 3. Enable Real-time

1. Go to: Database → Replication
2. Enable real-time for tables:
   - `answers`
   - `votes`
   - `user_activity`
3. Click "Save"

### 4. Configure Row Level Security (RLS)

RLS is handled by the Railway server with JWT authentication. No additional configuration needed.

### 5. Get API Keys

1. Go to: Settings → API
2. Copy **Project URL** → Set as `SUPABASE_URL`
3. Copy **anon public** key → Set as `SUPABASE_ANON_KEY`
4. Copy **service_role** key → Set as `SUPABASE_SERVICE_KEY` (server-only!)

**Security Warning:**
- **NEVER** expose `service_role` key in client code
- Only use on server (Railway environment variables)
- The `anon` key is safe for client use

## Post-Deployment Checklist

After deploying both frontend and backend:

### 1. Health Check

```bash
curl https://your-app.up.railway.app/health
```

Expected response:
```json
{
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00Z",
    "uptime": 3600,
    "version": "2.0.0"
}
```

### 2. API Endpoint Test

```bash
# Test peer data endpoint
curl https://your-app.up.railway.app/api/peer-data

# Test question stats
curl https://your-app.up.railway.app/api/question-stats/U1-L1-Q01
```

### 3. WebSocket Connection Test

```javascript
// In browser console
const ws = new WebSocket('wss://your-app.up.railway.app');
ws.onopen = () => console.log('Connected');
ws.onerror = (err) => console.error('Connection failed', err);
```

### 4. Frontend Configuration

Update `railway_config.js`:
```javascript
window.USE_RAILWAY = true;
window.RAILWAY_SERVER_URL = 'https://your-app.up.railway.app';
```

Commit and push to redeploy frontend.

### 5. Test End-to-End

1. Open frontend URL in browser
2. Create anonymous profile (Fruit_Animal username)
3. Answer a question
4. Open second browser/incognito window
5. Verify real-time sync works
6. Check Network tab for WebSocket connection

### 6. Configure Monitoring

See [Monitoring & Health Checks](#monitoring--health-checks) section.

## Monitoring & Health Checks

### Railway Dashboard

**View Metrics:**
1. Go to: Project → Metrics
2. Monitor:
   - CPU usage
   - Memory usage
   - Request rate
   - Response times
   - Error rates

**View Logs:**
1. Go to: Project → Deployments → View Logs
2. Use filters to find errors
3. Logs include structured JSON with PII redaction

**Example log entries:**
```
[INFO] answer_submitted { questionId: "U1-L1-Q01", username: "REDACTED" }
[WARN] rate_limit_exceeded { endpoint: "/api/answers", ip: "203.0.113.0" }
[ERROR] database_error { code: "PGRST", message: "Connection failed" }
```

### Health Check Endpoint

**Endpoint:** `GET /health`

**Response:**
```json
{
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "uptime": 3600,
    "memory": {
        "rss": 50331648,
        "heapTotal": 35913728,
        "heapUsed": 20486656
    },
    "version": "2.0.0"
}
```

**Status Codes:**
- `200` - Healthy
- `503` - Unhealthy (database down, etc.)

**Automated Monitoring:**

The GitHub Actions deployment workflow includes health checks:

```yaml
- name: Health check
  run: |
    MAX_RETRIES=10
    for i in $(seq 1 $MAX_RETRIES); do
      if curl -f https://your-app.up.railway.app/health; then
        echo "✅ Health check passed"
        exit 0
      fi
      sleep 10
    done
    exit 1
```

### Uptime Monitoring

**Option 1: UptimeRobot**
1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Add new monitor:
   - Type: HTTP(s)
   - URL: `https://your-app.up.railway.app/health`
   - Interval: 5 minutes
3. Configure alerts (email, Slack, etc.)

**Option 2: Railway Health Checks**
Railway automatically monitors the `healthcheckPath` defined in `railway.toml`:
```toml
[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 30
```

### Error Tracking

Consider integrating error tracking:

**Sentry:**
```javascript
// In server-new.js
import * as Sentry from '@sentry/node';

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV
});
```

## Rollback Procedures

If a deployment causes issues, rollback immediately.

### Automatic Rollback (Railway)

Railway keeps previous deployments. To rollback:

1. Go to: Project → Deployments
2. Find last working deployment
3. Click "⋯" menu → "Redeploy"
4. Confirm rollback

**Rollback time:** ~2-3 minutes

### Manual Rollback (Git)

```bash
# 1. Find last working commit
git log --oneline

# 2. Revert to that commit
git revert <commit-hash>

# 3. Push to trigger redeployment
git push origin main
```

### Database Rollback

**WARNING:** Database rollbacks are dangerous. Only do if absolutely necessary.

```sql
-- Example: Rollback schema change
-- Run in Supabase SQL editor

-- Restore from backup
-- (Supabase provides automatic backups on Pro plan)

-- Or manually revert
DROP TABLE IF EXISTS new_table;
ALTER TABLE old_table ADD COLUMN reverted_column TEXT;
```

### Rollback Checklist

- [ ] Identify deployment that caused issue
- [ ] Notify users of temporary downtime (if needed)
- [ ] Rollback Railway server deployment
- [ ] Verify health check passes
- [ ] Test critical paths (auth, answer submission, voting)
- [ ] Monitor error rates for 15 minutes
- [ ] Update incident log
- [ ] Plan fix for next deployment

## Troubleshooting

### Deployment Fails

**Symptom:** Railway deployment fails with build error

**Solutions:**
```bash
# Check Railway logs
railway logs

# Common issues:
# 1. Missing dependencies
cd railway-server
npm install
git add package-lock.json
git commit -m "fix: update package-lock.json"
git push

# 2. Incorrect build command
# Verify railway.toml buildCommand

# 3. Node version mismatch
# Check package.json engines field
```

### Health Check Fails

**Symptom:** Health check returns 503 or times out

**Solutions:**
```bash
# 1. Check Supabase connection
# Verify SUPABASE_URL and SUPABASE_ANON_KEY in Railway variables

# 2. Check server logs
railway logs --tail 100

# 3. Test locally
cd railway-server
npm start
curl http://localhost:3000/health

# 4. Verify port binding
# Railway sets PORT environment variable - ensure server listens on it
```

### CORS Errors

**Symptom:** Browser console shows CORS policy error

**Solutions:**
```javascript
// Update railway-server/server-new.js
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'https://your-frontend.netlify.app',
    'https://your-frontend.github.io'
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));
```

Update Railway environment variable:
```
ALLOWED_ORIGINS=https://your-frontend.netlify.app,https://your-other-domain.com
```

### WebSocket Connection Fails

**Symptom:** WebSocket fails to connect or disconnects immediately

**Solutions:**
```javascript
// 1. Check WebSocket URL scheme (wss:// not http://)
const ws = new WebSocket('wss://your-app.up.railway.app');

// 2. Verify Railway supports WebSocket (it does!)
// Check Network tab in browser DevTools → WS filter

// 3. Check CORS headers include WebSocket upgrade
// Railway automatically handles this
```

### High Memory Usage

**Symptom:** Railway shows high memory usage, potential restarts

**Solutions:**
```javascript
// 1. Limit cache size in railway-server/server-new.js
const MAX_CACHE_SIZE = 1000;  // Adjust based on memory limits

// 2. Implement cache eviction
if (cache.size > MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
}

// 3. Monitor memory in logs
setInterval(() => {
    const usage = process.memoryUsage();
    logger.info('memory_usage', {
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB'
    });
}, 60000);
```

### Rate Limit Issues

**Symptom:** Legitimate requests getting rate limited

**Solutions:**
```javascript
// Adjust rate limits in railway-server/middleware/rateLimit.js
export const answerRateLimit = rateLimit({
    windowMs: 60 * 1000,       // 1 minute
    max: 30,                   // Increase from 30 to 60
    message: 'Too many answer submissions'
});
```

### Database Connection Errors

**Symptom:** "Connection refused" or "PGRST" errors in logs

**Solutions:**
```bash
# 1. Verify Supabase project is active
# Go to supabase.com → Dashboard → Check status

# 2. Check Supabase API keys are correct
# Settings → API → Compare with Railway variables

# 3. Test Supabase connection
curl https://YOUR_PROJECT.supabase.co/rest/v1/answers \
  -H "apikey: YOUR_ANON_KEY"

# 4. Check Supabase service status
# https://status.supabase.com
```

## Additional Resources

- [Railway Documentation](https://docs.railway.app)
- [Supabase Documentation](https://supabase.com/docs)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Project API Reference](API.md)
- [Performance Optimization Guide](PERFORMANCE.md)

---

**Need help?** Open an issue or discussion on GitHub.

**Deployment successful?** Share your setup in GitHub Discussions to help others!
