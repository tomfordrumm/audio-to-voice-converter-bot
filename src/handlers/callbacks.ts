import type {Bot} from 'grammy';
import {t} from '../i18n';
import {logger} from '../logger';
import {getAuthorizedConversion, processAudio, userChatKey} from '../services/conversions';
import type {PendingStateStore} from '../services/pending-state';
import {sendCreditsInvoice} from '../services/payments';
import {cancelKeyboard} from '../keyboards';
import type {PendingAudioCaptions} from './messages';

export type PendingCaptionEdit = {
    conversionId: number;
    chatId: number;
    messageId: number;
    promptMessageId?: number;
};

export type PendingCaptionEdits = PendingStateStore<PendingCaptionEdit>;

export const registerCallbackHandlers = (
    bot: Bot,
    pendingAudioCaptions: PendingAudioCaptions,
    pendingCaptionEdits: PendingCaptionEdits,
) => {
    bot.on('callback_query:data', async (ctx) => {
        const data = ctx.callbackQuery.data;

        if (data === 'buy_credits') {
            await ctx.answerCallbackQuery();
            await sendCreditsInvoice(ctx);
            return;
        }

        if (data.startsWith('remove_buttons:')) {
            const conversionId = Number(data.replace('remove_buttons:', ''));

            if (!ctx.chat || !ctx.callbackQuery.message?.message_id || !Number.isInteger(conversionId)) {
                await ctx.answerCallbackQuery(t(ctx, 'removeButtonsError'));
                return;
            }

            if (!getAuthorizedConversion(ctx, conversionId)) {
                await ctx.answerCallbackQuery(t(ctx, 'notYourConversion'));
                return;
            }

            try {
                await ctx.api.editMessageReplyMarkup(ctx.chat.id, ctx.callbackQuery.message.message_id, {
                    reply_markup: undefined,
                });
                await ctx.answerCallbackQuery(t(ctx, 'removeButtonsSuccess'));
            } catch (error) {
                logger.error('Could not remove inline buttons.', {
                    telegramUserId: ctx.from?.id,
                    chatId: ctx.chat.id,
                    messageId: ctx.callbackQuery.message.message_id,
                    conversionId,
                    error,
                });
                await ctx.answerCallbackQuery(t(ctx, 'removeButtonsError'));
            }

            return;
        }

        if (data.startsWith('cancel_pending:')) {
            const key = userChatKey(ctx);
            const [, pendingType, pendingId] = data.split(':');
            const expectedId = Number(pendingId);

            if (!key || !Number.isInteger(expectedId)) {
                await ctx.answerCallbackQuery(t(ctx, 'noPendingAction'));
                return;
            }

            const pendingAudio = pendingAudioCaptions.get(key);
            const pendingEdit = pendingCaptionEdits.get(key);
            const isAudioCancel = pendingType === 'audio' && pendingAudio?.sourceMessageId === expectedId;
            const isEditCancel = pendingType === 'edit' && pendingEdit?.conversionId === expectedId;

            if (!isAudioCancel && !isEditCancel) {
                await ctx.answerCallbackQuery(t(ctx, 'actionExpired'));
                return;
            }

            if (isAudioCancel) {
                pendingAudioCaptions.delete(key);
            }

            if (isEditCancel) {
                pendingCaptionEdits.delete(key);
            }

            await ctx.answerCallbackQuery(t(ctx, 'cancelled'));

            try {
                if (ctx.chat && ctx.callbackQuery.message?.message_id) {
                    await ctx.api.editMessageText(ctx.chat.id, ctx.callbackQuery.message.message_id, t(ctx, 'cancelled'), {
                        parse_mode: 'HTML',
                    });
                }
            } catch (error) {
                logger.error('Could not update cancelled pending prompt.', {
                    telegramUserId: ctx.from?.id,
                    chatId: ctx.chat?.id,
                    error,
                });
            }
            return;
        }

        if (data.startsWith('convert_without_caption:')) {
            const key = userChatKey(ctx);
            const sourceMessageId = Number(data.replace('convert_without_caption:', ''));

            if (!key || !Number.isInteger(sourceMessageId)) {
                await ctx.answerCallbackQuery(t(ctx, 'missingAudioForCaption'));
                return;
            }

            const pending = pendingAudioCaptions.get(key);

            if (!pending || pending.sourceMessageId !== sourceMessageId) {
                await ctx.answerCallbackQuery(t(ctx, 'actionExpired'));
                return;
            }

            pendingAudioCaptions.delete(key);
            await ctx.answerCallbackQuery();

            try {
                if (ctx.chat && ctx.callbackQuery.message?.message_id) {
                    await ctx.api.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id);
                }
            } catch (error) {
                logger.error('Could not delete caption prompt.', {
                    telegramUserId: ctx.from?.id,
                    chatId: ctx.chat?.id,
                    error,
                });
            }

            await processAudio(ctx, pending.audio, '', pending.sourceMessageId);
            return;
        }

        if (!data.startsWith('edit_caption:')) {
            await ctx.answerCallbackQuery();
            return;
        }

        const key = userChatKey(ctx);
        const conversionId = Number(data.replace('edit_caption:', ''));

        if (!key || !ctx.chat || !Number.isInteger(conversionId)) {
            await ctx.answerCallbackQuery(t(ctx, 'editStartError'));
            return;
        }

        if (!getAuthorizedConversion(ctx, conversionId)) {
            await ctx.answerCallbackQuery(t(ctx, 'notYourConversion'));
            return;
        }

        const pendingAudio = pendingAudioCaptions.get(key);
        if (pendingAudio) {
            pendingAudioCaptions.delete(key);

            if (pendingAudio.promptMessageId) {
                try {
                    await ctx.api.deleteMessage(ctx.chat.id, pendingAudio.promptMessageId);
                } catch {
                    // The previous prompt may already be gone.
                }
            }
        }

        const pendingEdit = pendingCaptionEdits.get(key);
        if (pendingEdit) {
            pendingCaptionEdits.delete(key);

            if (pendingEdit.promptMessageId) {
                try {
                    await ctx.api.deleteMessage(pendingEdit.chatId, pendingEdit.promptMessageId);
                } catch {
                    // The previous prompt may already be gone.
                }
            }
        }

        await ctx.answerCallbackQuery();

        const prompt = await ctx.reply(t(ctx, 'sendNewCaption'), {
            parse_mode: 'HTML',
            reply_markup: cancelKeyboard(ctx, conversionId),
        });

        pendingCaptionEdits.set(key, {
            conversionId,
            chatId: ctx.chat.id,
            messageId: ctx.callbackQuery.message?.message_id || 0,
            promptMessageId: prompt.message_id,
        });
    });
};
