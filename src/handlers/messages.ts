import type {Bot} from 'grammy';
import type {Audio} from '@grammyjs/types';
import {editCaptionKeyboard} from '../keyboards';
import {t} from '../i18n';
import {logger} from '../logger';
import {
    completeStarPayment,
    createCaptionEditLog,
    updateCaptionLog,
    upsertUser,
} from '../repositories';
import {processAudio, userChatKey} from '../services/conversions';
import type {PendingStateStore} from '../services/pending-state';
import {reply} from '../services/reply';
import type {PendingCaptionEdits} from './callbacks';

export type PendingAudioCaption = {
    audio: Audio;
    sourceMessageId: number;
};

export type PendingAudioCaptions = PendingStateStore<PendingAudioCaption>;

export const registerMessageHandlers = (
    bot: Bot,
    pendingAudioCaptions: PendingAudioCaptions,
    pendingCaptionEdits: PendingCaptionEdits,
) => {
    bot.on('message', async (ctx) => {
        upsertUser(ctx);

        if (ctx.message.successful_payment) {
            const payment = ctx.message.successful_payment;

            if (payment.currency !== 'XTR') {
                return;
            }

            if (!ctx.from) {
                await reply(ctx, t(ctx, 'paymentRejected'));
                return;
            }

            const completed = completeStarPayment(
                ctx.from.id,
                payment.invoice_payload,
                payment.total_amount,
                payment.telegram_payment_charge_id,
                payment.provider_payment_charge_id,
            );

            await reply(ctx, t(ctx, completed ? 'paymentReceived' : 'paymentRejected'));
            return;
        }

        const key = userChatKey(ctx);
        const text = ctx.message.text;

        if (key && text && pendingCaptionEdits.has(key)) {
            const pending = pendingCaptionEdits.get(key);

            if (!pending || !pending.messageId) {
                pendingCaptionEdits.delete(key);
                await reply(ctx, t(ctx, 'missingVoiceToEdit'));
                return;
            }

            if (text.length > 1024) {
                await reply(ctx, t(ctx, 'captionTooLong'));
                return;
            }

            try {
                await ctx.api.editMessageCaption(pending.chatId, pending.messageId, {
                    caption: text,
                    reply_markup: editCaptionKeyboard(ctx, pending.conversionId),
                });
                updateCaptionLog(pending.conversionId, text);
                createCaptionEditLog(ctx, pending.conversionId, pending.chatId, pending.messageId, text, 'success');
                pendingCaptionEdits.delete(key);
                await reply(ctx, t(ctx, 'captionUpdated'));
            } catch (error) {
                createCaptionEditLog(ctx, pending.conversionId, pending.chatId, pending.messageId, text, 'error', error);
                logger.error('Could not edit voice caption.', {
                    telegramUserId: ctx.from?.id,
                    chatId: pending.chatId,
                    messageId: pending.messageId,
                    conversionId: pending.conversionId,
                    error,
                });
                await reply(ctx, t(ctx, 'captionUpdateError'));
            }

            return;
        }

        if (key && text && pendingAudioCaptions.has(key)) {
            const pending = pendingAudioCaptions.get(key);
            pendingAudioCaptions.delete(key);

            if (!pending) {
                await reply(ctx, t(ctx, 'missingAudioForCaption'));
                return;
            }

            if (text.length > 1024) {
                await reply(ctx, t(ctx, 'captionTooLong'));
                pendingAudioCaptions.set(key, pending);
                return;
            }

            await processAudio(ctx, pending.audio, text, pending.sourceMessageId);
            return;
        }

        if (ctx.message.audio) {
            const audio = ctx.message.audio;
            const caption = ctx.message.caption;

            if (caption === undefined) {
                if (key) {
                    pendingAudioCaptions.set(key, {
                        audio,
                        sourceMessageId: ctx.message.message_id,
                    });
                }

                await reply(ctx, t(ctx, 'sendCaption'));
                return;
            }

            await processAudio(ctx, audio, caption, ctx.message.message_id);
            return;
        }

        await reply(ctx, t(ctx, 'expectedAudio'));
    });
};
