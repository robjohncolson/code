/**
 * cache.test.js - Cache Logic Tests
 * Tests for in-memory caching with TTL
 */

import { describe, it, expect, beforeEach, afterEach, vi } from '@jest/globals';

// Mock cache implementation for testing
class TestCache {
    constructor() {
        this.store = new Map();
        this.ttls = new Map();
        this.hits = 0;
        this.misses = 0;
    }

    set(key, value, ttlMs = 30000) {
        this.store.set(key, value);
        if (ttlMs > 0) {
            const expiresAt = Date.now() + ttlMs;
            this.ttls.set(key, expiresAt);
        }
        return true;
    }

    get(key) {
        // Check if expired
        if (this.ttls.has(key)) {
            const expiresAt = this.ttls.get(key);
            if (Date.now() > expiresAt) {
                this.store.delete(key);
                this.ttls.delete(key);
                this.misses++;
                return null;
            }
        }

        const value = this.store.get(key);
        if (value !== undefined) {
            this.hits++;
            return value;
        }

        this.misses++;
        return null;
    }

    delete(key) {
        this.store.delete(key);
        this.ttls.delete(key);
        return true;
    }

    clear() {
        this.store.clear();
        this.ttls.clear();
        this.hits = 0;
        this.misses = 0;
    }

    getStats() {
        return {
            size: this.store.size,
            hits: this.hits,
            misses: this.misses,
            hitRate: this.hits / (this.hits + this.misses) || 0
        };
    }
}

describe('Cache - Basic Operations', () => {
    let cache;

    beforeEach(() => {
        cache = new TestCache();
    });

    it('should store and retrieve values', () => {
        cache.set('test-key', { data: 'test value' });
        const value = cache.get('test-key');

        expect(value).toEqual({ data: 'test value' });
    });

    it('should return null for non-existent keys', () => {
        const value = cache.get('non-existent');

        expect(value).toBeNull();
    });

    it('should overwrite existing keys', () => {
        cache.set('key', 'value1');
        cache.set('key', 'value2');

        const value = cache.get('key');

        expect(value).toBe('value2');
    });

    it('should delete keys', () => {
        cache.set('key', 'value');
        cache.delete('key');

        const value = cache.get('key');

        expect(value).toBeNull();
    });

    it('should clear all keys', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        cache.clear();

        expect(cache.get('key1')).toBeNull();
        expect(cache.get('key2')).toBeNull();
    });
});

describe('Cache - TTL (Time To Live)', () => {
    let cache;

    beforeEach(() => {
        cache = new TestCache();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should expire keys after TTL', () => {
        cache.set('short-lived', 'value', 1000); // 1 second TTL

        // Immediately available
        expect(cache.get('short-lived')).toBe('value');

        // After 500ms still available
        vi.advanceTimersByTime(500);
        expect(cache.get('short-lived')).toBe('value');

        // After 1001ms expired
        vi.advanceTimersByTime(501);
        expect(cache.get('short-lived')).toBeNull();
    });

    it('should not expire keys without TTL', () => {
        cache.set('permanent', 'value', 0); // No TTL

        vi.advanceTimersByTime(60000); // 60 seconds

        expect(cache.get('permanent')).toBe('value');
    });

    it('should handle different TTLs for different keys', () => {
        cache.set('short', 'value1', 1000);
        cache.set('long', 'value2', 5000);

        vi.advanceTimersByTime(1500);

        expect(cache.get('short')).toBeNull();
        expect(cache.get('long')).toBe('value2');
    });

    it('should reset TTL when key is updated', () => {
        cache.set('key', 'value1', 1000);

        vi.advanceTimersByTime(500);

        // Update with new TTL
        cache.set('key', 'value2', 2000);

        vi.advanceTimersByTime(1000);

        // Should still be available (1500ms since initial set, but only 1000ms since update)
        expect(cache.get('key')).toBe('value2');

        vi.advanceTimersByTime(1001);

        // Now expired
        expect(cache.get('key')).toBeNull();
    });
});

describe('Cache - Statistics', () => {
    let cache;

    beforeEach(() => {
        cache = new TestCache();
    });

    it('should track cache hits', () => {
        cache.set('key', 'value');

        cache.get('key');
        cache.get('key');

        const stats = cache.getStats();

        expect(stats.hits).toBe(2);
        expect(stats.misses).toBe(0);
    });

    it('should track cache misses', () => {
        cache.get('non-existent-1');
        cache.get('non-existent-2');

        const stats = cache.getStats();

        expect(stats.hits).toBe(0);
        expect(stats.misses).toBe(2);
    });

    it('should calculate hit rate', () => {
        cache.set('key', 'value');

        cache.get('key'); // hit
        cache.get('key'); // hit
        cache.get('missing'); // miss

        const stats = cache.getStats();

        expect(stats.hits).toBe(2);
        expect(stats.misses).toBe(1);
        expect(stats.hitRate).toBeCloseTo(2 / 3, 2);
    });

    it('should track cache size', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');

        const stats = cache.getStats();

        expect(stats.size).toBe(2);

        cache.delete('key1');

        expect(cache.getStats().size).toBe(1);
    });
});

