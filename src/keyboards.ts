import {InlineKeyboard, type Context} from 'grammy';
import {t} from './i18n';

export const editCaptionKeyboard = (ctx: Context, conversionId: number) => new InlineKeyboard()
    .text(t(ctx, 'changeCaptionButton'), `edit_caption:${conversionId}`)
    .text(t(ctx, 'removeButtonsButton'), `remove_buttons:${conversionId}`);

export const buyCreditsKeyboard = (ctx: Context) => new InlineKeyboard()
    .text(t(ctx, 'buyCredits'), 'buy_credits');

