const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-bot-test-'));

process.env.TOKEN = '1111111111:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
process.env.DATABASE_PATH = path.join(tempDir, 'bot.sqlite');
process.env.FREE_DAILY_CONVERSIONS = '1';
process.env.CREDIT_PACK_SIZE = '3';
process.env.CREDIT_PACK_STARS = '2';

const {initializeDatabase, db} = require('../dist/database');
const {
    completeStarPayment,
    createStarPayment,
    getPaidCredits,
    reserveConversion,
    updateSuccessfulConversionLog,
    upsertUser,
} = require('../dist/repositories');
const {getAuthorizedConversion} = require('../dist/services/conversions');
const {ConversionQueue} = require('../dist/services/conversion-queue');

initializeDatabase();

test.after(() => {
    db.close();
    fs.rmSync(tempDir, {recursive: true, force: true});
});

const makeContext = (userId, chatId = 100) => ({
    from: {
        id: userId,
        is_bot: false,
        first_name: `User ${userId}`,
    },
    chat: {
        id: chatId,
    },
});

const makeCallbackContext = (userId, chatId, messageId) => ({
    ...makeContext(userId, chatId),
    callbackQuery: {
        message: {
            message_id: messageId,
        },
    },
});

const audio = {
    file_id: 'file-id',
    file_unique_id: 'file-unique-id',
    duration: 10,
    file_size: 1024,
    mime_type: 'audio/mpeg',
};

test('successful Stars payment is idempotent', () => {
    const ctx = makeContext(1001);
    upsertUser(ctx);

    const payload = createStarPayment(ctx.from.id);

    assert.equal(completeStarPayment(ctx.from.id, payload, 2, 'telegram-charge', 'provider-charge'), true);
    assert.equal(getPaidCredits(ctx.from.id), 3);

    assert.equal(completeStarPayment(ctx.from.id, payload, 2, 'telegram-charge', 'provider-charge'), false);
    assert.equal(getPaidCredits(ctx.from.id), 3);
});

test('conversion reservation uses free quota first and paid credits after the free quota is reserved', () => {
    const ctx = makeContext(1002);
    upsertUser(ctx);

    const first = reserveConversion(ctx, audio, 'first caption', 1);
    assert.equal(first.billingSource, 'free');

    assert.equal(reserveConversion(ctx, audio, 'second caption', 2), undefined);

    const payload = createStarPayment(ctx.from.id);
    assert.equal(completeStarPayment(ctx.from.id, payload, 2, 'telegram-charge-2', 'provider-charge-2'), true);

    const second = reserveConversion(ctx, audio, 'second caption', 2);
    assert.equal(second.billingSource, 'paid');
    assert.equal(getPaidCredits(ctx.from.id), 2);
});

test('callback authorization requires same user, chat, and sent voice message', () => {
    const ctx = makeContext(1003, 500);
    upsertUser(ctx);

    const reservation = reserveConversion(ctx, audio, 'caption', 10);
    updateSuccessfulConversionLog(reservation.id, path.join(tempDir, 'voice.ogg'), 777, 'caption');

    assert.equal(getAuthorizedConversion(makeCallbackContext(1003, 500, 777), reservation.id).id, reservation.id);
    assert.equal(getAuthorizedConversion(makeCallbackContext(1004, 500, 777), reservation.id), undefined);
    assert.equal(getAuthorizedConversion(makeCallbackContext(1003, 501, 777), reservation.id), undefined);
    assert.equal(getAuthorizedConversion(makeCallbackContext(1003, 500, 778), reservation.id), undefined);
});

test('conversion queue respects concurrency and queue capacity', async () => {
    const queue = new ConversionQueue(1, 1);
    const events = [];

    assert.equal(queue.hasCapacity(), true);

    const first = queue.run(async () => {
        events.push('first:start');
        await new Promise((resolve) => setTimeout(resolve, 20));
        events.push('first:end');
    });

    const second = queue.run(async () => {
        events.push('second:start');
        events.push('second:end');
    });

    assert.equal(queue.hasCapacity(), false);

    await Promise.all([first, second]);
    assert.deepEqual(events, ['first:start', 'first:end', 'second:start', 'second:end']);
    assert.equal(queue.hasCapacity(), true);
});
