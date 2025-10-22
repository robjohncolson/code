# Test Suite Documentation

## Overview

This test suite provides comprehensive coverage for the AP Statistics Consensus Quiz application, including both frontend and backend components.

**Test Infrastructure:** P10 Implementation (2024-10-22)

---

## Architecture

### Frontend Tests (Browser-based)
- **Framework:** QUnit 2.20.0 (CDN-loaded, zero-build)
- **Runner:** Playwright (headless Chrome)
- **Coverage:** c8
- **Execution:** Browser environment (real DOM)

### Backend Tests (Node.js)
- **Framework:** Jest 29.7 (ES modules)
- **HTTP Testing:** Supertest
- **Coverage:** @vitest/coverage-v8
- **Execution:** Node.js environment

---

## Running Tests

### Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm run test:all

# Run frontend tests only
npm run test:frontend

# Run backend tests only
npm run test:backend

# Run with coverage
npm run test:frontend:coverage
npm run test:backend:coverage
```

### Frontend Tests (Detailed)

```bash
# Run in headless mode (CI)
npm run test:frontend

# Run with browser visible
npm run test:frontend:headed

# Run with coverage report
npm run test:frontend:coverage
```

**Manual Testing in Browser:**
1. Start local server: `npm run serve`
2. Open browser: `http://localhost:8000/test/index.html`
3. View test results in browser

### Backend Tests (Detailed)

```bash
# Run tests
cd railway-server
npm test

# Run with coverage
npm run test:coverage

# Watch mode (development)
npm run test:watch
```

---

## Test Files

### Frontend Tests

| File | Coverage | Description |
|------|----------|-------------|
| `data_manager.test.js` | Data Manager | localStorage, migrations, persistence |
| `chart_adapter.test.js` | Chart Adapters | Data transformations, Chart.js compatibility |
| `curriculum_loader.test.js` | Lazy Loading | Chunk loading, caching, fallback |

### Backend Tests

| File | Coverage | Description |
|------|----------|-------------|
| `railway-server/tests/api.test.js` | REST API | Profiles, answers, votes, progress |
| `railway-server/tests/cache.test.js` | Cache Logic | TTL, hit rate, query reduction |
| `railway-server/tests/websocket.test.js` | WebSocket | Connections, presence, broadcasting |

---

## Test Fixtures

Test data located in `test/fixtures/`:

- **progress_data.json** - Sample progress data (minimal, typical, multiWeek, edgeCases)
- **units_metadata.json** - Course units structure

**Usage in tests:**
```javascript
const response = await fetch('/test/fixtures/progress_data.json');
const fixtures = await response.json();
const testData = fixtures.typical;
```

---

## Mocks

### Frontend Mocks

Located in `test/mocks/`:

**mock_storage.js** - Mock localStorage
```javascript
const mockStorage = new MockStorage();
mockStorage.setItem('key', 'value');
mockStorage.getItem('key'); // 'value'
```

**mock_chart.js** - Mock Chart.js
```javascript
const chart = new Chart(ctx, config);
Chart.validateConfig(config); // Check validity
```

**mock_supabase.js** - Mock Supabase Client
```javascript
const supabase = new MockSupabaseClient();
supabase.setData('answers', mockAnswers);
await supabase.from('answers').select();
```

### Backend Mocks

Mocks are inline in test files using Jest mocking:
```javascript
vi.mock('@supabase/supabase-js');
vi.mock('ws');
```

---

## Coverage Targets

### Frontend
- **Data Manager:** 80%+ line coverage
- **Chart Adapters:** 75%+ line coverage
- **Curriculum Loader:** 70%+ line coverage

### Backend
- **Routes:** 75%+ line coverage
- **Controllers:** 75%+ line coverage
- **Middleware:** 70%+ line coverage

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]

jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:frontend

  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd railway-server && npm install
      - run: cd railway-server && npm test
```

---

## Writing New Tests

### Frontend Test Template

```javascript
QUnit.module('MyModule', (hooks) => {
    let mockStorage;
    let mockStorageHelper;

    hooks.beforeEach(() => {
        mockStorageHelper = window.TestUtils.mockLocalStorage();
        mockStorage = mockStorageHelper.mock;
    });

    hooks.afterEach(() => {
        mockStorageHelper.restore();
    });

    QUnit.test('my test case', (assert) => {
        // Arrange
        const expected = 'value';

        // Act
        mockStorage.setItem('key', expected);
        const actual = mockStorage.getItem('key');

        // Assert
        assert.strictEqual(actual, expected, 'Storage works');
    });
});
```

### Backend Test Template

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';

describe('MyEndpoint', () => {
    beforeEach(() => {
        // Setup
    });

    it('should do something', async () => {
        const response = await request(app)
            .get('/api/my-endpoint')
            .expect(200);

        expect(response.body).toHaveProperty('data');
    });
});
```

