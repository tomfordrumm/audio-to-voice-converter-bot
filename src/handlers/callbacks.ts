import type {Bot} from 'grammy';
import {t} from '../i18n';
import {logger} from '../logger';
import {getAuthorizedConversion, userChatKey} from '../services/conversions';
import type {PendingStateStore} from '../services/pending-state';
import {sendCreditsInvoice} from '../services/payments';
import {reply} from '../services/reply';

export type PendingCaptionEdit = {
    conversionId: number;
    chatId: number;
    messageId: number;
};

export type PendingCaptionEdits = PendingStateStore<PendingCaptionEdit>;

export const registerCallbackHandlers = (bot: Bot, pendingCaptionEdits: PendingCaptionEdits) => {
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

        pendingCaptionEdits.set(key, {
            conversionId,
            chatId: ctx.chat.id,
            messageId: ctx.callbackQuery.message?.message_id || 0,
        });

        await ctx.answerCallbackQuery(t(ctx, 'sendNewCaption'));
        await reply(ctx, t(ctx, 'sendNewCaption'));
    });
};
