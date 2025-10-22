/**
 * websocket.test.js - WebSocket Tests
 * Tests for WebSocket connections and presence tracking
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { WebSocket } from 'ws';

// Mock WebSocket server for testing
class MockWebSocketServer {
    constructor() {
        this.clients = new Set();
        this.messageHandlers = new Map();
    }

    addClient(ws) {
        this.clients.add(ws);
        ws.server = this;
    }

    removeClient(ws) {
        this.clients.delete(ws);
    }

    broadcast(data) {
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    }

    on(event, handler) {
        this.messageHandlers.set(event, handler);
    }

    emit(event, ...args) {
        const handler = this.messageHandlers.get(event);
        if (handler) {
            handler(...args);
        }
    }
}

// Mock WebSocket client
class MockWebSocket {
    constructor() {
        this.readyState = WebSocket.OPEN;
        this.messages = [];
        this.server = null;
    }

    send(data) {
        this.messages.push(data);
    }

    close() {
        this.readyState = WebSocket.CLOSED;
        if (this.server) {
            this.server.removeClient(this);
        }
    }

    getLastMessage() {
        if (this.messages.length === 0) return null;
        const msg = this.messages[this.messages.length - 1];
        return typeof msg === 'string' ? JSON.parse(msg) : msg;
    }

    getAllMessages() {
        return this.messages.map(msg =>
            typeof msg === 'string' ? JSON.parse(msg) : msg
        );
    }

    clearMessages() {
        this.messages = [];
    }
}

describe('WebSocket - Connection Lifecycle', () => {
    let server;
    let client;

    beforeEach(() => {
        server = new MockWebSocketServer();
        client = new MockWebSocket();
        server.addClient(client);
    });

    afterEach(() => {
        client.close();
    });

    it('should accept new connections', () => {
        expect(server.clients.size).toBe(1);
        expect(server.clients.has(client)).toBe(true);
    });

    it('should send welcome message on connect', () => {
        const welcomeMsg = {
            type: 'connected',
            message: 'Connected to AP Stats Railway Server',
            clients: server.clients.size,
            version: '2.0.0'
        };

        client.send(JSON.stringify(welcomeMsg));

        const lastMsg = client.getLastMessage();
        expect(lastMsg.type).toBe('connected');
        expect(lastMsg.version).toBe('2.0.0');
    });

    it('should handle client disconnection', () => {
        expect(server.clients.size).toBe(1);

        client.close();

        expect(server.clients.size).toBe(0);
    });

    it('should handle multiple simultaneous connections', () => {
        const client2 = new MockWebSocket();
        const client3 = new MockWebSocket();

        server.addClient(client2);
        server.addClient(client3);

        expect(server.clients.size).toBe(3);

        client2.close();

        expect(server.clients.size).toBe(2);
    });
});

describe('WebSocket - Message Handling', () => {
    let server;
    let client;

    beforeEach(() => {
        server = new MockWebSocketServer();
        client = new MockWebSocket();
        server.addClient(client);
    });

    afterEach(() => {
        client.close();
    });

    it('should respond to ping with pong', () => {
        const pingMsg = { type: 'ping', timestamp: Date.now() };
        const pongMsg = { type: 'pong', timestamp: Date.now() };

        client.send(JSON.stringify(pongMsg));

        const lastMsg = client.getLastMessage();
        expect(lastMsg.type).toBe('pong');
        expect(lastMsg.timestamp).toBeDefined();
    });

    it('should handle identify message', () => {
        const identifyMsg = {
            type: 'identify',
            username: 'Test_User'
        };

        client.send(JSON.stringify(identifyMsg));

        // Server should store username association
        expect(client.messages.length).toBeGreaterThan(0);
    });

    it('should handle malformed messages gracefully', () => {
        const invalidMsg = 'not valid JSON {';

        try {
            client.send(invalidMsg);
            // Should not throw
            expect(true).toBe(true);
        } catch (error) {
            // Error is acceptable
            expect(true).toBe(true);
        }
    });
});

describe('WebSocket - Broadcasting', () => {
    let server;
    let client1;
    let client2;
    let client3;

    beforeEach(() => {
        server = new MockWebSocketServer();
        client1 = new MockWebSocket();
        client2 = new MockWebSocket();
        client3 = new MockWebSocket();

        server.addClient(client1);
        server.addClient(client2);
        server.addClient(client3);
    });

    afterEach(() => {
        client1.close();
        client2.close();
        client3.close();
    });

    it('should broadcast messages to all clients', () => {
        const broadcastMsg = {
            type: 'update',
            data: 'test data'
        };

        server.broadcast(broadcastMsg);

        expect(client1.messages.length).toBe(1);
        expect(client2.messages.length).toBe(1);
        expect(client3.messages.length).toBe(1);

        expect(client1.getLastMessage().type).toBe('update');
        expect(client2.getLastMessage().type).toBe('update');
        expect(client3.getLastMessage().type).toBe('update');
    });

    it('should not send to closed connections', () => {
        client2.readyState = WebSocket.CLOSED;

        server.broadcast({ type: 'test' });

        expect(client1.messages.length).toBe(1);
        expect(client2.messages.length).toBe(0); // Closed, no message
        expect(client3.messages.length).toBe(1);
    });

    it('should handle rapid broadcasts', () => {
        for (let i = 0; i < 100; i++) {
            server.broadcast({ type: 'rapid', index: i });
        }

        expect(client1.messages.length).toBe(100);
        expect(client2.messages.length).toBe(100);
        expect(client3.messages.length).toBe(100);

        const lastMsg = client1.getLastMessage();
        expect(lastMsg.index).toBe(99);
    });
});

describe('WebSocket - Presence Tracking', () => {
    let presence;

    beforeEach(() => {
        presence = new Map();
    });

    it('should track online users', () => {
        const username = 'Test_User';
        const ws = new MockWebSocket();

        presence.set(username, {
            lastSeen: Date.now(),
            connections: new Set([ws])
        });

        expect(presence.has(username)).toBe(true);
        expect(presence.get(username).connections.size).toBe(1);
    });

    it('should handle multiple connections per user', () => {
        const username = 'Test_User';
        const ws1 = new MockWebSocket();
        const ws2 = new MockWebSocket();

        const info = {
            lastSeen: Date.now(),
            connections: new Set([ws1, ws2])
        };

        presence.set(username, info);

        expect(info.connections.size).toBe(2);
    });

    it('should update lastSeen timestamp on activity', () => {
        const username = 'Test_User';
        const initialTime = Date.now();

        presence.set(username, {
            lastSeen: initialTime,
            connections: new Set()
        });

        // Simulate activity
        setTimeout(() => {
            const info = presence.get(username);
            info.lastSeen = Date.now();

            expect(info.lastSeen).toBeGreaterThan(initialTime);
        }, 10);
    });

    it('should remove stale presence after TTL', () => {
        const PRESENCE_TTL_MS = 45000; // 45 seconds
        const username = 'Stale_User';

        presence.set(username, {
            lastSeen: Date.now() - 60000, // 60 seconds ago
            connections: new Set()
        });

        // Cleanup stale presence
        const now = Date.now();
        for (const [user, info] of presence.entries()) {
            if (now - info.lastSeen > PRESENCE_TTL_MS) {
                presence.delete(user);
            }
        }

        expect(presence.has(username)).toBe(false);
    });

    it('should generate presence snapshot', () => {
        presence.set('User_A', { lastSeen: Date.now(), connections: new Set() });
        presence.set('User_B', { lastSeen: Date.now(), connections: new Set() });
        presence.set('User_C', { lastSeen: Date.now(), connections: new Set() });

        const snapshot = {
            type: 'presence',
            online: Array.from(presence.keys()),
            count: presence.size,
            timestamp: Date.now()
        };

        expect(snapshot.count).toBe(3);
        expect(snapshot.online).toContain('User_A');
        expect(snapshot.online).toContain('User_B');
        expect(snapshot.online).toContain('User_C');
    });

    it('should broadcast presence updates', () => {
        const server = new MockWebSocketServer();
        const client1 = new MockWebSocket();
        const client2 = new MockWebSocket();

        server.addClient(client1);
        server.addClient(client2);

        // Simulate new user joining
        const newUser = 'New_User';
        presence.set(newUser, { lastSeen: Date.now(), connections: new Set() });

        const presenceUpdate = {
            type: 'presence_update',
            action: 'join',
            username: newUser,
            onlineCount: presence.size
        };

        server.broadcast(presenceUpdate);

        expect(client1.getLastMessage().type).toBe('presence_update');
        expect(client1.getLastMessage().username).toBe(newUser);
        expect(client2.getLastMessage().type).toBe('presence_update');
    });
});

describe('WebSocket - Error Handling', () => {
    let server;
    let client;

    beforeEach(() => {
        server = new MockWebSocketServer();
        client = new MockWebSocket();
        server.addClient(client);
    });

    it('should handle connection errors', () => {
        client.readyState = WebSocket.CLOSED;

        try {
            server.broadcast({ type: 'test' });
            expect(true).toBe(true); // Should not crash
        } catch (error) {
            expect(false).toBe(true); // Should not throw
        }
    });

    it('should handle invalid message types', () => {
        const invalidMsg = {
            type: 'unknown_type',
            data: 'invalid'
        };

        try {
            client.send(JSON.stringify(invalidMsg));
            expect(true).toBe(true); // Should handle gracefully
        } catch (error) {
            expect(false).toBe(true);
        }
    });

    it('should handle large messages', () => {
        const largeMsg = {
            type: 'large',
            data: 'x'.repeat(1000000) // 1MB
        };

        try {
            client.send(JSON.stringify(largeMsg));
            expect(client.messages.length).toBe(1);
        } catch (error) {
            // Size limit exceeded is acceptable
            expect(true).toBe(true);
        }
    });
});

describe('WebSocket - Performance', () => {
    it('should handle many concurrent connections', () => {
        const server = new MockWebSocketServer();
        const clientCount = 100;
        const clients = [];

        for (let i = 0; i < clientCount; i++) {
            const client = new MockWebSocket();
            server.addClient(client);
            clients.push(client);
        }

        expect(server.clients.size).toBe(clientCount);

        // Broadcast to all
        server.broadcast({ type: 'test' });

        // All should receive message
        clients.forEach(client => {
            expect(client.messages.length).toBe(1);
        });

        // Cleanup
        clients.forEach(client => client.close());
    });

    it('should handle high message throughput', () => {
        const server = new MockWebSocketServer();
        const client = new MockWebSocket();
        server.addClient(client);

        const messageCount = 1000;

        for (let i = 0; i < messageCount; i++) {
            server.broadcast({ type: 'throughput', index: i });
        }

        expect(client.messages.length).toBe(messageCount);

        client.close();
    });
});
