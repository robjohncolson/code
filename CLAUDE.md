# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AP Statistics Consensus Quiz web application - an educational tool designed for collaborative learning in statistics classes. The app allows students to answer quiz questions, see peer responses in real-time, vote on answers, and earn badges, creating a consensus-based learning environment.

## Architecture

### Core Application Structure

The application is a client-side web app with optional server-side synchronization:

- **Frontend**: Pure JavaScript, HTML, CSS (no build step required)
- **Data Storage**: LocalStorage with optional Supabase cloud sync
- **Real-time Sync**: Railway server (Node.js) acting as a caching proxy to Supabase
- **Visualization**: Chart.js for data visualization, Canvas API for sprite animations

### Key Components

1. **Quiz System** (`index.html`, `js/auth.js`, `data/curriculum.js`, `data/units.js`)
   - Questions embedded directly in JavaScript files
   - Progressive disclosure onboarding for new/returning students
   - Username generation system (Fruit_Animal format)

2. **Data Synchronization** - Three distinct modes:
   - **Local-only mode**: Uses localStorage for offline functionality (no cloud sync)
   - **Turbo Mode** (Supabase Direct): Direct connection to Supabase for real-time sync
   - **Railway Mode**: Caching proxy that reduces Supabase queries by 95% with WebSocket support
   - Configuration in `supabase_config.js`, `railway_config.js`, and `railway_client.js`

3. **Sprite Animation System** (`js/sprite_*.js`, `js/canvas_engine.js`)
   - Interactive sprite characters for user representation
   - Real-time multiplayer sprite visualization
   - Canvas-based rendering engine with entity management

4. **Social Features**
   - **Voting System**: Students can vote on peer answers
   - **Badge System**: Achievements for participation and consensus
   - **Presence Tracking**: Real-time online/offline status (Railway mode only)
   - **User Activity**: Tracks current question being viewed/answered

## Development Commands

### Local Development

```bash
# No build step required - serve static files directly
# Use any static file server, for example:
python -m http.server 8000
# or
npx http-server
```

### Railway Server Development

```bash
cd railway-server
npm install           # Install dependencies
npm start            # Start production server
npm run dev          # Start with auto-reload (Node 18+ required)
```

### Testing Server Endpoints

```bash
# Health check
curl http://localhost:3000/health

# Get peer data
curl http://localhost:3000/api/peer-data

# Get question statistics
curl http://localhost:3000/api/question-stats/U1-L3-Q01
```

## Configuration

### Enabling Turbo Mode (Supabase Sync)

1. Edit `supabase_config.js`:
   - Set `SUPABASE_URL` to your Supabase project URL
   - Set `SUPABASE_ANON_KEY` to your public anon key

2. Run the SQL schema (from `supabase_schema.sql`) in your Supabase SQL editor

### Enabling Railway Server

1. Deploy the `railway-server` directory to Railway.app (see `railway-server/README.md`)
2. Set environment variables in Railway:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `PORT` (Railway sets automatically)
3. Edit `railway_config.js`:
   - Set `USE_RAILWAY = true`
   - Set `RAILWAY_SERVER_URL` to your deployed server URL

**Railway Integration Details:**
- `railway_client.js` automatically loads when `USE_RAILWAY = true`
- Patches global functions to route through Railway server
- WebSocket connects for real-time updates and presence tracking
- Falls back to direct Supabase if Railway server is unavailable
- Presence system tracks online users with 45-second TTL

## Data Flow

### Without Railway Server
- Each student queries Supabase directly (30 students × 12 queries/hour = 360 queries/hour)
- 5-minute polling intervals for peer data updates

### With Railway Server
- Server queries Supabase once and caches (12 queries/hour total)
- WebSocket connections for instant updates to all clients
- 30-second cache TTL for frequently accessed data

## File Organization

```
/
├── index.html                 # Main application entry point (large, ~300KB)
├── css/styles.css            # Application styles
├── data/
│   ├── curriculum.js         # Quiz questions database (embedded questions)
│   └── units.js             # Course units structure and topic metadata
├── js/
│   ├── auth.js              # User authentication and session management
│   ├── data_manager.js      # Data persistence and synchronization
│   ├── charts.js            # Chart.js visualizations (two-phase rendering)
│   ├── charthelper.js       # Chart configuration helpers
│   ├── canvas_engine.js     # Sprite animation engine (entity-based)
│   ├── sprite_manager.js    # Sprite lifecycle management
│   ├── sprite_sheet.js      # Sprite sheet handling
│   └── entities/            # Sprite entity classes
│       ├── player_sprite.js
│       └── peer_sprite.js
├── railway-server/          # Node.js caching server
│   ├── server.js           # Express + WebSocket server
│   ├── package.json        # Node dependencies (ES modules)
│   └── README.md           # Deployment and API documentation
├── railway_client.js       # Railway WebSocket client integration
├── supabase_config.js      # Supabase credentials
├── railway_config.js       # Railway server toggle
└── docs/
    ├── supabase_schema.sql # Database schema reference
    └── *.csv               # Analysis/export files
```

## Key Architectural Patterns

### Two-Phase Chart Rendering
Charts use a two-phase approach to avoid timing issues:
1. **Phase 1**: `getChartHtml()` generates HTML with canvas element
2. **Phase 2**: `renderChartNow()` draws chart after canvas is in DOM
This prevents "canvas not found" errors common in dynamic UIs.

### Module Dependencies
JavaScript files have specific load order dependencies (no module bundler):
- `auth.js` depends on `data_manager.js` (needs `initClassData()`, `initializeProgressTracking()`)
- `railway_client.js` patches global functions from other modules at runtime
- All modules use global namespace (no ES modules in frontend)

### Data Migration Pattern
The `data_manager.js` includes migration logic for backward compatibility:
- Checks for missing fields in user data (e.g., `currentActivity`)
- Auto-migrates localStorage data on load
- Logs migrations to console for debugging

### Sprite Entity System
The canvas engine uses an entity-component pattern:
- `CanvasEngine` manages entity lifecycle (add/remove/update/render)
- Entities implement callbacks: `onAdded()`, `onRemoved()`, `onResize()`, `update(dt)`, `render(ctx)`
- Ground plane is calculated at 50px from bottom in CSS pixel space
- High DPI support via `devicePixelRatio` scaling

## Important Considerations

1. **No Build Process**: This is a static site - no webpack, no transpilation needed
2. **Progressive Enhancement**: Works offline-first, cloud sync is optional
3. **Educational Focus**: Designed for classroom use with intentionally simple auth (no passwords)
4. **Real-time Features**: WebSocket support through Railway server for instant updates
5. **Data Privacy**: Uses anonymous usernames (Fruit_Animal format), no personal data collected
6. **Large HTML File**: `index.html` is ~300KB due to embedded quiz questions and inline JavaScript

## Database Schema

When using Supabase, the app expects these tables (see `docs/supabase_schema.sql`):
- `answers`: Student quiz responses (composite primary key: username, question_id)
- `votes`: Peer voting system (question_id, voter_username, target_username)
- `badges`: Achievement tracking (badge_type, username, earned_date)
- `user_activity`: Real-time presence tracking (activity_state, question_id, timestamp)
- Real-time subscriptions enabled for instant updates via Supabase channels

## Deployment

The app can be deployed to any static hosting service (GitHub Pages, Netlify, Vercel, etc.). The Railway server component requires Node.js hosting (Railway.app, Heroku, etc.).