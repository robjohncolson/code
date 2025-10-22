/**
 * Railway Server - Production Entry Point
 * Combines Express REST API with WebSocket real-time features
 */

import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import app, { supabase, cache } from './app.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

// Track connected WebSocket clients
const wsClients = new Set();

// Presence tracking (in-memory)
const presence = new Map(); // username -> { lastSeen: number, connections: Set<WebSocket> }
const wsToUser = new Map(); // ws -> username
const PRESENCE_TTL_MS = parseInt(process.env.PRESENCE_TTL_MS || '45000', 10);

// ============================
// HTTP SERVER
// ============================

const server = app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║   AP Statistics Consensus Quiz - Railway Server     ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`🚀  HTTP Server running on port ${PORT}`);
    console.log(`📡  WebSocket ready for connections`);
    console.log(`🗄️   Connected to Supabase`);
    console.log(`🔒  JWT Authentication enabled`);
    console.log(`⚡  Rate limiting active`);
    console.log(`📊  Real-time subscriptions enabled`);
    console.log('');
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`API Version: 2.0.0`);
    console.log('');
    console.log('Endpoints:');
    console.log('  GET  /health                    - Health check');
    console.log('  POST /api/profiles              - Create profile');
    console.log('  POST /api/answers               - Submit answer');
    console.log('  GET  /api/answers/:id           - Get peer answers');
    console.log('  POST /api/votes                 - Cast vote');
    console.log('  POST /api/progress              - Update progress');
    console.log('  GET  /api/peer-data             - Legacy peer data');
    console.log('');
    console.log('WebSocket:');
    console.log(`  ws://localhost:${PORT}          - Connect for real-time`);
    console.log('');
});

// ============================
// WEBSOCKET SERVER
// ============================

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    console.log(`[WS] New client connected (total: ${wsClients.size + 1})`);
    wsClients.add(ws);

    // Send welcome message
    ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to AP Stats Railway Server',
        clients: wsClients.size,
        version: '2.0.0',
        features: ['real-time', 'presence', 'consensus'],
        timestamp: Date.now()
    }));

    // Send initial presence snapshot
    sendPresenceSnapshot(ws);

    // Handle client messages
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'ping':
                    ws.send(JSON.stringify({
                        type: 'pong',
                        timestamp: Date.now()
                    }));
                    break;

                case 'identify': {
                    const username = (data.username || '').trim();
                    if (!username) break;

                    wsToUser.set(ws, username);
                    let info = presence.get(username);
                    if (!info) {
                        info = { lastSeen: Date.now(), connections: new Set() };
                        presence.set(username, info);
                    }
                    info.connections.add(ws);
                    info.lastSeen = Date.now();

                    console.log(`[WS] User identified: ${username}`);

                    // Broadcast user online
                    broadcastToClients({
                        type: 'user_online',
                        username,
                        timestamp: Date.now()
                    });
                    break;
                }

                case 'heartbeat': {
                    const username = (data.username || wsToUser.get(ws) || '').trim();
                    if (!username) break;

                    let info = presence.get(username);
                    if (!info) {
                        info = { lastSeen: Date.now(), connections: new Set([ws]) };
                        presence.set(username, info);
                    }
                    info.lastSeen = Date.now();
                    break;
                }

                case 'subscribe': {
                    // Client wants to subscribe to a specific question
                    ws.questionId = data.questionId;
                    ws.send(JSON.stringify({
                        type: 'subscribed',
                        questionId: data.questionId
                    }));
                    console.log(`[WS] Client subscribed to question: ${data.questionId}`);
                    break;
                }

                case 'answer_submitted': {
                    // Broadcast answer submission to other clients
                    broadcastToClients({
                        type: 'answer_submitted',
                        username: data.username,
                        question_id: data.question_id,
                        answer_value: data.answer_value,
                        timestamp: Date.now()
                    }, ws); // Exclude sender
                    break;
                }

                case 'vote_cast': {
                    // Broadcast vote to other clients
                    broadcastToClients({
                        type: 'vote_cast',
                        voter_username: data.voter_username,
                        target_username: data.target_username,
                        question_id: data.question_id,
                        vote_type: data.vote_type,
                        timestamp: Date.now()
                    });
                    break;
                }

                default:
                    console.log(`[WS] Unknown message type: ${data.type}`);
            }
        } catch (error) {
            console.error('[WS] Message error:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format',
                timestamp: Date.now()
            }));
        }
    });

    // Handle disconnect
    ws.on('close', () => {
        console.log(`[WS] Client disconnected (total: ${wsClients.size - 1})`);
        wsClients.delete(ws);

        // Remove from presence map
        const username = wsToUser.get(ws);
        if (username) {
            const info = presence.get(username);
            if (info) {
                info.connections.delete(ws);
                if (info.connections.size === 0) {
                    // Defer offline broadcast to allow quick reconnects
                    info.lastSeen = Date.now();
                }
            }
            wsToUser.delete(ws);
        }
    });

    ws.on('error', (error) => {
        console.error('[WS] Error:', error);
        wsClients.delete(ws);
        wsToUser.delete(ws);
    });
});

// ============================
// WEBSOCKET HELPERS
// ============================

