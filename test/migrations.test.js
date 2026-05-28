const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-bot-migrations-test-'));

process.env.TOKEN = '1111111111:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
process.env.DATABASE_PATH = path.join(tempDir, 'bot.sqlite');

const {initializeDatabase, db} = require('../dist/database');

test.after(() => {
    db.close();
    fs.rmSync(tempDir, {recursive: true, force: true});
});

test('database migrations are recorded and idempotent', () => {
    initializeDatabase();
    initializeDatabase();

    const migrations = db.prepare(`
        SELECT version, name
        FROM schema_migrations
        ORDER BY version
    `).all();

    assert.deepEqual(migrations, [
        {version: 1, name: 'create_core_tables'},
        {version: 2, name: 'create_pending_states'},
    ]);

    const pendingStates = db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name = 'pending_states'
    `).get();

    assert.deepEqual(pendingStates, {name: 'pending_states'});
});
