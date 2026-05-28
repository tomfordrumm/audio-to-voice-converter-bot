import fs from 'fs';
import path from 'path';
import {randomUUID} from 'crypto';
import {InputFile, type Context} from 'grammy';
import type {Audio} from '@grammyjs/types';
import {config} from '../config';
import {errorMessage, isVoiceMessagesForbiddenError} from '../errors';
import {formatMessage, t} from '../i18n';
import {editCaptionKeyboard, buyCreditsKeyboard} from '../keyboards';
import {logger} from '../logger';
import {
    getConversionRecord,
    getUsage,
    refundPaidCredit,
    reserveConversion,
    updateConversionLog,
    updateSuccessfulConversionLog,
    upsertUser,
} from '../repositories';
import {convertToVoiceOgg, hasConversionCapacity} from './audio-converter';
import {reply} from './reply';

const maxAudioFileSizeMb = Math.floor(config.maxAudioFileSizeBytes / 1024 / 1024);
const maxAudioDurationMinutes = Math.ceil(config.maxAudioDurationSeconds / 60);

export const userChatKey = (ctx: Context) => {
    if (!ctx.chat || !ctx.from) {
        return undefined;
    }

    return `${ctx.chat.id}:${ctx.from.id}`;
};

export const getAuthorizedConversion = (ctx: Context, conversionId: number) => {
    const messageId = ctx.callbackQuery?.message?.message_id;

    if (!ctx.from || !ctx.chat || !messageId || !Number.isInteger(conversionId)) {
        return undefined;
    }

    const conversion = getConversionRecord(conversionId);

    if (
        !conversion ||
        conversion.telegram_user_id !== ctx.from.id ||
        conversion.chat_id !== ctx.chat.id ||
        conversion.sent_voice_message_id !== messageId
    ) {
        return undefined;
    }

    return conversion;
};

export const showBalance = async (ctx: Context) => {
    const usage = getUsage(ctx);

    await reply(ctx, formatMessage(t(ctx, 'balance'), {
        freeRemaining: usage.freeRemaining,
        freeLimit: config.freeDailyConversions,
        credits: usage.paidCredits,
    }));
};

export const sendLimitReached = async (ctx: Context) => {
    await ctx.reply(t(ctx, 'limitReached'), {
        parse_mode: 'HTML',
        reply_markup: buyCreditsKeyboard(ctx),
    });
};

export const processAudio = async (ctx: Context, audio: Audio, caption: string, sourceMessageId: number) => {
    if (audio.file_size && audio.file_size > config.maxAudioFileSizeBytes) {
        await reply(ctx, formatMessage(t(ctx, 'audioTooLarge'), {
            limitMb: maxAudioFileSizeMb,
        }));
        return;
    }

    if (audio.duration && audio.duration > config.maxAudioDurationSeconds) {
        await reply(ctx, formatMessage(t(ctx, 'audioTooLong'), {
            limitMinutes: maxAudioDurationMinutes,
        }));
        return;
    }

    if (!hasConversionCapacity()) {
        await reply(ctx, t(ctx, 'conversionQueueFull'));
        return;
    }

    upsertUser(ctx);
    const reservation = reserveConversion(ctx, audio, caption, sourceMessageId);

    if (!reservation) {
        await sendLimitReached(ctx);
        return;
    }

    await reply(ctx, t(ctx, 'processing'));

    let outputPath: string | undefined;
    const conversionLogId = reservation.id;

    try {
        const file = await ctx.api.getFile(audio.file_id);

        if (!file.file_path) {
            throw new Error('Failed to get the file path.');
        }

        const fileUrl = `https://api.telegram.org/file/bot${config.token}/${file.file_path}`;

        outputPath = path.join(config.outputDir, `${randomUUID()}.ogg`);
        const currentOutputPath = outputPath;

        await convertToVoiceOgg(fileUrl, currentOutputPath);

        const sentMessage = await ctx.replyWithVoice(new InputFile(currentOutputPath), {
            caption,
            reply_markup: editCaptionKeyboard(ctx, conversionLogId),
        });

        updateSuccessfulConversionLog(conversionLogId, currentOutputPath, sentMessage.message_id, caption);
    } catch (error) {
        updateConversionLog(conversionLogId, 'error', outputPath, error);

        if (reservation.billingSource === 'paid' && ctx.from) {
            refundPaidCredit(ctx.from.id);
        }

        logger.error('Audio conversion failed.', {
            telegramUserId: ctx.from?.id,
            chatId: ctx.chat?.id,
            conversionId: conversionLogId,
            billingSource: reservation.billingSource,
            error: errorMessage(error),
        });

        if (isVoiceMessagesForbiddenError(error)) {
            await reply(ctx, t(ctx, 'voiceMessagesForbidden'));
        } else {
            await reply(ctx, t(ctx, 'conversionError'));
        }
    } finally {
        if (outputPath && fs.existsSync(outputPath)) {
            fs.unlink(outputPath, (error) => {
                if (error) {
                    logger.error('Could not delete converted output file.', {
                        conversionId: conversionLogId,
                        outputPath,
                        error,
                    });
                }
            });
        }
    }
};
