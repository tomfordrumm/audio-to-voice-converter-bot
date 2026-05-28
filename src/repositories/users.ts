import type {Context} from 'grammy';
import {config} from '../config';
import {db} from '../database';
import {now} from '../time';
import {getTodayFreeConversions} from './conversions';

export const upsertUser = (ctx: Context) => {
    if (!ctx.from) {
        return;
    }

    db.prepare(`
        INSERT INTO users (
            telegram_user_id,
            is_bot,
            first_name,
            last_name,
            username,
            language_code,
            updated_at
        ) VALUES (
            @id,
            @is_bot,
            @first_name,
            @last_name,
            @username,
            @language_code,
            @updated_at
        )
        ON CONFLICT(telegram_user_id) DO UPDATE SET
            is_bot = excluded.is_bot,
            first_name = excluded.first_name,
            last_name = excluded.last_name,
            username = excluded.username,
            language_code = excluded.language_code,
            updated_at = excluded.updated_at
    `).run({
        id: ctx.from.id,
        is_bot: ctx.from.is_bot ? 1 : 0,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name || null,
        username: ctx.from.username || null,
        language_code: ctx.from.language_code || null,
        updated_at: now(),
    });
};

export const getPaidCredits = (telegramUserId: number) => {
    const row = db.prepare(`
        SELECT paid_credits
        FROM users
        WHERE telegram_user_id = ?
    `).get(telegramUserId) as {paid_credits: number} | undefined;

    return row?.paid_credits || 0;
};

export const getUsage = (ctx: Context) => {
    const telegramUserId = ctx.from?.id;

    if (!telegramUserId) {
        return {freeUsed: 0, freeRemaining: 0, paidCredits: 0};
    }

    const freeUsed = getTodayFreeConversions(telegramUserId);
    const freeRemaining = Math.max(0, config.freeDailyConversions - freeUsed);
    const paidCredits = getPaidCredits(telegramUserId);

    return {freeUsed, freeRemaining, paidCredits};
};
