# AP Statistics Consensus Quiz

[![CI Status](https://github.com/YOUR_USERNAME/apstats-consensus-quiz/workflows/CI/badge.svg)](https://github.com/YOUR_USERNAME/apstats-consensus-quiz/actions)
[![Code Coverage](https://codecov.io/gh/YOUR_USERNAME/apstats-consensus-quiz/branch/main/graph/badge.svg)](https://codecov.io/gh/YOUR_USERNAME/apstats-consensus-quiz)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

An educational web application that enables collaborative learning in AP Statistics classes through consensus-based quizzes. Students answer questions, see peer responses in real-time, vote on answers, and earn badges—creating an engaging, consensus-based learning environment.

## Key Features

- **Real-time Collaboration** - See peer answers and votes instantly via WebSocket
- **Consensus Building** - Vote on classmate answers to build understanding
- **Offline-First** - Works without internet using localStorage
- **Badge System** - Achievements for participation and learning
- **Progressive Disclosure** - Adaptive onboarding for new/returning students
- **Anonymous Authentication** - Fruit_Animal usernames (COPPA/FERPA compliant)
- **Chart Visualizations** - Interactive data analysis with Chart.js
- **Sprite Animations** - Multiplayer character system with Canvas API
- **Zero Build** - Pure JavaScript, no compilation needed

## Architecture

```
Frontend (Static HTML/JS/CSS)
    ↓
Railway Server (Optional Caching Proxy)
    ↓
Supabase (PostgreSQL + Real-time)
```

**Three Operating Modes:**
1. **Local-only** - localStorage, no cloud sync (offline)
2. **Turbo Mode** - Direct Supabase connection
3. **Railway Mode** - Caching proxy (97% fewer queries, WebSocket updates)

## Quick Start

Get the app running in under 5 minutes:

### 1. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/apstats-consensus-quiz.git
cd apstats-consensus-quiz
npm install
```

### 2. Start Development Server

```bash
# Serve static files (frontend only)
npm run serve
# or
npm run serve:alt
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

**That's it!** The app works in local-only mode with no configuration needed.

### 3. Optional: Enable Cloud Sync

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Supabase and Railway setup.

## Development

### Prerequisites

- Node.js 18+ (for development tools and backend)
- Modern web browser with ES6 support

### Project Structure

```
/
├── index.html                 # Main application (300KB with embedded questions)
├── css/styles.css            # Application styles
├── js/                       # Frontend JavaScript modules
│   ├── auth.js              # Authentication & session management
│   ├── data_manager.js      # Data persistence & sync
│   ├── charts.js            # Chart.js visualizations
│   ├── canvas_engine.js     # Sprite animation engine
│   └── entities/            # Sprite entity classes
├── data/
│   ├── curriculum.js        # Quiz questions database
│   └── units.js             # Course structure & metadata
├── railway-server/          # Node.js caching server (optional)
│   ├── server-new.js       # Express + WebSocket server
│   ├── routes/             # REST API routes
│   ├── controllers/        # Business logic
│   └── tests/              # Backend tests
├── test/                    # Frontend Playwright tests
├── docs/                    # Documentation
└── .github/workflows/       # CI/CD pipelines
```

### Available Scripts

#### Frontend Development

```bash
npm run serve              # Start local dev server (Python)
npm run serve:alt          # Start local dev server (http-server)
```

#### Testing

```bash
npm test                   # Run all tests (frontend + backend)
npm run test:frontend      # Playwright tests
npm run test:backend       # Jest tests (Railway server)
npm run test:frontend:headed  # Playwright with browser UI
npm run test:backend:coverage # Backend with coverage report
```

#### Code Quality

```bash
npm run lint               # Check all JavaScript files
npm run lint:fix           # Auto-fix linting issues
npm run format             # Format all files (Prettier)
npm run format:check       # Check formatting
npm run validate           # Run format check + lint (pre-commit)
```

#### Backend Development

```bash
cd railway-server
npm install               # Install backend dependencies
npm start                # Start production server
npm run dev              # Start with auto-reload (Node 18+)
npm test                 # Run backend tests
```

## Testing

The project includes comprehensive test coverage:

- **Frontend**: 60+ Playwright E2E tests
- **Backend**: 71+ Jest integration tests
- **Total**: 131+ tests across the application

### Run Tests Locally

```bash
# All tests
npm test

# Watch mode (auto-run on file changes)
npm run test:backend:watch

# Coverage reports
npm run test:backend:coverage
```

### Test Structure

```
test/
├── e2e/                  # End-to-end user flows
├── integration/          # Component integration tests
└── unit/                 # Unit tests

railway-server/tests/     # Backend API tests
```

## Configuration

### Enabling Turbo Mode (Direct Supabase)

1. Edit `supabase_config.js`:
   ```javascript
   window.SUPABASE_URL = 'https://your-project.supabase.co';
   window.SUPABASE_ANON_KEY = 'your-anon-key';
   ```

2. Run SQL schema from `docs/supabase_schema.sql` in Supabase SQL Editor

### Enabling Railway Server (Recommended for Production)

1. Deploy `railway-server/` to Railway.app
2. Set environment variables (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md))
3. Edit `railway_config.js`:
   ```javascript
   window.USE_RAILWAY = true;
   window.RAILWAY_SERVER_URL = 'https://your-app.up.railway.app';
   ```

**Railway Benefits:**
- 97% reduction in database queries
- Instant WebSocket updates
- JWT authentication
- Rate limiting & input validation

## CI/CD Pipeline

The project uses GitHub Actions for automated quality checks and deployment:

### Continuous Integration

**Main CI Pipeline** (`.github/workflows/ci.yml`):
- ✅ Lint validation (ESLint + Prettier)
- ✅ Frontend tests (Playwright)
- ✅ Backend tests (Jest with coverage)
- ✅ Build verification
- ✅ Security audit (npm audit, PII scan)
- ✅ Coverage reporting (Codecov)

**PR Checks** (`.github/workflows/pr-check.yml`):
- ✅ Lint only changed files
- ✅ PR title validation (conventional commits)
- ✅ Large file detection (>500KB)
- ✅ Secret pattern detection

### Deployment

**Staging**: Auto-deploy on push to `main` branch
**Production**: Manual trigger or release tag

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for deployment workflows.

## Security & Compliance

### COPPA/FERPA Compliance

- **No PII Collection** - Anonymous Fruit_Animal usernames
- **No Email Required** - Simple username authentication
- **PII Detection** - ESLint rules prevent hardcoded PII
- **Structured Logging** - PII redaction in logs
- **No Tracking** - No analytics or third-party trackers

### Security Features

- JWT authentication with token rotation
- Input validation with express-validator
- Rate limiting (Redis-backed)
- CORS protection
- SQL injection prevention (parameterized queries)
- XSS protection (Content Security Policy)
- Dependency scanning (Dependabot)

## Performance

### Metrics

- **Initial Load**: <3s on 3G connection
- **Time to Interactive**: <2s
- **Lighthouse Score**: 95+ (Performance)
- **Bundle Size**: No bundler needed (static files)
- **Cache Hit Rate**: ~90% with Railway server
- **WebSocket Latency**: <100ms

### Optimizations

- Lazy loading for curriculum data
- Chart rendering with two-phase approach
- LocalStorage caching
- Server-side query caching (30s TTL)
- High DPI canvas scaling

See [docs/PERFORMANCE.md](docs/PERFORMANCE.md) for detailed benchmarks.

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Code style guidelines
- Development workflow
- Testing requirements
- Pull request process

### Quick Contribution Flow

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/apstats-consensus-quiz.git

# 2. Create feature branch
git checkout -b feature/your-feature-name

# 3. Make changes and test
npm run validate    # Lint + format check
npm test           # Run all tests

# 4. Commit with conventional commits
git commit -m "feat: add new badge type for consensus"

# 5. Push and create PR
git push origin feature/your-feature-name
```

## Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - Deployment guide
- [docs/API.md](docs/API.md) - REST API & WebSocket reference
- [docs/PERFORMANCE.md](docs/PERFORMANCE.md) - Performance benchmarks
- [railway-server/README.md](railway-server/README.md) - Backend documentation
- [CLAUDE.md](CLAUDE.md) - AI assistant context

## API Reference

The Railway server provides REST API and WebSocket endpoints:

### REST API

```bash
# Submit answer
POST /api/answers
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "question_id": "U1-L1-Q01",
  "answer_value": "B"
}

# Get peer answers
GET /api/answers/U1-L1-Q01

# Cast vote
POST /api/votes
Authorization: Bearer <jwt_token>

{
  "question_id": "U1-L1-Q01",
  "target_username": "Apple_Lion"
}
```

### WebSocket

```javascript
const ws = new WebSocket('wss://your-server.railway.app');

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    // Handle real-time updates
};
```

See [docs/API.md](docs/API.md) for complete API documentation.

## Troubleshooting

### Common Issues

**Port 8000 already in use:**
```bash
lsof -i :8000  # Find process
kill -9 <PID>  # Kill process
```

**Tests failing:**
```bash
npm install            # Reinstall dependencies
npm run lint:fix       # Fix linting issues
npm test               # Run tests
```

**WebSocket not connecting:**
- Check `railway_config.js` URL
- Verify Railway server is running
- Check browser console for CORS errors

See issue templates in `.github/ISSUE_TEMPLATE/` for bug reports.

## Deployment

### Static Frontend

Deploy to any static hosting:
- **GitHub Pages**: Push to `gh-pages` branch
- **Netlify**: Connect GitHub repo, auto-deploy
- **Vercel**: Import project, deploy
- **Railway**: Static site from root directory

### Railway Server

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for:
- Railway setup guide
- Environment variables
- Health checks
- Rollback procedures

## Monitoring

### Health Check

```bash
curl https://your-server.railway.app/health
```

Response:
```json
{
    "status": "healthy",
    "uptime": 3600,
    "version": "2.0.0"
}
```

### Logs

Railway server uses structured logging with PII redaction:
```javascript
logger.info('answer_submitted', {
    questionId: 'U1-L1-Q01',
    username: 'REDACTED'  // PII automatically redacted
});
```

## Roadmap

- [x] Progressive disclosure onboarding
- [x] Real-time WebSocket sync
- [x] Badge system
- [x] Progress charts
- [x] Performance optimization
- [x] Comprehensive testing
- [x] CI/CD pipeline
- [ ] Teacher dashboard
- [ ] Analytics export
- [ ] Mobile app (PWA)
- [ ] GraphQL API

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Built for AP Statistics educators and students
- Chart.js for data visualization
- Supabase for real-time database
- Railway for deployment platform
- Playwright for testing framework

## Support

- **Bug Reports**: [GitHub Issues](https://github.com/YOUR_USERNAME/apstats-consensus-quiz/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/YOUR_USERNAME/apstats-consensus-quiz/discussions)
- **Documentation**: [docs/](docs/)

---

**Made with care for AP Statistics students and teachers.**

**No build step. No complexity. Just a modern web app that makes learning statistics collaborative and fun!**
