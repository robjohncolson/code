# Contributing to AP Statistics Consensus Quiz

Thank you for your interest in contributing! This document provides guidelines and best practices for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Security Guidelines](#security-guidelines)
- [Review Process](#review-process)

## Code of Conduct

This project is designed for educational use in AP Statistics classrooms. Please:

- Be respectful and constructive in discussions
- Focus on what is best for students and educators
- Welcome newcomers and help them get started
- Report inappropriate behavior to project maintainers

## Getting Started

### Prerequisites

- Node.js 18+
- Git
- A code editor (VS Code recommended)
- Basic understanding of JavaScript, HTML, CSS

### Fork and Clone

```bash
# 1. Fork the repository on GitHub

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/apstats-consensus-quiz.git
cd apstats-consensus-quiz

# 3. Add upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/apstats-consensus-quiz.git

# 4. Install dependencies
npm install
cd railway-server && npm install && cd ..
```

### Set Up Development Environment

```bash
# Install pre-commit hooks
npm run prepare

# Verify everything works
npm run validate
npm test
```

### Run Development Server

```bash
# Frontend (static server)
npm run serve
# Open http://localhost:8000

# Backend (Railway server)
cd railway-server
npm run dev
# Server runs on http://localhost:3000
```

## Development Workflow

### 1. Create a Feature Branch

Always work on a feature branch, never directly on `main`:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

**Branch naming conventions:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or fixes
- `perf/` - Performance improvements

### 2. Make Your Changes

- Follow the [Code Style Guidelines](#code-style-guidelines)
- Write tests for new functionality
- Update documentation as needed
- Keep commits focused and atomic

### 3. Test Your Changes

```bash
# Run linting
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Check formatting
npm run format:check

# Run all tests
npm test

# Run specific test suites
npm run test:frontend
npm run test:backend
```

### 4. Commit Your Changes

```bash
# Stage changes
git add .

# Commit with conventional commit message
git commit -m "feat: add new badge for consensus building"
```

See [Commit Message Guidelines](#commit-message-guidelines) for details.

### 5. Keep Your Branch Updated

```bash
# Fetch latest changes
git fetch upstream

# Rebase on main
git rebase upstream/main

# Or merge if you prefer
git merge upstream/main
```

### 6. Push and Create Pull Request

```bash
# Push to your fork
git push origin feature/your-feature-name

# Create PR on GitHub
# Use the PR template that auto-fills
```

## Code Style Guidelines

### JavaScript Style

We use ESLint and Prettier for consistent code style:

```javascript
// ✅ Good
function calculateConsensus(answers) {
    const total = answers.length;
    const grouped = answers.reduce((acc, answer) => {
        acc[answer.value] = (acc[answer.value] || 0) + 1;
        return acc;
    }, {});

    return Object.entries(grouped).map(([value, count]) => ({
        value,
        percentage: (count / total) * 100
    }));
}

// ❌ Bad - inconsistent style, no clarity
function calculateConsensus(answers){
  var total=answers.length
  var grouped={}
  for(var i=0;i<answers.length;i++){
    grouped[answers[i].value]=(grouped[answers[i].value]||0)+1
  }
  return grouped
}
```

**Key rules:**
- Use 4 spaces for indentation
- Single quotes for strings
- Semicolons required
- 100 character line length
- Use `const` and `let`, not `var`
- Use arrow functions for callbacks
- Use template literals for string concatenation

### HTML/CSS Style

```html
<!-- ✅ Good - semantic HTML, clear structure -->
<section class="quiz-container">
    <h2 class="quiz-title">Question 1</h2>
    <form class="answer-form" onsubmit="handleSubmit(event)">
        <label for="answer-input">Your Answer:</label>
        <input id="answer-input" type="text" name="answer" required>
        <button type="submit">Submit</button>
    </form>
</section>
```

```css
/* ✅ Good - organized, readable */
.quiz-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
}

.quiz-title {
    font-size: 24px;
    font-weight: bold;
    margin-bottom: 16px;
}
```

### File Naming

- Use kebab-case for files: `data-manager.js`, `sprite-sheet.js`
- Use PascalCase for classes: `PlayerSprite`, `ChartHelper`
- Use camelCase for functions: `calculateConsensus`, `renderChart`

### Comments and Documentation

```javascript
/**
 * Calculates consensus percentage for a given question
 * @param {Array<Object>} answers - Array of answer objects
 * @param {string} answers[].value - The answer value (A, B, C, D)
 * @param {string} answers[].username - Student username
 * @returns {Array<Object>} Consensus data with percentages
 * @example
 * const consensus = calculateConsensus([
 *     { value: 'A', username: 'Apple_Lion' },
 *     { value: 'B', username: 'Banana_Bear' }
 * ]);
 * // Returns: [{ value: 'A', percentage: 50 }, { value: 'B', percentage: 50 }]
 */
function calculateConsensus(answers) {
    // Implementation
}
```

**When to comment:**
- Complex algorithms or business logic
- Non-obvious workarounds or browser hacks
- Public API functions (use JSDoc)
- Regular expressions (explain pattern)

**When NOT to comment:**
- Obvious code (e.g., `// increment counter`)
- Version control info (Git handles this)
- Commented-out code (delete it instead)

## Testing Requirements

All contributions must include appropriate tests.

### Frontend Tests (Playwright)

```javascript
// test/e2e/quiz-flow.test.js
import { test, expect } from '@playwright/test';

test.describe('Quiz Flow', () => {
    test('should submit answer and see confirmation', async ({ page }) => {
        // Navigate to quiz
        await page.goto('http://localhost:8000');

        // Submit answer
        await page.fill('#answer-input', 'B');
        await page.click('button[type="submit"]');

        // Verify confirmation
        await expect(page.locator('.success-message')).toBeVisible();
    });
});
```

### Backend Tests (Jest)

```javascript
// railway-server/tests/api.test.js
import { describe, test, expect } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';

describe('POST /api/answers', () => {
    test('should submit answer with valid JWT', async () => {
        const response = await request(app)
            .post('/api/answers')
            .set('Authorization', `Bearer ${validToken}`)
            .send({
                question_id: 'U1-L1-Q01',
                answer_value: 'B'
            });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('answer_id');
    });
});
```

### Test Coverage Requirements

- **Backend**: Minimum 75% coverage (branches, functions, lines)
- **Frontend**: Test all user-facing features
- **Critical paths**: 100% coverage for auth, data sync, voting

### Running Tests

```bash
# Run all tests
npm test

# Frontend only
npm run test:frontend

# Backend with coverage
npm run test:backend:coverage

# Watch mode (auto-run on changes)
npm run test:backend:watch

# Headed mode (see browser)
npm run test:frontend:headed
```

## Pull Request Process

### Before Creating PR

- [ ] All tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Formatting checked (`npm run format:check`)
- [ ] Documentation updated (if needed)
- [ ] No PII in logs (verified with ESLint rules)
- [ ] Branch is up to date with `main`

### Creating the PR

1. Push your branch to your fork
2. Go to GitHub and click "New Pull Request"
3. Fill out the PR template completely
4. Link related issues (e.g., "Fixes #123")
5. Add appropriate labels (bug, enhancement, documentation, etc.)
6. Request review from maintainers

### PR Template Checklist

The PR template includes these sections:
- **Description** - What changes does this PR make?
- **Type of Change** - Bug fix, feature, docs, etc.
- **Changes Made** - Specific list of changes
- **Testing** - What tests did you run?
- **Performance Impact** - Does this affect performance?
- **Security Considerations** - Any security implications?

**Fill out ALL sections.** Incomplete PRs may be closed.

### PR Title Format

Use conventional commits format:

```
feat: add real-time voting notifications
fix: correct consensus calculation for tied answers
docs: update API documentation for WebSocket events
refactor: simplify chart rendering logic
test: add integration tests for badge system
perf: optimize sprite rendering with requestAnimationFrame
```

## Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, missing semicolons, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

### Scope (Optional)

- `auth`: Authentication system
- `sync`: Data synchronization
- `charts`: Chart visualization
- `sprites`: Sprite animation
- `api`: REST API or WebSocket
- `ci`: CI/CD pipeline

### Examples

```bash
# Feature
git commit -m "feat(auth): add JWT token refresh endpoint"

# Bug fix
git commit -m "fix(charts): prevent canvas not found error on chart render"

# Documentation
git commit -m "docs: add deployment guide for Railway"

# Performance
git commit -m "perf(sync): reduce Supabase queries by 97% with caching"

# Breaking change
git commit -m "feat(api)!: migrate to REST API v2.0

BREAKING CHANGE: Legacy endpoints moved to /legacy/* path"
```

## Security Guidelines

### COPPA/FERPA Compliance

**CRITICAL:** This app is used by minors. Never collect or log PII.

```javascript
// ❌ BAD - Never log usernames or identifiable info
console.log('User John_Doe submitted answer');
logger.info('Answer from john.doe@school.com');

// ✅ GOOD - Redact PII
logger.info('answer_submitted', {
    questionId: 'U1-L1-Q01',
    username: 'REDACTED'
});
```

### ESLint PII Detection

The project includes ESLint rules to prevent PII:

```javascript
// ❌ BAD - ESLint will error
const email = 'student@school.com';
const username = 'Apple_Lion';  // Fruit_Animal pattern detected

// ✅ GOOD - Use configuration files or environment variables
const email = process.env.ADMIN_EMAIL;
const username = getUsernameFromSession();
```

### Never Commit Secrets

```bash
# ❌ BAD
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ✅ GOOD - Use environment variables
SUPABASE_ANON_KEY=your-anon-key-here
```

### Security Checklist

- [ ] No hardcoded credentials
- [ ] No PII in logs or console
- [ ] Input validation for all user inputs
- [ ] SQL parameterized queries (no string concatenation)
- [ ] CORS configured (no wildcard in production)
- [ ] Rate limiting on API endpoints
- [ ] JWT tokens with expiration

## Review Process

### What Reviewers Look For

1. **Functionality** - Does it work as intended?
2. **Tests** - Are there adequate tests?
3. **Code Quality** - Is it readable and maintainable?
4. **Security** - Are there security concerns?
5. **Performance** - Does it impact performance?
6. **Documentation** - Is it documented?

### Responding to Feedback

- Be open to suggestions and feedback
- Respond to all comments (even if just "done")
- Don't take criticism personally—it makes the code better
- If you disagree, explain your reasoning respectfully
- Update your PR based on feedback
- Re-request review after making changes

### Approval Requirements

- **1 approval** required from maintainers
- All CI checks must pass
- No merge conflicts with `main`
- All conversations resolved

## Common Contribution Scenarios

### Adding a New Feature

1. Check if issue exists; if not, create one
2. Discuss approach in issue before implementing
3. Create feature branch
4. Implement feature with tests
5. Update documentation
6. Create PR with clear description

### Fixing a Bug

1. Create issue describing bug (if not exists)
2. Include reproduction steps
3. Create fix branch
4. Write test that reproduces bug
5. Fix bug (test should now pass)
6. Create PR referencing issue

### Improving Documentation

1. Documentation PRs are always welcome!
2. Follow existing documentation style
3. Use clear, concise language
4. Include code examples where appropriate
5. Check for broken links

### Updating Dependencies

1. Check for breaking changes in changelogs
2. Update `package.json` and `package-lock.json`
3. Run all tests to verify compatibility
4. Update code if API changed
5. Document breaking changes in PR

## Questions?

- Open a [GitHub Discussion](https://github.com/YOUR_USERNAME/apstats-consensus-quiz/discussions)
- Check existing [Issues](https://github.com/YOUR_USERNAME/apstats-consensus-quiz/issues)
- Read [documentation](docs/)

## Thank You!

Your contributions make this project better for AP Statistics students and teachers everywhere. We appreciate your time and effort!

---

**Happy coding, and thank you for helping build collaborative learning tools!**
