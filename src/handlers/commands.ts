import type {Bot} from 'grammy';
import {t} from '../i18n';
import {upsertUser} from '../repositories';
import {showBalance, userChatKey} from '../services/conversions';
import type {PendingStateStore} from '../services/pending-state';
import {sendCreditsInvoice} from '../services/payments';
import {reply} from '../services/reply';
import type {PendingAudioCaption} from './messages';
import type {PendingCaptionEdit} from './callbacks';

export const configureBotCommands = async (bot: Bot) => {
    await bot.api.setMyCommands([
        {command: 'start', description: 'Start the bot'},
        {command: 'help', description: 'How to use the bot'},
        {command: 'balance', description: 'Show free limit and paid credits'},
        {command: 'buy', description: 'Buy more conversions with Stars'},
        {command: 'cancel', description: 'Cancel current action'},
    ]);

    await bot.api.setMyCommands([
        {command: 'start', description: 'Запустить бота'},
        {command: 'help', description: 'Как пользоваться ботом'},
        {command: 'balance', description: 'Показать лимиты и баланс'},
        {command: 'buy', description: 'Купить конвертации за Stars'},
        {command: 'cancel', description: 'Отменить текущее действие'},
    ], {language_code: 'ru'});
};

export const registerCommandHandlers = (
    bot: Bot,
    pendingAudioCaptions: PendingStateStore<PendingAudioCaption>,
    pendingCaptionEdits: PendingStateStore<PendingCaptionEdit>,
) => {
    bot.command('start', async (ctx) => {
        upsertUser(ctx);
        await reply(ctx, t(ctx, 'start'));
    });

    bot.command('help', async (ctx) => {
        upsertUser(ctx);
        await reply(ctx, t(ctx, 'help'));
    });

    bot.command('balance', async (ctx) => {
        upsertUser(ctx);
        await showBalance(ctx);
    });

    bot.command('buy', async (ctx) => {
        await sendCreditsInvoice(ctx);
    });

    bot.command('cancel', async (ctx) => {
        const key = userChatKey(ctx);

        if (!key) {
            await reply(ctx, t(ctx, 'noPendingAction'));
            return;
        }

        const pendingAudio = pendingAudioCaptions.get(key);
        const hadPendingAudio = pendingAudio !== undefined;
        const pendingEdit = pendingCaptionEdits.get(key);
        const hadPendingEdit = pendingEdit !== undefined;
        pendingAudioCaptions.delete(key);
        pendingCaptionEdits.delete(key);

        if (!hadPendingAudio && !hadPendingEdit) {
            await reply(ctx, t(ctx, 'noPendingAction'));
            return;
        }

        if (pendingEdit?.promptMessageId) {
            try {
                await ctx.api.deleteMessage(pendingEdit.chatId, pendingEdit.promptMessageId);
            } catch {
                // The prompt may already be gone; cancellation should still succeed.
            }
        }

        if (pendingAudio?.promptMessageId && ctx.chat) {
            try {
                await ctx.api.deleteMessage(ctx.chat.id, pendingAudio.promptMessageId);
            } catch {
                // The prompt may already be gone; cancellation should still succeed.
            }
        }

        await reply(ctx, t(ctx, 'cancelled'));
    });
};