/**
 * Broadcast message to all connected clients
 * @param {Object} data - Message data
 * @param {WebSocket} exclude - Optional client to exclude
 */
function broadcastToClients(data, exclude = null) {
    const message = JSON.stringify(data);
    let sent = 0;
    let failed = 0;

    wsClients.forEach(client => {
        if (client === exclude) return;
        if (client.readyState === 1) { // WebSocket.OPEN
            try {
                client.send(message);
                sent++;
            } catch (error) {
                console.error('[WS] Broadcast error:', error);
                failed++;
            }
        }
    });

    if (process.env.NODE_ENV === 'development' && sent > 0) {
        console.log(`[WS] Broadcast: ${data.type} to ${sent} clients (${failed} failed)`);
    }
}

/**
 * Get list of online usernames
 */
function getOnlineUsernames() {
    const now = Date.now();
    const users = [];
    presence.forEach((info, username) => {
        if (info.connections && info.connections.size > 0 && (now - info.lastSeen) < PRESENCE_TTL_MS) {
            users.push(username);
        }
    });
    return users;
}

/**
 * Send presence snapshot to a specific client
 */
function sendPresenceSnapshot(ws) {
    try {
        const users = getOnlineUsernames();
        ws.send(JSON.stringify({
            type: 'presence_snapshot',
            users,
            count: users.length,
            timestamp: Date.now()
        }));
    } catch (error) {
        console.error('[WS] Failed to send presence snapshot:', error);
    }
}

// ============================
// SUPABASE REAL-TIME
// ============================

// Subscribe to Supabase real-time updates
const subscription = supabase
    .channel('answers_changes')
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'answers' },
        (payload) => {
            console.log('[SUPABASE] Real-time update:', payload.eventType);

            // Invalidate cache
            cache.lastUpdate = 0;
            if (payload.new?.question_id) {
                cache.questionStats.delete(payload.new.question_id);
            }

            // Broadcast to all WebSocket clients
            broadcastToClients({
                type: 'realtime_update',
                event: payload.eventType,
                data: payload.new || payload.old,
                table: 'answers',
                timestamp: Date.now()
            });
        }
    )
    .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log('📊  Subscribed to Supabase real-time updates');
        } else if (status === 'CHANNEL_ERROR') {
            console.error('❌  Supabase subscription error');
        }
    });

// Subscribe to votes table
const votesSubscription = supabase
    .channel('votes_changes')
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'votes' },
        (payload) => {
            console.log('[SUPABASE] Vote update:', payload.eventType);

            broadcastToClients({
                type: 'vote_update',
                event: payload.eventType,
                data: payload.new || payload.old,
                timestamp: Date.now()
            });
        }
    )
    .subscribe();

// ============================
// PERIODIC CLEANUP
// ============================

// Periodic presence cleanup and offline broadcast
const cleanupInterval = setInterval(() => {
    const now = Date.now();
    const toOffline = [];

    presence.forEach((info, username) => {
        const isConnected = info.connections && info.connections.size > 0;
        if (!isConnected && (now - info.lastSeen) > PRESENCE_TTL_MS) {
            toOffline.push(username);
        }
    });

    toOffline.forEach((username) => {
        presence.delete(username);
        broadcastToClients({
            type: 'user_offline',
            username,
            timestamp: Date.now()
        });
        console.log(`[PRESENCE] User offline: ${username}`);
    });

    // Clean up old question stats cache entries
    const statsAge = 5 * 60 * 1000; // 5 minutes
    cache.questionStats.forEach((value, key) => {
        if (now - value.timestamp > statsAge) {
            cache.questionStats.delete(key);
        }
    });
}, Math.max(5000, Math.floor(PRESENCE_TTL_MS / 3)));

// Periodic stats logging
const statsInterval = setInterval(() => {
    const stats = {
        wsClients: wsClients.size,
        onlineUsers: getOnlineUsernames().length,
        presenceEntries: presence.size,
        cacheEntries: cache.questionStats.size,
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        uptime: Math.round(process.uptime()) + 's'
    };

    console.log('[STATS]', JSON.stringify(stats));
}, 60000); // Every minute

// ============================
// GRACEFUL SHUTDOWN
// ============================

function gracefulShutdown(signal) {
    console.log('');
    console.log(`[SHUTDOWN] ${signal} received, closing server...`);

    // Stop accepting new connections
    server.close(() => {
        console.log('[SHUTDOWN] HTTP server closed');
    });

    // Close all WebSocket connections
    wsClients.forEach(client => {
        try {
            client.send(JSON.stringify({
                type: 'server_shutdown',
                message: 'Server is shutting down',
                timestamp: Date.now()
            }));
            client.close(1001, 'Server shutdown');
        } catch (error) {
            console.error('[SHUTDOWN] Error closing WebSocket:', error);
        }
    });

    // Unsubscribe from Supabase channels
    subscription.unsubscribe();
    votesSubscription.unsubscribe();

    // Clear intervals
    clearInterval(cleanupInterval);
    clearInterval(statsInterval);

    console.log('[SHUTDOWN] Cleanup complete');
    process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('[FATAL] Uncaught exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] Unhandled rejection:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});

// Export for testing
export { server, wss, wsClients, broadcastToClients, getOnlineUsernames };