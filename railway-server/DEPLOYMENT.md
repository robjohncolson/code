# Railway Server Deployment Guide

## 🚨 Important: Server Update Required

The Railway server needs to be redeployed to include the new `/api/user-answers/:username` endpoint for chart hydration.

## Quick Deploy (if already connected to Railway)

```bash
# From the railway-server directory
cd railway-server

# Deploy to Railway
railway up
```

## Manual Deploy via Railway Dashboard

1. Go to your Railway dashboard at https://railway.app
2. Navigate to your project
3. Click on your service
4. Go to the "Deploy" tab
5. Click "Deploy from GitHub" or "Redeploy"

## Local Testing First (Recommended)

```bash
# Test locally first
cd railway-server
npm install
npm start

# In another terminal, test the new endpoint
curl http://localhost:3000/api/user-answers/Test_User
```

## New Endpoint Added

**GET /api/user-answers/:username**
- Fetches all answers for a specific user
- Used for hydrating charts on page load
- Returns:
  ```json
  {
    "data": [...answers],
    "username": "User_Name",
    "count": 10,
    "timestamp": 1234567890
  }
  ```

## Verify Deployment

After deployment, verify the endpoint is working:

```bash
# Replace with your Railway URL
curl https://code-production-2468.up.railway.app/api/user-answers/Test_User

# Should return 200 OK with empty data array if user has no answers
# Should NOT return 404
```

## Troubleshooting

### Still getting 404 errors?

1. **Check logs in Railway dashboard**
   ```bash
   railway logs
   ```

2. **Ensure server.js has the endpoint** (lines 127-161):
   ```javascript
   app.get('/api/user-answers/:username', async (req, res) => {
     // ... endpoint code
   });
   ```

3. **Force rebuild**:
   - In Railway dashboard, go to Settings
   - Click "Trigger Deploy"
   - Select "Clear build cache"

4. **Check environment variables**:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - Both should be set in Railway dashboard

## Success Indicators

✅ No more 404 errors in browser console for `/api/user-answers/`
✅ Charts persist after page refresh
✅ Notification shows "Loaded X answers" on page load
✅ Railway logs show requests to the endpoint

## Contact

If issues persist after redeployment, check:
- Railway service logs
- Browser console for detailed errors
- Network tab in DevTools for response details