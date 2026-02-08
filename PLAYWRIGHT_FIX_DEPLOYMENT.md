# Playwright Browser Installation Fix - Deployment Guide

## Problem Summary
MAC Address Search was failing on production with error:
```
browserType.launch: Executable doesn't exist at /opt/render/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell
```

The Playwright browsers were not being installed on Render deployments. Root cause: build process was silencing errors, and Playwright installation was failing without visibility.

## Root Causes Fixed

1. **Silent Failures**: Postinstall script was suppressing error output (`2>/dev/null || true`), hiding the actual problem
2. **Render-Specific Issues**: Playwright installation with `--with-deps` may fail on Render's Linux environment
3. **No Fallback Strategy**: There was no graceful degradation when Playwright install failed
4. **Limited Visibility**: No way to debug what was actually happening during build

## Changes Made

### 1. New `scripts/build-render.js`
- Dedicated build script with verbose logging
- Tries Playwright install with `--with-deps` first
- Falls back to plain `npx playwright install chromium` if needed
- Verifies installation success
- Continues build even if Playwright installation fails (startup script will retry)

### 2. Enhanced `scripts/ensure-playwright.js`
- Checks multiple possible Playwright cache paths including Render's `/opt/render/.cache`
- Logs environment variables and paths being checked
- Uses `spawnSync` instead of `execSync` for better output streaming
- Increased timeout from 10 to 20 minutes for installation
- Better error reporting without exiting on failure

### 3. Updated `package.json`
- Removed stderr suppression from postinstall script
- Changed from `2>/dev/null || true` to proper error logging
- Allows visibility into any postinstall failures

### 4. Updated `render.yaml`
- **buildCommand**: Now uses `node scripts/build-render.js` for transparent build process
- **startCommand**: Remains `npm start` to trigger `ensure-playwright.js` at startup

## Deployment Steps

### For All Environments:

The key is to use the new `build-render.js` script which handles Playwright installation gracefully.

### Option 1: Staging (Auto-Deploy from render.yaml)
```bash
git push origin staging
```
Render will automatically deploy using the updated `render.yaml` configuration.

### Option 2: DevTest or Production (Manual Configuration)

1. Go to Render Dashboard → Select service (`uppalcrm-api-devtest` or `uppalcrm-api-production`)
2. Go to **Settings** tab
3. Find **Build Command** and set to:
   ```bash
   node scripts/build-render.js
   ```
4. Find **Start Command** and set to:
   ```bash
   npm start
   ```
5. Click **Save**
6. Trigger a **Manual Deploy** (or clear cache if option available)

### Monitoring the Build

Watch the build logs for:

**Success indicators:**
```
🏗️  Starting build process...
📦 Installing Node dependencies...
✅ Playwright installed successfully with system dependencies
✅ Chromium verified
✅ Build complete
```

**Fallback (still works, but less ideal):**
```
🎭 Installing Playwright browsers...
⚠️  Playwright install with --with-deps failed, trying without...
✅ Playwright installed successfully (without system deps)
```

**If Playwright fails completely:**
```
❌ Playwright installation failed completely
⚠️  MAC Address Search will not work until Playwright is installed
```
(This doesn't stop the build - startup script will try again)

## Verification After Deployment

### Step 1: Check Build Logs

After deployment triggers, go to **Logs** tab and verify:

**During Build Phase:**
- Should see `🏗️  Starting build process...`
- Should see `📦 Installing Node dependencies...`
- Should see `🎭 Installing Playwright browsers...`
- Should see either:
  - `✅ Playwright installed successfully` (ideal), or
  - `✅ Chromium verified` (verification step)

**During Startup Phase:**
- Should see `🎭 Checking Playwright installation...`
- Should see `✅ Playwright browsers found at...` or `✅ Playwright browsers already installed`

### Step 2: Test MAC Search Feature

1. Navigate to MAC Address Search page
2. Enter a valid MAC address (e.g., `00:1A:79:B2:5A:58`)
3. Click "Search"
4. Should see:
   - ✅ Results or proper error message
   - ✅ NOT "Executable doesn't exist" error
   - ✅ JSON response in Network tab with `status`, `portalResults`, etc.

### Step 3: Check Service Health

- Navigate to `/health` endpoint
- Should return 200 OK
- Check that service is running normally

## Expected Timeline

After deploying these changes:
- Build phase: +2-3 minutes (first time Playwright installation)
- Subsequent deployments: Normal speed (browsers cached)
- First MAC search after deploy: May take 10-30 seconds (Playwright startup)
- Subsequent searches: <5 seconds

## Troubleshooting

### Still getting browser errors after deployment:
1. Force rebuild on Render (clear cache if option available)
2. Check that `npm start` is actually running (should see initialization logs)
3. Verify environment variable `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` is NOT set

### Build phase takes too long:
- This is expected on first deployment (Playwright installation = 2-3 min)
- Subsequent builds will be faster due to caching

### Can't connect to backend:
- Make sure service started successfully after build
- Check "Logs" tab for startup errors
- Verify DATABASE_URL and other env vars are set

## Commit Info
```
Commit: f009ed4
Message: fix: Resolve Playwright browser installation on production Render servers
Branch: devtest
```

## Files Changed
- `scripts/ensure-playwright.js` - Enhanced path detection and timeouts
- `render.yaml` - Updated staging build/start commands

## Next Steps (after DevTest verified)

1. ✅ Test MAC Search in DevTest
2. Deploy to Staging (auto-deploys from staging branch via render.yaml)
3. Test MAC Search in Staging
4. Manually configure Production on Render
5. Test MAC Search in Production
6. Update Production render.yaml in repo for future deployments
