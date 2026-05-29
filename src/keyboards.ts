import {InlineKeyboard, type Context} from 'grammy';
import {t} from './i18n';

export const editCaptionKeyboard = (ctx: Context, conversionId: number) => new InlineKeyboard()
    .text(t(ctx, 'changeCaptionButton'), `edit_caption:${conversionId}`)
    .text(t(ctx, 'removeButtonsButton'), `remove_buttons:${conversionId}`);

export const pendingAudioCaptionKeyboard = (ctx: Context, sourceMessageId: number) => new InlineKeyboard()
    .text(t(ctx, 'convertWithoutCaptionButton'), `convert_without_caption:${sourceMessageId}`)
    .row()
    .text(t(ctx, 'cancelButton'), `cancel_pending:audio:${sourceMessageId}`);

export const cancelKeyboard = (ctx: Context, conversionId: number) => new InlineKeyboard()
    .text(t(ctx, 'cancelButton'), `cancel_pending:edit:${conversionId}`);

export const buyCreditsKeyboard = (ctx: Context) => new InlineKeyboard()
    .text(t(ctx, 'buyCredits'), 'buy_credits');
