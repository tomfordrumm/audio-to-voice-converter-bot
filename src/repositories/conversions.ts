import path from 'path';
import type {Context} from 'grammy';
import type {Audio} from '@grammyjs/types';
import {config} from '../config';
import {db} from '../database';
import {errorMessage} from '../errors';
import {now} from '../time';

export type BillingSource = 'free' | 'paid';

export type ConversionReservation = {
    id: number;
    billingSource: BillingSource;
};

export type ConversionRecord = {
    id: number;
    telegram_user_id: number | null;
    chat_id: number;
    sent_voice_message_id: number | null;
};

export const getTodayFreeConversions = (telegramUserId: number) => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const row = db.prepare(`
        SELECT COUNT(*) AS count
        FROM conversions
        WHERE telegram_user_id = ?
          AND status IN ('processing', 'success')
          AND billing_source = 'free'
          AND created_at >= ?
    `).get(telegramUserId, today.toISOString()) as {count: number};

    return row.count;
};

const createConversionLog = (
    ctx: Context,
    audio: Audio,
    caption: string,
    sourceMessageId: number,
    billingSource: BillingSource,
) => {
    const createdAt = now();
    const result = db.prepare(`
        INSERT INTO conversions (
            telegram_user_id,
            chat_id,
            message_id,
            audio_file_id,
            audio_file_unique_id,
            duration_seconds,
            file_size,
            mime_type,
            caption_length,
            billing_source,
            status,
            created_at,
            updated_at
        ) VALUES (
            @telegram_user_id,
            @chat_id,
            @message_id,
            @audio_file_id,
            @audio_file_unique_id,
            @duration_seconds,
            @file_size,
            @mime_type,
            @caption_length,
            @billing_source,
            'processing',
            @created_at,
            @updated_at
        )
    `).run({
        telegram_user_id: ctx.from?.id || null,
        chat_id: ctx.chat?.id,
        message_id: sourceMessageId,
        audio_file_id: audio.file_id,
        audio_file_unique_id: audio.file_unique_id || null,
        duration_seconds: audio.duration || null,
        file_size: audio.file_size || null,
        mime_type: audio.mime_type || null,
        caption_length: caption.length,
        billing_source: billingSource,
        created_at: createdAt,
        updated_at: createdAt,
    });

    return Number(result.lastInsertRowid);
};

export const reserveConversion = db.transaction((
    ctx: Context,
    audio: Audio,
    caption: string,
    sourceMessageId: number,
): ConversionReservation | undefined => {
    if (!ctx.from || !ctx.chat) {
        return undefined;
    }

    const freeUsed = getTodayFreeConversions(ctx.from.id);

    if (freeUsed < config.freeDailyConversions) {
        return {
            id: createConversionLog(ctx, audio, caption, sourceMessageId, 'free'),
            billingSource: 'free',
        };
    }

    const result = db.prepare(`
        UPDATE users
        SET paid_credits = paid_credits - 1,
            updated_at = @updated_at
        WHERE telegram_user_id = @telegram_user_id
          AND paid_credits > 0
    `).run({
        telegram_user_id: ctx.from.id,
        updated_at: now(),
    });

    if (result.changes === 0) {
        return undefined;
    }

    return {
        id: createConversionLog(ctx, audio, caption, sourceMessageId, 'paid'),
        billingSource: 'paid',
    };
});

export const refundPaidCredit = (telegramUserId: number) => {
    db.prepare(`
        UPDATE users
        SET paid_credits = paid_credits + 1,
            updated_at = @updated_at
        WHERE telegram_user_id = @telegram_user_id
    `).run({
        telegram_user_id: telegramUserId,
        updated_at: now(),
    });
};

export const getConversionRecord = (conversionId: number) => {
    return db.prepare(`
        SELECT id, telegram_user_id, chat_id, sent_voice_message_id
        FROM conversions
        WHERE id = ?
    `).get(conversionId) as ConversionRecord | undefined;
};

export const updateConversionLog = (id: number, status: 'success' | 'error', outputPath?: string, error?: unknown) => {
    db.prepare(`
        UPDATE conversions
        SET
            status = @status,
            output_file_name = @output_file_name,
            error_message = @error_message,
            updated_at = @updated_at
        WHERE id = @id
    `).run({
        id,
        status,
        output_file_name: outputPath ? path.basename(outputPath) : null,
        error_message: error ? errorMessage(error).slice(0, 1000) : null,
        updated_at: now(),
    });
};

export const updateSuccessfulConversionLog = (
    id: number,
    outputPath: string,
    sentVoiceMessageId: number,
    caption: string,
) => {
    db.prepare(`
        UPDATE conversions
        SET
            status = 'success',
            output_file_name = @output_file_name,
            sent_voice_message_id = @sent_voice_message_id,
            current_caption = @current_caption,
            caption_length = @caption_length,
            error_message = NULL,
            updated_at = @updated_at
        WHERE id = @id
    `).run({
        id,
        output_file_name: path.basename(outputPath),
        sent_voice_message_id: sentVoiceMessageId,
        current_caption: caption,
        caption_length: caption.length,
        updated_at: now(),
    });
};

export const updateCaptionLog = (conversionId: number, caption: string) => {
    db.prepare(`
        UPDATE conversions
        SET
            current_caption = @current_caption,
            caption_length = @caption_length,
            caption_edit_count = caption_edit_count + 1,
            updated_at = @updated_at
        WHERE id = @id
    `).run({
        id: conversionId,
        current_caption: caption,
        caption_length: caption.length,
        updated_at: now(),
    });
};

export const createCaptionEditLog = (
    ctx: Context,
    conversionId: number,
    chatId: number,
    messageId: number,
    caption: string,
    status: 'success' | 'error',
    error?: unknown,
) => {
    db.prepare(`
        INSERT INTO caption_edits (
            conversion_id,
            telegram_user_id,
            chat_id,
            message_id,
            caption_length,
            status,
            error_message,
            created_at
        ) VALUES (
            @conversion_id,
            @telegram_user_id,
            @chat_id,
            @message_id,
            @caption_length,
            @status,
            @error_message,
            @created_at
        )
    `).run({
        conversion_id: conversionId,
        telegram_user_id: ctx.from?.id || null,
        chat_id: chatId,
        message_id: messageId,
        caption_length: caption.length,
        status,
        error_message: error ? errorMessage(error).slice(0, 1000) : null,
        created_at: now(),
    });
};
