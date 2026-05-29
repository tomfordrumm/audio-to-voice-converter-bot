import type {Bot, Context} from 'grammy';
import type {Audio, MessageEntity} from '@grammyjs/types';
import {editCaptionKeyboard, pendingAudioCaptionKeyboard} from '../keyboards';
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
    promptMessageId?: number;
};

export type PendingAudioCaptions = PendingStateStore<PendingAudioCaption>;

const deletePrompt = async (ctx: Context, messageId?: number) => {
    if (!ctx.chat || !messageId) {
        return;
    }

    try {
        await ctx.api.deleteMessage(ctx.chat.id, messageId);
    } catch {
        // The prompt may already be deleted manually; keep the user flow moving.
    }
};

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
                    caption_entities: ctx.message.entities,
                    reply_markup: editCaptionKeyboard(ctx, pending.conversionId),
                });
                updateCaptionLog(pending.conversionId, text);
                createCaptionEditLog(ctx, pending.conversionId, pending.chatId, pending.messageId, text, 'success');
                pendingCaptionEdits.delete(key);
                await deletePrompt(ctx, pending.promptMessageId);
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

            await deletePrompt(ctx, pending.promptMessageId);
            await processAudio(ctx, pending.audio, text, pending.sourceMessageId, ctx.message.entities);
            return;
        }

        if (ctx.message.audio) {
            const audio = ctx.message.audio;
            const caption = ctx.message.caption;
            const captionEntities: MessageEntity[] | undefined = ctx.message.caption_entities;

            if (!key) {
                await reply(ctx, t(ctx, 'missingAudioForCaption'));
                return;
            }

            if (key) {
                const pendingEdit = pendingCaptionEdits.get(key);
                if (pendingEdit) {
                    pendingCaptionEdits.delete(key);
                    await deletePrompt(ctx, pendingEdit.promptMessageId);
                }

                const previousPendingAudio = pendingAudioCaptions.get(key);
                if (previousPendingAudio) {
                    pendingAudioCaptions.delete(key);
                    await deletePrompt(ctx, previousPendingAudio.promptMessageId);
                }
            }

            if (caption === undefined) {
                const prompt = await ctx.reply(t(ctx, 'sendCaption'), {
                    parse_mode: 'HTML',
                    reply_markup: pendingAudioCaptionKeyboard(ctx, ctx.message.message_id),
                });

                pendingAudioCaptions.set(key, {
                    audio,
                    sourceMessageId: ctx.message.message_id,
                    promptMessageId: prompt.message_id,
                });

                return;
            }

            await processAudio(ctx, audio, caption, ctx.message.message_id, captionEntities);
            return;
        }

        await reply(ctx, t(ctx, 'expectedAudio'));
    });
};
