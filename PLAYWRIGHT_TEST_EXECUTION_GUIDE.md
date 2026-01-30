# Phase 1A Timezone - Playwright Test Execution Guide

**Created:** January 28, 2026
**Test Framework:** Playwright v1.57.0
**Test Environment:** Devtest (uppalcrm-frontend-devtest.onrender.com)
**Total Tests:** 40 test cases across 3 suites

---

## 🚀 Quick Start

### Run All Timezone Tests
```bash
cd frontend
npm test -- phase-1a-timezone
```

### Run Individual Test Suites
```bash
# API tests only (13 tests, 5-10 minutes)
npm test -- phase-1a-timezone-api.spec.js

# UI tests only (15 tests, 10-15 minutes)
npm test -- phase-1a-timezone-ui.spec.js

# Integration tests only (12 tests, 10-15 minutes)
npm test -- phase-1a-timezone-integration.spec.js
```

---

## 🎯 Test Suites

### Suite 1: API Tests (`phase-1a-timezone-api.spec.js`)
**13 tests - Duration: 5-10 minutes**

Tests the timezone API endpoints and backend functionality:

1. ✅ GET /api/timezones - Returns all timezones
2. ✅ GET /api/timezones - Includes default timezone
3. ✅ GET /api/timezones - Includes international timezones
4. ✅ GET /api/timezones/user - Returns user timezone
5. ✅ PUT /api/timezones/user - Updates timezone successfully
6. ✅ PUT /api/timezones/user - Timezone persists
7. ✅ PUT /api/timezones/user - Rejects invalid timezone
8. ✅ PUT /api/timezones/user - Rejects missing field
9. ✅ GET /api/timezones/user - Requires authentication
10. ✅ Auth token includes timezone claim
11. ✅ Multiple timezone updates handled
12. ✅ Response headers correct
13. ✅ API responds quickly (<5s)

**Run:** `npm test -- phase-1a-timezone-api.spec.js`

---

### Suite 2: UI Tests (`phase-1a-timezone-ui.spec.js`)
**15 tests - Duration: 10-15 minutes**

Tests the TimezoneSelector component and UI interactions:

1. ✅ TimezoneSelector renders
2. ✅ Dropdown loads with 30+ options
3. ✅ Default timezone selected
4. ✅ Can select different timezone
5. ✅ Timezone persists after save
6. ✅ Timezone stored in localStorage
7. ✅ AuthContext contains timezone
8. ✅ Timezone header in API requests
9. ✅ Timezone selector label visible
10. ✅ Multiple timezone changes handled
11. ✅ Timezone updates real-time
12. ✅ Timezone set after login
13. ✅ Timezone cleared on logout
14. ✅ Responsive on mobile
15. ✅ Keyboard accessible

**Run:** `npm test -- phase-1a-timezone-ui.spec.js`

---

### Suite 3: Integration Tests (`phase-1a-timezone-integration.spec.js`)
**12 tests - Duration: 10-15 minutes**

Tests end-to-end workflows and cross-feature integration:

1. ✅ Complete update flow (select → API → persist → verify)
2. ✅ Timezone header in all API calls
3. ✅ Timezone in user profile data
4. ✅ Consistency across page navigations
5. ✅ Valid timezone format acceptance
6. ✅ Date display integration
7. ✅ Concurrent timezone updates
8. ✅ Persistence through logout/login
9. ✅ Error handling for invalid inputs
10. ✅ Works with different user roles
11. ✅ Timezone list caching
12. ✅ No interference with other features

**Run:** `npm test -- phase-1a-timezone-integration.spec.js`

---

## 🎬 Test Execution Modes

### Mode 1: Standard Test Run
```bash
npm test -- phase-1a-timezone
```
- Runs all tests in headless mode
- Generates HTML report
- Captures screenshots on failure
- Captures video on failure
- Total time: 25-40 minutes

---

### Mode 2: Interactive UI Mode (Recommended for Development)
```bash
npm run test:ui -- phase-1a-timezone
```
- Opens Playwright Test UI
- Run individual tests
- Step through test execution
- Visual debugging
- Great for development/debugging

**Features:**
- Click to run/re-run tests
- Watch test execution
- Inspect elements
- Pause execution
- View logs in real-time

---

### Mode 3: Debug Mode (Recommended for Debugging)
```bash
npm run test:debug -- phase-1a-timezone
```
- Opens Playwright Inspector
- Step through code line by line
- Inspect DOM elements
- Check network requests
- Debug JavaScript execution

**How to use:**
1. Run command above
2. Inspector window opens
3. Click "Step over" to advance
4. View elements in Preview pane
5. Check console for logs

---

### Mode 4: Headed Mode (See Browser)
```bash
npm run test:headed -- phase-1a-timezone
```
- Run tests with visible browser
- Watch test interactions
- See page state
- Useful for visual verification
- Slower but visible debugging

---

### Mode 5: Single Test Execution
```bash
npm test -- --grep "TimezoneSelector component should render"
```
- Run one specific test
- Useful for quick testing
- Faster feedback loop
- Good for isolated debugging

---

### Mode 6: Run Specific File
```bash
npm test -- phase-1a-timezone-api.spec.js
```
- Run one test file
- All 13 tests in that file execute
- Total time: 5-10 minutes

---

## 📊 View Test Results

### HTML Report
```bash
npm run test:report
```
- Opens interactive HTML report
- Shows pass/fail status
- Displays screenshots on failure
- Shows video on failure
- Lists execution timeline

### JSON Results
```bash
cat test-results.json
```
- Machine-readable results
- Detailed test metrics
- Can be parsed by CI/CD

