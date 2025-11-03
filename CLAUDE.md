# CLAUDE.md

**Note**: This project uses [bd (beads)](https://github.com/steveyegge/beads) for issue tracking. Use `bd` commands instead of markdown TODOs. See AGENTS.md for workflow details.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **AP Statistics Consensus Quiz** - an educational web application designed for collaborative, real-time learning in AP Statistics classrooms. The app allows students to answer quiz questions, see peer responses in real-time, and participate in consensus-based learning. Features include an interactive chart wizard for creating statistical visualizations, animated sprite representations of active users, and multi-mode data synchronization (offline-first with optional cloud backup).

**Key Educational Value**: Builds statistical thinking through peer consensus, real-time feedback, and interactive data visualization.

## Architecture

### Core Application Structure

The application is a **client-first, server-optional** architecture:

- **Frontend**: Pure JavaScript, HTML, CSS (no build step or compilation required)
- **Data Persistence**: LocalStorage for offline-first functionality
- **Optional Cloud Sync**: Supabase (PostgreSQL) with Railway Node.js server as caching proxy
- **Real-time Features**: WebSocket connections via Railway server
- **Visualization**: Chart.js library + Canvas API for sprite animations
- **Deployment**: Static file hosting (no server required for basic operation)

### Key Components

1. **Quiz System** (`index.html`, `js/auth.js`, `data/curriculum.js`, `data/units.js`)
   - Multiple-choice and free-response questions embedded in JavaScript
   - 9-unit AP Statistics curriculum (Units 1-9) mapped to College Board exam topics
   - Progressive disclosure onboarding for new vs returning students
   - Anonymous username generation (Fruit_Animal format) with 100+ fruit and animal combinations
   - Question hierarchy: Units → Topics → Questions with video/Blooket/PDF resources

2. **Data Management Layer** (`js/data_manager.js`)
   - LocalStorage structure: `classData.users[username]` with answers, reasons, timestamps, attempts, charts
   - Import/export functionality for personal and class-wide backups
   - Data merging logic for combining student and peer data
   - Automatic persistence and quota management
   - Progress tracking and migration for schema updates

3. **Chart Wizard** (`js/chart_wizard.js`, `js/chart_registry.js`, `data/chart_questions.js`)
   - Interactive modal for creating 14 types of statistical charts
   - **Supported chart types**: bar (vertical/horizontal), line, scatter, bubble, radar, polar area, pie, doughnut, histogram, dotplot, boxplot, normal curve, chi-square curve, number line
   - Standard Internal Format (SIF) for chart data serialization
   - Keyboard-friendly UI with Tab navigation and CSV import/paste
   - Chart preview with Chart.js rendering
   - Eligible FRQ questions can have chart responses saved and edited

4. **Real-time Sync System** (`railway_client.js`, `railway-server/server.js`, `supabase_config.js`, `railway_config.js`)
   - **Offline Mode**: Full functionality with localStorage only
   - **Direct Supabase**: Optional connection to Supabase PostgreSQL
   - **Railway Server**: Optional caching proxy reducing query load by 95%
   - WebSocket presence tracking for online user display
   - Automatic fallback if sync servers unavailable
   - Configurable via `railway_config.js` (USE_RAILWAY flag) and `supabase_config.js`

5. **Sprite Animation System** (`js/sprite_manager.js`, `js/canvas_engine.js`, `js/entities/player_sprite.js`, `js/entities/peer_sprite.js`, `js/sprite_sheet.js`)
   - Canvas-based 2D sprite animation engine
   - Player sprite: keyboard-controlled (arrow keys), idle/walk animations, customizable hue
   - Peer sprites: appear when turbo mode active, represent online users
   - Real-time sprite positioning, physics (gravity, jumping)
   - Sprite sheet: PNG with frame-based animation data
   - Game loop with delta-time updates (60 FPS target)

6. **Visualization System** (`js/charts.js`, `js/charthelper.js`)
   - Chart.js wrapper functions for consensus displays
   - Color and theme utilities
   - Real-time consensus calculation (mode/majority)
   - Support for multiple question types and visualization styles

## Development Commands

### Local Development (No Server Required)

```bash
# Option 1: Python
cd /mnt/c/Users/rober/OneDrive/Desktop/code
python -m http.server 8000

# Option 2: Node.js
npx http-server

# Option 3: PHP
php -S localhost:8000
```

Then open `http://localhost:8000/index.html` in browser.

**Key Point**: No build step is required. The app runs directly from source files.

### Railway Server Development

```bash
cd railway-server
npm install                    # Install dependencies (Express, Supabase, WebSocket)
npm start                      # Start production server on port 3000
npm run dev                    # Start with auto-reload (requires Node 18+)
```

Server features:
- REST API endpoints for peer data, answer submission, question statistics
- WebSocket server for real-time updates
- Caching layer for Supabase (30-second TTL)
- Presence tracking (user online/offline events)
- Real-time subscriptions to Supabase changes

### Testing Server Endpoints

```bash
# Health check
curl http://localhost:3000/health

# Get all peer data
curl http://localhost:3000/api/peer-data

# Get question statistics
curl http://localhost:3000/api/question-stats/U1-L3-Q01

# Get server statistics
curl http://localhost:3000/api/stats

# Submit answer
curl -X POST http://localhost:3000/api/submit-answer \
  -H "Content-Type: application/json" \
  -d '{"username":"Apple_Bear","question_id":"U1-L2-Q01","answer_value":"B","timestamp":1234567890}'

# Batch submit
curl -X POST http://localhost:3000/api/batch-submit \
  -H "Content-Type: application/json" \
  -d '{"answers":[...]}'
```

### Utility Scripts

```bash
# Analyze FRQ chart questions and classify by type
node scripts/analyze_frq_charts.js

# Output: docs/analysis/frq_chart_inventory.json
# Useful for understanding which FRQs support chart responses
```

## Configuration

### Supabase (Turbo Mode) Setup

1. Create Supabase project at supabase.com
2. Edit `supabase_config.js`:
   ```javascript
   const SUPABASE_URL = 'https://your-project.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key';
   ```
3. Run schema from `docs/supabase_schema.sql` in Supabase SQL editor:
   - Creates `answers`, `badges`, `user_activity`, `votes` tables
   - Sets up real-time subscriptions
4. App will auto-detect Supabase connection and enable cloud sync

### Railway Server Setup

1. Deploy `railway-server` directory to Railway.app
   - Connect GitHub repository
   - Railway auto-detects Node.js, runs `npm start`
2. Set environment variables in Railway dashboard:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   PORT=3000 (optional, Railway sets automatically)
   ```
3. Edit `railway_config.js`:
   ```javascript
   window.USE_RAILWAY = true;
   window.RAILWAY_SERVER_URL = 'https://your-app.up.railway.app';
   ```
4. App will connect to Railway server on first load

## Data Flow & Sync Architecture

### No Server (Default)
```
Student 1                  Student 2
    ↓                          ↓
  localStorage ←→ (manual export/import)
```
- Full functionality offline
- No peer data visible
- Manual backup/restore via JSON files

### Direct Supabase (Turbo Mode)
```
Student 1  ─┐                      ┌─ Student 2
            ├→ REST API ←→ Supabase ←┤
            └─ (polls every 5 min) ─┘

Queries: 30 students × 12 per hour = 360 queries/hour
Consensus: Calculated client-side
```

### Railway Server (Optimal)
```
Student 1  ─┐                    ┌─ Student 2
            ├→ WebSocket ←→ Railway ←┤
            └─ (real-time)     ↓      ┘
                            Supabase
                            (cached)

Queries: 1 server × 12 per hour = 12 queries/hour (95% reduction)
Cache TTL: 30 seconds
Consensus: Calculated server-side, broadcast to all
Response time: <50ms for cached data
WebSocket latency: <100ms for updates
```

### Data Sync Flow

**Direction**: User answers → localStorage → Railway/Supabase → Peer browsers

1. Student submits answer → `classData.users[username].answers[questionId]`
2. `data_manager.js` saves to localStorage
3. If turbo mode enabled:
   - Via Railway: `POST /api/submit-answer` or `/api/batch-submit`
   - Via direct Supabase: `supabase.from('answers').upsert(...)`
4. Server caches response for 30 seconds
5. WebSocket broadcast: `{ type: 'answer_submitted', ...}` to all connected clients
6. Peers receive update and render new consensus

## File Organization

```
/mnt/c/Users/rober/OneDrive/Desktop/code/
├── index.html                      # Main entry point (7421 lines)
│
├── css/
│   └── styles.css                 # Theme system with CSS variables
│                                   # Light/dark mode support
│
├── data/
│   ├── curriculum.js              # Quiz questions (question-level data)
│   ├── units.js                   # AP Statistics 9-unit curriculum structure
│   └── chart_questions.js         # FRQ chart eligibility mapping
│
├── js/
│   ├── auth.js                    # Username generation and session management (505 lines)
│   ├── data_manager.js            # LocalStorage persistence and import/export (872 lines)
│   ├── charts.js                  # Chart.js visualization helpers (1880 lines)
│   ├── charthelper.js             # Color/theme utilities for charts (44 lines)
│   │
│   ├── chart_wizard.js            # Interactive chart creation modal (3587 lines)
│   │                              # - Type selector with previews
│   │                              # - Data entry (CSV paste, manual rows)
│   │                              # - SIF serialization/deserialization
│   │                              # - Chart rendering and preview
│   │
│   ├── chart_registry.js          # Chart type definitions and renderers (216 lines)
│   │                              # - Bar, line, scatter, bubble, radar, etc.
│   │                              # - Schema for data validation
│   │
│   ├── sif_deserializer.js        # Safe chart parsing and validation (300 lines)
│   │                              # - Validates all 14 chart types
│   │                              # - Schema enforcement
│   │
│   ├── railway_hydration.js       # Railway-based answer hydration (280 lines)
│   │                              # - Fetches user's own answers on load
│   │                              # - Chart-aware merging
│   │
│   ├── session_fallback.js        # Storage fallback system (350 lines)
│   │                              # - localStorage → sessionStorage → memory
│   │                              # - Handles storage-denied scenarios
│   │
│   ├── notifications.js           # User notification system (350 lines)
│   │                              # - Toast notifications
│   │                              # - Storage warnings
│   │
│   ├── canvas_engine.js           # 2D sprite animation engine (79 lines)
│   ├── sprite_manager.js          # Sprite lifecycle and positioning (151 lines)
│   ├── sprite_sheet.js            # Sprite asset loading (35 lines)
│   │
│   └── entities/
│       ├── player_sprite.js       # Current user sprite (interactive, keyboard control)
│       └── peer_sprite.js         # Peer sprites (passive, position-based)
│
├── railway-server/
│   ├── package.json               # Dependencies:
│   │                              # - express@^4.18.2
│   │                              # - @supabase/supabase-js@^2.38.0
│   │                              # - ws@^8.14.2
│   │                              # - dotenv@^16.3.1
│   │                              # - cors@^2.8.5
│   ├── .env.example               # Template for environment variables
│   ├── server.js                  # Express + WebSocket server (522 lines)
│   │                              # REST API endpoints
│   │                              # WebSocket handlers
│   │                              # Caching logic
│   │                              # Presence tracking
│   │
│   └── README.md                  # Server deployment and API docs
│
├── docs/
│   ├── supabase_schema.sql        # PostgreSQL schema reference (48 lines)
│   ├── chart-wizard-usage.md      # Chart wizard user guide
│   ├── pdf-integration-guide.md   # PDF worksheet system
│   ├── sync_diagnostics.js        # Sync debugging utilities
│   │
│   ├── analysis/
│   │   ├── README.md
│   │   ├── frq_chart_inventory.json  # Generated by analyze_frq_charts.js
│   │   ├── frq_chart_inventory.csv   # CSV version for spreadsheet import
│   │   ├── frq_chart_inventory.js    # JS module version
│   │   ├── frq_chart_full_prompts.txt # Full question prompts
│   │   ├── frq_ids_by_type.txt       # Questions grouped by chart type
│   │   └── answers_rows.csv
│   │
│   └── student2username.csv
│
├── scripts/
│   ├── analyze_frq_charts.js      # Node.js script to analyze FRQ types (36KB)
│   └── frq_analysis_results.txt   # Analysis output
│
├── test_chart_persistence.js      # Test script for storage modes
├── test_realtime_charts.js        # Test script for peer chart sharing
│
├── pdf/
│   ├── u2l2.pdf                   # Topic 2.2 worksheet
│   ├── u2l3.pdf                   # Topic 2.3 worksheet
│   ├── u2l4_1.pdf                 # Topic 2.4 worksheet 1
│   └── u2l4_2.pdf                 # Topic 2.4 worksheet 2
│
├── supabase_config.js             # Supabase credentials (9 lines)
├── railway_config.js              # Railway server toggle (12 lines)
├── railway_client.js              # WebSocket client for Railway (400+ lines)
│
├── sprite.png                     # Sprite sheet asset (6.4 KB)
├── map.tex                        # LaTeX map file
│
└── CLAUDE.md                      # This file
```

**Total codebase**: ~20,000 lines of production code + 200+ page API docs

## Important Considerations

1. **No Build Process**: This is a pure static site
   - No webpack, no Babel transpilation, no bundling
   - All files served as-is from filesystem or static host
   - Requires ES6-compatible browser (modern features used: classes, arrow functions, template literals, const/let)

2. **Progressive Enhancement**
   - Works **fully offline** with localStorage
   - Cloud sync is **optional**, app degrades gracefully if unavailable
   - No hard dependency on Supabase or Railway
   - Fallback chain: Railway → Direct Supabase → LocalStorage only

3. **Educational First Design**
   - Simple anonymous auth (no passwords, no email required)
   - Low barrier to entry for classroom use
   - Privacy-conscious: no personal data collected beyond anonymous username
   - Teacher features for managing class data and backups

4. **Real-time Features**
   - WebSocket-based presence tracking (who's online)
   - Instant answer submission to peers (if Railway enabled)
   - Server-side consensus calculation (reduces client load)
   - Automatic fallback to polling if WebSocket unavailable

5. **Responsive Design**
   - Mobile-friendly layout
   - Touch-friendly buttons and modals
   - High-DPI display support (device pixel ratio aware in canvas engine)
   - CSS variables for theme support

6. **Data Structure Philosophy**
   - Dual storage: localStorage + optional cloud
   - Questions stored in `classData.users[username]`
   - Chart wizard stores in Standard Internal Format (SIF)
   - Import/export handles schema migration and data merging

## Database Schema (Supabase)

Required tables when using Turbo Mode (see `docs/supabase_schema.sql`):

```sql
answers (primary key: username, question_id)
├── id (integer, unique)
├── username (text)
├── question_id (text)
├── answer_value (text) -- Can contain stringified chart SIF
├── timestamp (bigint) -- milliseconds since epoch
└── created_at, updated_at (timestamps)

badges (achievement tracking)
├── id (integer, primary key)
├── username (text)
├── badge_type (text)
├── earned_date (bigint)
└── created_at (timestamp)

user_activity (real-time presence)
├── username (text, primary key)
├── activity_state (text) -- idle, viewing, answering, submitted
├── question_id (text, nullable)
├── timestamp (bigint)
└── created_at, updated_at (timestamps)

votes (peer voting system)
├── id (bigint, primary key)
├── question_id (text) -- must not be null
├── voter_username (text) -- must not be null
├── target_username (text) -- must not be null
├── score (smallint)
├── timestamp (timestamp)
└── Unique constraint: (question_id, voter_username, target_username)
```

All tables have real-time subscriptions enabled for instant client updates.

## Data Management Deep Dive

### LocalStorage Structure

```javascript
// Stored as: localStorage.getItem('classData')
{
  users: {
    // [username]: current user's data
    "Apple_Bear": {
      answers: {
        // [questionId]: answer value
        "U1-L2-Q01": "B",
        "U1-L3-Q02": "A",
        "U1-L10-Q04": "{...SIF object...}"  // Chart response
      },
      reasons: {
        // [questionId]: FRQ explanation text
        "U2-L1-FRQ01": "Because the correlation is..."
      },
      timestamps: {
        // [questionId]: submission timestamp (ms)
        "U1-L2-Q01": 1729982400000
      },
      attempts: {
        // [questionId]: number of tries
        "U1-L2-Q01": 1
      },
      charts: {
        // [questionId]: chart SIF (for quick access)
        "U1-L10-Q04": { type: "histogram", ... }
      },
      currentActivity: {
        // Real-time activity state (for sprite system)
        state: "idle",           // idle | viewing | answering | submitted
        questionId: null,        // Current question or null
        lastUpdate: 1729982400000
      }
    }
  }
}
```

### Chart Standard Internal Format (SIF)

```javascript
{
  // Common to all chart types
  type: "bar" | "line" | "scatter" | "bubble" | "radar" | "polarArea" | 
        "pie" | "doughnut" | "histogram" | "dotplot" | "boxplot" | 
        "normal" | "chisquare" | "numberline",
  
  xLabel: "Category",
  yLabel: "Frequency",
  title: "Distribution of Test Scores",
  description: "Shows how many students scored in each range",
  orientation: "vertical" | "horizontal",  // Bar charts only
  
  // Type-specific data
  // --- Bar & Line Charts ---
  series: [{ name: "Group 1", values: [1, 2, 3, ...] }],
  categories: ["A", "B", "C", ...],
  
  // --- Scatter & Bubble ---
  points: [{ x: 1, y: 2, r?: 5, label?: "point1" }, ...],
  
  // --- Radar ---
  categories: ["Jan", "Feb", ...],
  datasets: [{ name: "2023", values: [10, 20, ...] }, ...],
  
  // --- Pie/Doughnut/PolarArea ---
  segments: [{ label: "Category A", value: 45 }, ...],
  
  // --- Histogram ---
  data: {
    bins: [{ label: "0-10", value: 5 }, ...],
    seriesName: "Frequency"
  },
  
  // --- Dotplot ---
  data: {
    values: [1, 2, 2, 3, 3, 3, ...]  // Raw values
  },
  
  // --- Boxplot ---
  data: {
    fiveNumber: {
      min: 10,
      q1: 25,
      median: 50,
      q3: 75,
      max: 100
    }
  },
  
  // --- Normal Curve ---
  data: {
    mean: 100,
    sd: 15,
    shade: "left" | "right" | "both",
    xMin: 70,
    xMax: 130,
    tickInterval: 10
  },
  
  // --- Chi-Square Curve ---
  data: {
    dfList: [1, 4, 6],  // Degrees of freedom
    labels: ["df=1", "df=4", "df=6"]
  },
  
  // --- Number Line ---
  data: {
    ticks: [
      { x: 10, label: "10", bottomLabel: "Min" },
      { x: 50, label: "50", bottomLabel: "Mean" },
      ...
    ],
    xMin: 0,
    xMax: 100
  },
  
  // Metadata
  meta: {
    createdAt: 1729982400000,
    updatedAt: 1729982400000
  }
}
```

### Import/Export System

The `data_manager.js` module provides:

- **`exportPersonalData()`**: Download student's own answers as JSON
- **`importPersonalData(file)`**: Restore from personal backup
- **`exportClassData()`**: Teacher function: combine all student data into class file
- **`importClassData(file)`**: Teacher function: load peer answers for display
- **`mergeData()`**: Intelligent merging of imported data with existing data
- **Auto-export**: Optional feature to save recovery pack to Downloads folder

### Data Persistence Flow

1. Answer submitted → `classData.users[username].answers[questionId]` updated
2. Call `saveClassData()` → `localStorage.setItem('classData', JSON.stringify(classData))`
3. If turbo mode:
   - Call `pushAnswerToSupabase()` via Railway/Supabase
   - Server broadcasts to WebSocket clients
4. If importing class data:
   - Parse JSON → validate structure → merge into `classData`
   - Re-save to localStorage

## Working with the Chart Wizard

### Adding New Chart Types

1. **Register in `js/chart_registry.js`**:
   ```javascript
   {
     key: 'myChart',
     displayName: 'My Chart Type',
     description: 'Describe what it does',
     schema: {
       kind: 'my-data-shape',
       axes: { x: {}, y: {} },
       csv: 'col1,col2'
     },
     renderer: 'myChart',
     defaults: {
       xLabel: 'X Axis',
       yLabel: 'Y Axis'
     }
   }
   ```

2. **Implement renderer in `js/chart_registry.js`**:
   ```javascript
   window.renderMyChart = function(container, sifData) {
     const ctx = container.querySelector('canvas').getContext('2d');
     // Create Chart.js instance with sifData
     new Chart(ctx, {
       type: 'mytype',
       data: {...},
       options: {...}
     });
   };
   ```

3. **Add to PRIMARY_CHART_TYPES or SECONDARY_MULTI_TYPES** in `chart_wizard.js`:
   - Primary: Show in main wizard view
   - Secondary: Show in "more types" section
   - Hidden: Show only if explicitly selected

4. **Validation**: Add schema checks in `validateChartData()` function

### Eligible Questions

FRQ questions that support chart responses are mapped in `data/chart_questions.js`. Use the analyze script to find eligible questions:

```bash
node scripts/analyze_frq_charts.js
```

## Sprite Animation System

### Architecture

The sprite system consists of:

1. **CanvasEngine** (`js/canvas_engine.js`): Game loop, entity management, rendering
2. **SpriteSheet** (`js/sprite_sheet.js`): Asset loading and frame management
3. **SpriteManager** (`js/sprite_manager.js`): Entity lifecycle, positioning logic
4. **PlayerSprite** (`js/entities/player_sprite.js`): Current user (keyboard-controlled)
5. **PeerSprite** (`js/entities/peer_sprite.js`): Other users (position-based from websocket)

### Key Features

- **Physics**: Gravity, jumping, collision with ground
- **Animation States**: idle (with blink), walk, jump, push, death
- **Color Customization**: Hue rotation stored in localStorage
- **Responsive**: Handles window resize, high-DPI displays
- **Real-time Presence**: Shows peers when turbo mode active
- **Keyboard Control**: Arrow keys for movement, Space for jump

### Usage

```javascript
// Initialized automatically in index.html
const engine = new CanvasEngine('spriteCanvas');
const spriteSheet = new SpriteSheet('sprite.png');
const spriteManager = new SpriteManager(engine, spriteSheet);

// Players appear when game loop starts
engine.start();

// Sprite color can be customized (stored in localStorage)
const hue = parseInt(localStorage.getItem('spriteColorHue') || '0', 10);
```

## Common Development Tasks

### Adding a New Quiz Question

1. Edit `data/curriculum.js` - add to appropriate unit array
2. Follow existing question format:
   ```javascript
   {
     id: "U1-L2-Q05",           // Format: U{unit}-L{topic}-Q{number}
     type: "mc",                 // "mc" or "frq"
     text: "Question text here",
     choices: ["A", "B", "C", "D"],  // For MC only
     correct: "B",               // Correct answer
     explanation: "Why this is correct..."
   }
   ```
3. For FRQ with chart support, also update `data/chart_questions.js`:
   ```javascript
   "U1-L10-Q04": {
     eligible: true,
     chartTypes: ["histogram", "dotplot"]
   }
   ```
4. Test by navigating to the question in the app

### Testing Chart Wizard Locally

1. Open any FRQ question eligible for charts
2. Click "Add Chart" or "Edit Chart" button
3. Test chart creation:
   - Select chart type from wizard
   - Enter sample data (use CSV paste or manual entry)
   - Preview chart rendering
   - Save and verify storage
4. Verify SIF storage in browser console:
   ```javascript
   console.log(classData.users[currentUsername].charts);
   ```
5. Test all 14 chart types for rendering issues
6. Verify chart persists after page reload

### Modifying Curriculum Structure

1. **Unit-level changes**: Edit `data/units.js`
   - Add/modify unit metadata (name, description, topics)
   - Maintain 9-unit structure aligned with AP Statistics
2. **Question content**: Edit `data/curriculum.js`
   - Questions organized by unit arrays
   - Maintain ID format: `U{unit}-L{topic}-Q{number}`
3. **Resource links**: Add video/PDF/Blooket links in unit metadata
4. Clear localStorage and test fresh load to verify structure

### Debugging Data Sync Issues

1. **Check sync mode**:
   ```javascript
   console.log('Railway enabled:', window.USE_RAILWAY);
   console.log('Supabase configured:', !!window.SUPABASE_URL);
   ```
2. **Test Railway connection**:
   ```bash
   curl http://localhost:3000/health
   ```
3. **Inspect localStorage**:
   ```javascript
   const data = JSON.parse(localStorage.getItem('classData'));
   console.log('Users:', Object.keys(data.users));
   console.log('Answers:', data.users[currentUsername].answers);
   ```
4. **Check WebSocket**:
   ```javascript
   // Railway client logs connection status
   // Look for "Railway client connected" in console
   ```

### Running the FRQ Analysis Script

```bash
cd /mnt/c/Users/rober/OneDrive/Desktop/code
node scripts/analyze_frq_charts.js
```

Output files:
- `docs/analysis/frq_chart_inventory.json` - Full analysis
- `docs/analysis/frq_chart_inventory.csv` - Spreadsheet-friendly
- `docs/analysis/frq_ids_by_type.txt` - Quick reference

## Testing

**Note**: Currently no automated test suite. Testing is manual:

1. **Offline functionality**: Open app without internet, verify all features work
2. **Sync testing**: 
   - Test with local Railway server
   - Test direct Supabase connection
   - Verify fallback if server down
3. **Data integrity**: Import/export cycle, verify no data loss
4. **Chart wizard**: Test all 14 chart types, CSV import, manual entry
5. **Sprites**: Verify keyboard control, peer visibility, animation smoothness

Recommended: Add Jest tests for critical functions (import/export, data merging, chart validation).

## Deployment

### Frontend (Static Host)

Compatible with any static file host:
- **GitHub Pages**: Push to `gh-pages` branch
- **Netlify**: Connect GitHub repo, auto-deploys on push
- **Vercel**: Same as Netlify
- **AWS S3**: Upload files, enable static website hosting
- **Traditional hosting**: FTP upload to web directory

Current deployment: https://robjohncolson.github.io/curriculum_render

### Railway Server

1. Create Railway project
2. Connect GitHub repo with `railway-server` folder
3. Railway auto-detects `package.json`, sets start command to `npm start`
4. Set environment variables (SUPABASE_URL, SUPABASE_ANON_KEY)
5. Deploy automatically on push

Current server: `https://code-production-2468.up.railway.app`

## API Reference (Railway Server)

### REST Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/health` | Server health check | None |
| GET | `/api/peer-data` | Get all peer answers | None |
| GET | `/api/peer-data?since=1234567890` | Get answers since timestamp | None |
| GET | `/api/question-stats/:questionId` | Get consensus stats | None |
| POST | `/api/submit-answer` | Submit single answer | None |
| POST | `/api/batch-submit` | Submit multiple answers | None |
| GET | `/api/stats` | Server performance metrics | None |

### WebSocket Events

**Client → Server**:
- `ping`: Keep-alive ping
- `heartbeat`: User presence heartbeat with username
- `identify`: Identify user (sends username)
- `subscribe`: Subscribe to question updates

**Server → Client**:
- `connected`: Connection confirmed
- `answer_submitted`: New answer received
- `batch_submitted`: Batch update received
- `realtime_update`: Supabase change event
- `presence_snapshot`: Current online users
- `user_online`: User came online
- `user_offline`: User went offline

## Troubleshooting

### Sync Issues

```javascript
// Check Railway connection
fetch('http://localhost:3000/health')
  .then(r => r.json())
  .then(data => console.log('Railway health:', data))
  .catch(e => console.error('Railway down:', e));

// Check WebSocket
const ws = new WebSocket('ws://localhost:3000');
ws.onopen = () => console.log('WebSocket connected');
ws.onerror = (e) => console.error('WebSocket error:', e);
```

### LocalStorage Issues

```javascript
// Check current data size
const dataSize = JSON.stringify(localStorage.getItem('classData')).length;
console.log('Data size:', dataSize, 'bytes');

// Clear data (last resort)
localStorage.removeItem('classData');
```

### Chart Wizard Issues

```javascript
// Check available chart types
console.log(window.CHART_TYPE_LIST);

// Check saved charts
console.log(window.classData.users[currentUsername].charts);
```

## Chart Storage & Hydration System

### Overview

Charts are now a first-class answer type stored as stringified SIF JSON in the database `answer_value` field. No schema changes required - charts use the same storage path as text answers.

### Architecture

**Storage Contract**:
- MCQ answers: Single letter (e.g., "A", "B", "C")
- FRQ text: Raw string
- Charts: Stringified SIF JSON with `type` or `chartType` property

**Recognition**: If `answer_value` parses to an object with `chartType`, it's treated as a chart.

### Key Modules

1. **`js/sif_deserializer.js`** (300 lines)
   - Safe JSON parsing with schema validation
   - Supports all 14 chart types
   - Normalizes SIF structure
   - Validates chart-specific data

2. **`js/railway_hydration.js`** (280 lines)
   - Fetches user's answers from Railway server
   - Endpoint: `GET /api/user-answers/:username`
   - Merges with local data, preferring newer timestamps
   - Automatically parses charts from answer_value

3. **`js/session_fallback.js`** (350 lines)
   - Storage hierarchy: localStorage → sessionStorage → memory
   - Handles storage-denied browsers
   - Quota management and recovery options
   - Backup/restore functionality

4. **`js/notifications.js`** (350 lines)
   - Visual feedback for storage operations
   - Toast-style notifications
   - Storage-specific warnings
   - Error handling display

### Hydration Flow

```javascript
// On page load (auth.js):
promptUsername()
  ├─→ initClassData()
  ├─→ Railway hydration (if USE_RAILWAY=true)
  │     ├─→ GET /api/user-answers/{username}
  │     ├─→ Parse chart SIFs from answer_value
  │     └─→ Merge to classData & localStorage
  └─→ Fallback to Supabase or localStorage only
```

### Storage Locations

| Location | Key | Chart Storage |
|----------|-----|---------------|
| `classData.users[user].answers[qid]` | In-memory | Parsed object |
| `classData.users[user].charts[qid]` | In-memory cache | Parsed object |
| `localStorage["answers_user"][qid]` | Browser | Stringified SIF |
| `answers.answer_value` (DB) | Supabase/Railway | Stringified SIF |

### Testing

Three test scripts are provided:

1. **`test_chart_persistence.js`** - Tests all storage modes
   ```javascript
   // Run in browser console:
   fetch('/test_chart_persistence.js').then(r=>r.text()).then(eval)
   ```

2. **`test_realtime_charts.js`** - Tests peer chart sharing
   ```javascript
   // Simulates peer chart submission and broadcast
   fetch('/test_realtime_charts.js').then(r=>r.text()).then(eval)
   ```

3. **Manual Testing Checklist**:
   - Create chart → refresh → chart persists ✓
   - file:// protocol → charts load ✓
   - Storage denied → session fallback works ✓
   - Railway down → Supabase fallback works ✓
   - Peer submits chart → appears in consensus ✓

### Error Handling

The system gracefully handles:
- **Storage denied**: Falls back to sessionStorage or memory
- **Quota exceeded**: Shows warning, suggests export
- **Network failures**: Uses cached local data
- **Invalid chart data**: Logs error, treats as text
- **Railway unavailable**: Falls back to direct Supabase

### Chart Type Support

All 14 chart types are supported with full validation:

| Type | Data Structure | Validation |
|------|---------------|------------|
| bar, line | series[], categories[] | Arrays exist |
| scatter, bubble | points[] | Valid x,y coordinates |
| radar | categories[], datasets[] | Matching lengths |
| pie, doughnut, polarArea | segments[] | Values sum correctly |
| histogram | data.bins[] | Bin labels unique |
| dotplot | data.values[] | Numeric values |
| boxplot | data.fiveNumber | min < q1 < median < q3 < max |
| normal | data.mean, data.sd | Valid numbers |
| chisquare | data.dfList[] | Positive integers |
| numberline | data.ticks[] | Sorted x values |

## Performance

- **Initial load**: <1s (no build needed)
- **Chart rendering**: <100ms (Chart.js)
- **Chart hydration**: <200ms (Railway cached)
- **SIF parsing**: <10ms per chart
- **Sprite animation**: 60 FPS target (requestAnimationFrame)
- **localStorage write**: ~10ms for typical class data
- **WebSocket latency**: <100ms (Railway)
- **Cache hit rate**: ~90% (Railway server)

## Future Enhancements

- [ ] Unit tests with Jest
- [ ] E2E tests with Cypress
- [ ] Real-time collaborative chart editing
- [ ] Advanced analytics (question difficulty, learning gains)
- [ ] Teacher dashboard with class statistics
- [ ] Mobile app wrapper (React Native or PWA)
- [ ] Multi-language support
- [ ] Accessibility improvements (WCAG 2.1 AA)

## Contributing Notes

1. **No build step** - changes take effect immediately (refresh browser)
2. **LocalStorage debugging** - use `console.table(window.classData)`
3. **Chart testing** - manually test all 14 types in chart wizard
4. **Performance** - profile with DevTools, watch for localStorage quota errors
5. **Browser compatibility** - test in Chrome, Firefox, Safari, Edge (modern versions)

## License & Attribution

Source code available at: https://github.com/robjohncolson/curriculum_render

Built with:
- Chart.js 3.9.1
- Supabase (PostgreSQL)
- Express.js (Railway server)
- Canvas API (sprite animation)
- Font Awesome icons

Curriculum based on College Board AP Statistics framework.