---

## Test Utilities

### TestUtils (Frontend)

Located in `test/test_utils.js`:

**Cloning:**
```javascript
const clone = TestUtils.clone(originalObject);
```

**Waiting:**
```javascript
await TestUtils.wait(1000); // Wait 1 second
```

**Assertions:**
```javascript
TestUtils.assertArrayEqual(actual, expected, 'Arrays match');
TestUtils.assertHasKeys(obj, ['key1', 'key2'], 'Has keys');
TestUtils.assertDateRecent(dateStr, 60, 'Within 60s');
```

**Mock Data Generation:**
```javascript
const progressData = TestUtils.generateMockProgressData({
    questionCount: 10,
    units: [1, 2, 3]
});
```

---

## Debugging Tests

### Frontend Debugging

**Browser Console:**
```javascript
// Enable verbose logging
localStorage.setItem('testDebug', 'true');

// View test results
window.getTestResults();
```

**Chrome DevTools:**
1. Open `http://localhost:8000/test/index.html`
2. Open DevTools (F12)
3. Set breakpoints in test files
4. Reload page to debug

### Backend Debugging

**Node.js Debugger:**
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

**VS Code Launch Config:**
```json
{
    "type": "node",
    "request": "launch",
    "name": "Jest Tests",
    "program": "${workspaceFolder}/railway-server/node_modules/.bin/jest",
    "args": ["--runInBand"],
    "cwd": "${workspaceFolder}/railway-server"
}
```

---

## Performance Testing

### Cache Performance Test

Tests validate >90% Supabase query reduction:

```javascript
// Simulates 30 clients over 60 seconds
// Expected: ~4 Supabase queries (with 30s TTL cache)
// Without cache: 360 queries
// Reduction: >90%
```

### WebSocket Scalability Test

Tests 100 concurrent connections with 1000 messages/sec throughput.

---

## Troubleshooting

### Frontend Tests

**Issue:** Tests fail with "localStorage not defined"
- **Solution:** Tests run in browser environment, not Node.js. Use Playwright or open test/index.html

**Issue:** Mock Chart.js not working
- **Solution:** Load mock_chart.js before chart_adapter.test.js in test/index.html

**Issue:** Fetch fails to load fixtures
- **Solution:** Ensure server is running on port 8000

### Backend Tests

**Issue:** Tests fail with ESM import errors
- **Solution:** Ensure "type": "module" in package.json and use .js extensions

**Issue:** Supabase connection errors
- **Solution:** Tests should use mocks, not real Supabase. Check mock setup

**Issue:** Port already in use
- **Solution:** Change PORT in test setup or kill existing process

---

## Test Coverage Reports

### Viewing Coverage

**Frontend:**
```bash
npm run test:frontend:coverage
# Open: coverage/index.html
```

**Backend:**
```bash
cd railway-server
npm run test:coverage
# Open: coverage/index.html
```

### Coverage Enforcement

Tests fail if coverage drops below thresholds (set in package.json).

---

## Best Practices

1. **Isolation:** Each test should be independent
2. **Mocking:** Mock external services (Supabase, network calls)
3. **Assertions:** Use specific assertions (strictEqual, not just ok)
4. **Cleanup:** Always clean up in afterEach hooks
5. **Naming:** Descriptive test names ("should X when Y")
6. **Edge Cases:** Test null, undefined, empty, and malformed data
7. **Performance:** Keep tests fast (<100ms per test)
8. **Documentation:** Comment complex test logic

---

## Contributing

When adding new features:
1. Write tests first (TDD)
2. Ensure coverage meets targets
3. Run full test suite before committing
4. Update this README if adding new test types

---

## References

- [QUnit Documentation](https://qunitjs.com/)
- [Playwright Documentation](https://playwright.dev/)
- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)

---

**Test Suite Version:** 1.0
**Last Updated:** 2024-10-22 (P10 Implementation)