describe('Cache - Supabase Query Reduction', () => {
    let cache;
    let mockSupabaseQueryCount;

    beforeEach(() => {
        cache = new TestCache();
        mockSupabaseQueryCount = 0;
    });

    const mockFetchFromSupabase = async () => {
        mockSupabaseQueryCount++;
        return { data: 'fresh data from Supabase' };
    };

    const cachedQuery = async (key, ttlMs = 30000) => {
        // Check cache first
        const cached = cache.get(key);
        if (cached) {
            return cached;
        }

        // Cache miss - query Supabase
        const data = await mockFetchFromSupabase();
        cache.set(key, data, ttlMs);

        return data;
    };

    it('should reduce Supabase queries with cache', async () => {
        // First call - cache miss
        await cachedQuery('peer-data');
        expect(mockSupabaseQueryCount).toBe(1);

        // Subsequent calls - cache hit
        await cachedQuery('peer-data');
        await cachedQuery('peer-data');
        await cachedQuery('peer-data');

        expect(mockSupabaseQueryCount).toBe(1); // Still only 1 query
    });

    it('should query Supabase again after cache expiry', async () => {
        vi.useFakeTimers();

        // First query
        await cachedQuery('peer-data', 1000);
        expect(mockSupabaseQueryCount).toBe(1);

        // Within TTL
        vi.advanceTimersByTime(500);
        await cachedQuery('peer-data', 1000);
        expect(mockSupabaseQueryCount).toBe(1);

        // After TTL
        vi.advanceTimersByTime(501);
        await cachedQuery('peer-data', 1000);
        expect(mockSupabaseQueryCount).toBe(2);

        vi.useRealTimers();
    });

    it('should achieve >90% query reduction for 30 clients', async () => {
        const clientCount = 30;
        const ttlMs = 30000; // 30 second cache

        vi.useFakeTimers();

        // Simulate 30 clients making requests every 5 seconds for 1 minute
        const iterations = 12; // 60s / 5s

        for (let i = 0; i < iterations; i++) {
            for (let client = 0; client < clientCount; client++) {
                await cachedQuery('peer-data', ttlMs);
            }
            vi.advanceTimersByTime(5000);
        }

        // Expected: ~4 Supabase queries (every 30s over 60s)
        // Without cache: 30 clients × 12 iterations = 360 queries
        const reduction = (1 - mockSupabaseQueryCount / (clientCount * iterations)) * 100;

        console.log(`Queries: ${mockSupabaseQueryCount} vs ${clientCount * iterations} without cache`);
        console.log(`Reduction: ${reduction.toFixed(1)}%`);

        expect(reduction).toBeGreaterThan(90);

        vi.useRealTimers();
    });
});

describe('Cache - Edge Cases', () => {
    let cache;

    beforeEach(() => {
        cache = new TestCache();
    });

    it('should handle null values', () => {
        cache.set('null-key', null);

        const value = cache.get('null-key');

        expect(value).toBeNull();
    });

    it('should handle undefined values', () => {
        cache.set('undefined-key', undefined);

        const value = cache.get('undefined-key');

        // undefined stored as undefined, not null
        expect(value).toBeUndefined();
    });

    it('should handle large objects', () => {
        const largeObject = {
            users: Array(1000).fill(null).map((_, i) => ({
                id: i,
                answers: { 'U1-L1-Q01': 'A' }
            }))
        };

        cache.set('large-data', largeObject);

        const value = cache.get('large-data');

        expect(value.users.length).toBe(1000);
    });

    it('should handle rapid consecutive sets', () => {
        for (let i = 0; i < 1000; i++) {
            cache.set(`key-${i}`, `value-${i}`);
        }

        expect(cache.getStats().size).toBe(1000);

        for (let i = 0; i < 1000; i++) {
            expect(cache.get(`key-${i}`)).toBe(`value-${i}`);
        }
    });

    it('should handle concurrent access', async () => {
        cache.set('shared', 'initial');

        const promises = Array(100).fill(null).map(async (_, i) => {
            const value = cache.get('shared');
            cache.set('shared', `update-${i}`);
            return value;
        });

        await Promise.all(promises);

        // Last write wins
        const finalValue = cache.get('shared');
        expect(finalValue).toMatch(/^update-\d+$/);
    });
});
