/**
 * mock_supabase.js - Mock Supabase Client
 * Provides mock Supabase for testing without network calls
 */

class MockSupabaseClient {
    constructor() {
        this._data = {
            answers: [],
            votes: [],
            badges: [],
            user_activity: []
        };
        this._subscriptions = [];
        this._networkDelay = 0; // ms
        this._shouldFail = false;
        this._failureMessage = 'Mock network error';
    }

    // Mock table selection
    from(table) {
        return new MockQueryBuilder(this, table);
    }

    // Mock auth
    get auth() {
        return {
            getSession: async () => {
                await this._delay();
                return { data: { session: null }, error: null };
            },
            signIn: async () => {
                await this._delay();
                return { data: { user: { id: 'mock-user' } }, error: null };
            }
        };
    }

    // Mock realtime
    channel(name) {
        return new MockChannel(this, name);
    }

    // Test utilities
    setData(table, data) {
        this._data[table] = data;
    }

    getData(table) {
        return this._data[table];
    }

    setNetworkDelay(ms) {
        this._networkDelay = ms;
    }

    setShouldFail(shouldFail, message = 'Mock network error') {
        this._shouldFail = shouldFail;
        this._failureMessage = message;
    }

    reset() {
        this._data = {
            answers: [],
            votes: [],
            badges: [],
            user_activity: []
        };
        this._subscriptions = [];
        this._networkDelay = 0;
        this._shouldFail = false;
    }

    async _delay() {
        if (this._networkDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this._networkDelay));
        }
    }
}

class MockQueryBuilder {
    constructor(client, table) {
        this.client = client;
        this.table = table;
        this._filters = [];
        this._selectFields = '*';
    }

    select(fields = '*') {
        this._selectFields = fields;
        return this;
    }

    insert(data) {
        this._operation = 'insert';
        this._insertData = Array.isArray(data) ? data : [data];
        return this;
    }

    update(data) {
        this._operation = 'update';
        this._updateData = data;
        return this;
    }

    delete() {
        this._operation = 'delete';
        return this;
    }

    eq(column, value) {
        this._filters.push({ type: 'eq', column, value });
        return this;
    }

    neq(column, value) {
        this._filters.push({ type: 'neq', column, value });
        return this;
    }

    in(column, values) {
        this._filters.push({ type: 'in', column, values });
        return this;
    }

    gte(column, value) {
        this._filters.push({ type: 'gte', column, value });
        return this;
    }

    lte(column, value) {
        this._filters.push({ type: 'lte', column, value });
        return this;
    }

    order(column, options = {}) {
        this._order = { column, ...options };
        return this;
    }

    limit(count) {
        this._limit = count;
        return this;
    }

    async then(resolve, reject) {
        await this.client._delay();

        if (this.client._shouldFail) {
            const error = { message: this.client._failureMessage };
            return resolve({ data: null, error });
        }

        try {
            const result = this._execute();
            return resolve({ data: result, error: null });
        } catch (error) {
            return resolve({ data: null, error: { message: error.message } });
        }
    }

    _execute() {
        let data = [...this.client._data[this.table]];

        // Apply filters
        this._filters.forEach(filter => {
            switch (filter.type) {
                case 'eq':
                    data = data.filter(row => row[filter.column] === filter.value);
                    break;
                case 'neq':
                    data = data.filter(row => row[filter.column] !== filter.value);
                    break;
                case 'in':
                    data = data.filter(row => filter.values.includes(row[filter.column]));
                    break;
                case 'gte':
                    data = data.filter(row => row[filter.column] >= filter.value);
                    break;
                case 'lte':
                    data = data.filter(row => row[filter.column] <= filter.value);
                    break;
            }
        });

        // Apply operations
        if (this._operation === 'insert') {
            this._insertData.forEach(row => {
                this.client._data[this.table].push(row);
            });
            return this._insertData;
        }

        if (this._operation === 'update') {
            data.forEach(row => {
                Object.assign(row, this._updateData);
            });
            return data;
        }

        if (this._operation === 'delete') {
            this.client._data[this.table] = this.client._data[this.table].filter(
                row => !data.includes(row)
            );
            return data;
        }

        // Apply ordering
        if (this._order) {
            const { column, ascending = true } = this._order;
            data.sort((a, b) => {
                const aVal = a[column];
                const bVal = b[column];
                const result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                return ascending ? result : -result;
            });
        }

        // Apply limit
        if (this._limit) {
            data = data.slice(0, this._limit);
        }

        return data;
    }
}

class MockChannel {
    constructor(client, name) {
        this.client = client;
        this.name = name;
        this._callbacks = {};
    }

    on(event, filter, callback) {
        if (typeof filter === 'function') {
            callback = filter;
            filter = {};
        }

        this._callbacks[event] = this._callbacks[event] || [];
        this._callbacks[event].push({ filter, callback });

        return this;
    }

    subscribe() {
        this.client._subscriptions.push(this);
        return this;
    }

    unsubscribe() {
        const index = this.client._subscriptions.indexOf(this);
        if (index > -1) {
            this.client._subscriptions.splice(index, 1);
        }
    }

    // Test utility: trigger event
    trigger(event, payload) {
        const callbacks = this._callbacks[event] || [];
        callbacks.forEach(({ callback }) => {
            callback(payload);
        });
    }
}

// Global mock instance
window.mockSupabase = new MockSupabaseClient();

console.log('✅ Mock Supabase loaded');
