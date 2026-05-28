import Database from 'better-sqlite3';
import {config} from './config';

export const db = new Database(config.databasePath);

type Migration = {
    version: number;
    name: string;
    up: () => void;
};

const ensureColumn = (table: string, column: string, definition: string) => {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{name: string}>;

    if (!columns.some((item) => item.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
};

const migrations: Migration[] = [
    {
        version: 1,
        name: 'create_core_tables',
        up: () => {
            db.exec(`
                CREATE TABLE IF NOT EXISTS users (
                    telegram_user_id INTEGER PRIMARY KEY,
                    is_bot INTEGER NOT NULL,
                    first_name TEXT NOT NULL,
                    last_name TEXT,
                    username TEXT,
                    language_code TEXT,
                    paid_credits INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS conversions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_user_id INTEGER,
                    chat_id INTEGER NOT NULL,
                    message_id INTEGER NOT NULL,
                    sent_voice_message_id INTEGER,
                    audio_file_id TEXT NOT NULL,
                    audio_file_unique_id TEXT,
                    duration_seconds INTEGER,
                    file_size INTEGER,
                    mime_type TEXT,
                    caption_length INTEGER NOT NULL,
                    current_caption TEXT,
                    caption_edit_count INTEGER NOT NULL DEFAULT 0,
                    billing_source TEXT CHECK (billing_source IN ('free', 'paid')),
                    output_file_name TEXT,
                    status TEXT NOT NULL CHECK (status IN ('processing', 'success', 'error')),
                    error_message TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (telegram_user_id) REFERENCES users (telegram_user_id)
                );

                CREATE TABLE IF NOT EXISTS caption_edits (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversion_id INTEGER NOT NULL,
                    telegram_user_id INTEGER,
                    chat_id INTEGER NOT NULL,
                    message_id INTEGER NOT NULL,
                    caption_length INTEGER NOT NULL,
                    status TEXT NOT NULL CHECK (status IN ('success', 'error')),
                    error_message TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (conversion_id) REFERENCES conversions (id),
                    FOREIGN KEY (telegram_user_id) REFERENCES users (telegram_user_id)
                );

                CREATE TABLE IF NOT EXISTS star_payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    payload TEXT NOT NULL UNIQUE,
                    telegram_user_id INTEGER NOT NULL,
                    stars INTEGER NOT NULL,
                    credits INTEGER NOT NULL,
                    status TEXT NOT NULL CHECK (status IN ('invoice_sent', 'paid', 'failed')),
                    telegram_payment_charge_id TEXT,
                    provider_payment_charge_id TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (telegram_user_id) REFERENCES users (telegram_user_id)
                );
            `);

            ensureColumn('conversions', 'sent_voice_message_id', 'INTEGER');
            ensureColumn('conversions', 'current_caption', 'TEXT');
            ensureColumn('conversions', 'caption_edit_count', 'INTEGER NOT NULL DEFAULT 0');
            ensureColumn('conversions', 'billing_source', "TEXT CHECK (billing_source IN ('free', 'paid'))");
            ensureColumn('users', 'paid_credits', 'INTEGER NOT NULL DEFAULT 0');
        },
    },
    {
        version: 2,
        name: 'create_pending_states',
        up: () => {
            db.exec(`
                CREATE TABLE IF NOT EXISTS pending_states (
                    namespace TEXT NOT NULL,
                    state_key TEXT NOT NULL,
                    value_json TEXT NOT NULL,
                    expires_at_ms INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (namespace, state_key)
                );

                CREATE INDEX IF NOT EXISTS idx_pending_states_expires_at_ms
                    ON pending_states (expires_at_ms);
            `);
        },
    },
];

const ensureMigrationsTable = () => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);
};

export const initializeDatabase = () => {
    db.pragma('journal_mode = WAL');
    ensureMigrationsTable();

    const applyMigration = db.transaction((migration: Migration) => {
        migration.up();
        db.prepare(`
            INSERT OR IGNORE INTO schema_migrations (version, name)
            VALUES (?, ?)
        `).run(migration.version, migration.name);
    });

    for (const migration of migrations) {
        const row = db.prepare(`
            SELECT version
            FROM schema_migrations
            WHERE version = ?
        `).get(migration.version);

        if (!row) {
            applyMigration(migration);
        }
    }
};
