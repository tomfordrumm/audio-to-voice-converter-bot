const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-bot-pending-test-'));

process.env.TOKEN = '1111111111:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
process.env.DATABASE_PATH = path.join(tempDir, 'bot.sqlite');

const {initializeDatabase, db} = require('../dist/database');
const {PendingStateStore} = require('../dist/services/pending-state');

initializeDatabase();

test.after(() => {
    db.close();
    fs.rmSync(tempDir, {recursive: true, force: true});
});

test('pending state expires entries lazily', () => {
    let now = 1000;
    const store = new PendingStateStore({
        namespace: 'lazy-expiry',
        ttlMs: 100,
        now: () => now,
    });

    store.set('caption', {messageId: 1});
    assert.deepEqual(store.get('caption'), {messageId: 1});
    assert.equal(store.has('caption'), true);

    now = 1101;

    assert.equal(store.get('caption'), undefined);
    assert.equal(store.has('caption'), false);
    assert.equal(store.size(), 0);
});

test('pending state refresh extends expiration', () => {
    let now = 1000;
    const store = new PendingStateStore({
        namespace: 'refresh',
        ttlMs: 100,
        now: () => now,
    });

    store.set('caption', {messageId: 1});

    now = 1050;
    assert.equal(store.refresh('caption'), true);

    now = 1120;
    assert.deepEqual(store.get('caption'), {messageId: 1});

    now = 1151;
    assert.equal(store.get('caption'), undefined);
});

test('pending state cleanup removes expired entries without touching active entries', () => {
    let now = 1000;
    const store = new PendingStateStore({
        namespace: 'cleanup',
        ttlMs: 100,
        now: () => now,
    });

    store.set('expired', {messageId: 1});

    now = 1050;
    store.set('active', {messageId: 2});

    now = 1110;
    store.cleanupExpired();

    assert.equal(store.get('expired'), undefined);
    assert.deepEqual(store.get('active'), {messageId: 2});
    assert.equal(store.size(), 1);
});

test('pending state persists across store instances with the same namespace', () => {
    let now = 1000;
    const firstStore = new PendingStateStore({
        namespace: 'restart',
        ttlMs: 100,
        now: () => now,
    });

    firstStore.set('caption', {messageId: 1});

    const secondStore = new PendingStateStore({
        namespace: 'restart',
        ttlMs: 100,
        now: () => now,
    });

    assert.deepEqual(secondStore.get('caption'), {messageId: 1});
});

test('pending state namespaces isolate identical keys', () => {
    let now = 1000;
    const audioStore = new PendingStateStore({
        namespace: 'audio',
        ttlMs: 100,
        now: () => now,
    });
    const editStore = new PendingStateStore({
        namespace: 'edit',
        ttlMs: 100,
        now: () => now,
    });

    audioStore.set('same-key', {sourceMessageId: 1});
    editStore.set('same-key', {messageId: 2});

    assert.deepEqual(audioStore.get('same-key'), {sourceMessageId: 1});
    assert.deepEqual(editStore.get('same-key'), {messageId: 2});
});
