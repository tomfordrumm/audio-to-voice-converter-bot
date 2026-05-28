import {db} from '../database';
import {now as currentIsoTime} from '../time';

export type PendingStateStoreOptions = {
    namespace: string;
    ttlMs: number;
    cleanupIntervalMs?: number;
    now?: () => number;
};

type PendingStateRow = {
    value_json: string;
    expires_at_ms: number;
};

export class PendingStateStore<T> {
    private readonly namespace: string;
    private readonly now: () => number;
    private readonly cleanupInterval?: NodeJS.Timeout;
    private readonly ttlMs: number;

    constructor(options: PendingStateStoreOptions) {
        this.namespace = options.namespace;
        this.ttlMs = options.ttlMs;
        this.now = options.now || Date.now;

        if (options.cleanupIntervalMs && options.cleanupIntervalMs > 0) {
            this.cleanupInterval = setInterval(() => {
                this.cleanupExpired();
            }, options.cleanupIntervalMs);
            this.cleanupInterval.unref();
        }
    }

    set(key: string, value: T) {
        const timestamp = currentIsoTime();

        db.prepare(`
            INSERT INTO pending_states (
                namespace,
                state_key,
                value_json,
                expires_at_ms,
                created_at,
                updated_at
            ) VALUES (
                @namespace,
                @state_key,
                @value_json,
                @expires_at_ms,
                @created_at,
                @updated_at
            )
            ON CONFLICT(namespace, state_key) DO UPDATE SET
                value_json = excluded.value_json,
                expires_at_ms = excluded.expires_at_ms,
                updated_at = excluded.updated_at
        `).run({
            namespace: this.namespace,
            state_key: key,
            value_json: JSON.stringify(value),
            expires_at_ms: this.now() + this.ttlMs,
            created_at: timestamp,
            updated_at: timestamp,
        });
    }

    get(key: string) {
        const entry = db.prepare(`
            SELECT value_json, expires_at_ms
            FROM pending_states
            WHERE namespace = ?
              AND state_key = ?
        `).get(this.namespace, key) as PendingStateRow | undefined;

        if (!entry) {
            return undefined;
        }

        if (entry.expires_at_ms <= this.now()) {
            this.delete(key);
            return undefined;
        }

        return JSON.parse(entry.value_json) as T;
    }

    has(key: string) {
        return this.get(key) !== undefined;
    }

    delete(key: string) {
        db.prepare(`
            DELETE FROM pending_states
            WHERE namespace = ?
              AND state_key = ?
        `).run(this.namespace, key);
    }

    refresh(key: string) {
        const value = this.get(key);

        if (value === undefined) {
            return false;
        }

        this.set(key, value);
        return true;
    }

    cleanupExpired() {
        db.prepare(`
            DELETE FROM pending_states
            WHERE namespace = ?
              AND expires_at_ms <= ?
        `).run(this.namespace, this.now());
    }

    size() {
        this.cleanupExpired();
        const row = db.prepare(`
            SELECT COUNT(*) AS count
            FROM pending_states
            WHERE namespace = ?
        `).get(this.namespace) as {count: number};

        return row.count;
    }

    stop() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}