---

## 🔧 Configuration

### Configuration File
Located at: `frontend/playwright.config.js`

Key settings:
```javascript
- testDir: './tests'
- testMatch: '**/*.spec.js'
- timeout: 60000 (60 seconds per test)
- expect.timeout: 10000 (10 seconds per assertion)
- baseURL: 'https://uppalcrm-frontend-devtest.onrender.com'
- workers: 1 (sequential execution)
```

### Modify for Your Needs
```bash
# Increase timeout if needed
timeout: 120000 (120 seconds)

# Enable parallel execution (careful)
workers: 4

# Change base URL
baseURL: 'your-url-here'

# Disable video capture
video: 'off'
```

---

## 🔑 Required Credentials

Tests use default staging credentials:
```
Email: admin@staging.uppalcrm.com
Password: staging123
```

**Change in test files if needed:**
- Open test file
- Find `login(page, email, password)` function
- Update email/password parameters
- Save and re-run tests

---

## 📈 Expected Results

### Success Scenario
```
✓ 40 passed (40 passed, 0 failed, 0 skipped)
  phase-1a-timezone-api.spec.js (13)
  phase-1a-timezone-ui.spec.js (15)
  phase-1a-timezone-integration.spec.js (12)
Total: 40 tests
Duration: 25-40 minutes
```

### Partial Results Example
```
✓ 38 passed
✗ 2 failed
  - phase-1a-timezone-ui.spec.js:5 - TimezoneSelector renders
  - phase-1a-timezone-integration.spec.js:3 - Timezone in user profile

Duration: 35 minutes
Report: playwright-report/index.html
```

---

## 🐛 Troubleshooting

### Issue: Tests Timeout
**Solution:**
```bash
# Increase timeout in playwright.config.js
timeout: 120000

# Or for specific test
test.setTimeout(120000)

# Run again
npm test -- phase-1a-timezone
```

### Issue: Selector Not Found
**Solution:**
1. Run in debug mode: `npm run test:debug`
2. Inspect element in browser DevTools
3. Update selector in test file
4. Re-run test

### Issue: Login Fails
**Solution:**
1. Verify credentials are correct
2. Test login manually in browser
3. Check if login page structure changed
4. Review error message in test report

### Issue: API Connection Error
**Solution:**
1. Verify backend is running
2. Check if API endpoint is correct
3. Test API with curl: `curl https://api-url/timezones`
4. Verify network connectivity

### Issue: Flaky Tests (Intermittent Failures)
**Solution:**
1. Add explicit waits: `await page.waitForLoadState('networkidle')`
2. Increase timeout for flaky assertions
3. Use try-catch if appropriate
4. Run multiple times to confirm

---

## 📝 Test Output Examples

### Successful Run Output
```
✓ phase-1a-timezone-api.spec.js (13 tests)
  ✓ GET /api/timezones - Should return all available timezones
  ✓ GET /api/timezones - Should include default America/New_York timezone
  ✓ GET /api/timezones - Should include international timezones
  ✓ GET /api/timezones/user - Should return current user timezone
  ✓ PUT /api/timezones/user - Should successfully update user timezone
  ... (8 more)

✓ phase-1a-timezone-ui.spec.js (15 tests)
  ✓ TimezoneSelector component should render on settings page
  ✓ Timezone dropdown should load and display options
  ... (13 more)

✓ phase-1a-timezone-integration.spec.js (12 tests)
  ✓ Complete flow: Select timezone -> API update -> Persistence
  ... (11 more)

✅ 40 passed (26m 45s)
```

### Failed Run Output
```
✗ phase-1a-timezone-ui.spec.js:2
  TimezoneSelector component should render on settings page

  Error: Timeout waiting for element '.timezone-selector' (30000ms)

  at /c/Users/uppal/.../phase-1a-timezone-ui.spec.js:line 45

  Screenshot: playwright-report/[hash]/screenshot.png
  Video: test-results/[hash]/video.webm
```

---

## 🎓 Running Tests in CI/CD

### GitHub Actions Example
```yaml
name: Playwright Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run test -- phase-1a-timezone
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

### Running in CI
```bash
CI=true npm test -- phase-1a-timezone
```
- Runs with retries (2x)
- Captures artifacts on failure
- Fails job if tests fail

---

## 📚 Additional Resources

### Playwright Documentation
- Website: https://playwright.dev
- API: https://playwright.dev/docs/api/class-playwright
- Guides: https://playwright.dev/docs/intro

### Project Files
- Config: `frontend/playwright.config.js`
- Tests: `frontend/tests/`
- Report: `frontend/playwright-report/` (generated)
- Results: `frontend/test-results.json` (generated)

---

## ✅ Pre-Test Checklist

Before running tests, verify:
- [ ] Devtest environment is running
- [ ] Database migration completed
- [ ] Backend API is accessible
- [ ] Frontend is deployed
- [ ] Playwright installed: `npm list @playwright/test`
- [ ] Test credentials valid
- [ ] No VPN/proxy interfering
- [ ] Internet connection stable

---

## 🚀 Run Tests Now

### Quick Start Command
```bash
cd frontend
npm test -- phase-1a-timezone
```

### Expected Duration: 25-40 minutes

### View Report After
```bash
npm run test:report
```

---

## Summary

✅ **40 comprehensive tests ready**
✅ **3 different test suites**
✅ **Multiple execution modes**
✅ **Full debug capabilities**
✅ **Complete documentation**

**Next Step:** Run the tests!

```bash
cd frontend && npm test -- phase-1a-timezone
```

---
