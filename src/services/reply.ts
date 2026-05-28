import type {Context} from 'grammy';
import {logger} from '../logger';

export const reply = async (ctx: Context, message: string) => {
    try {
        await ctx.reply(message, {parse_mode: 'HTML'});
    } catch (error) {
        logger.error('Could not send reply.', {
            telegramUserId: ctx.from?.id,
            chatId: ctx.chat?.id,
            error,
        });
    }
};
