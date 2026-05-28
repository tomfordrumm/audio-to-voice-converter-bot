import type {Context} from 'grammy';
import {config} from '../config';
import {t} from '../i18n';
import {createStarPayment, getStarPaymentForCheckout, upsertUser} from '../repositories';

export const sendCreditsInvoice = async (ctx: Context) => {
    if (!ctx.from) {
        return;
    }

    upsertUser(ctx);

    const payload = createStarPayment(ctx.from.id);

    await ctx.replyWithInvoice(
        t(ctx, 'invoiceTitle'),
        t(ctx, 'invoiceDescription'),
        payload,
        '',
        'XTR',
        [{label: t(ctx, 'invoiceLabel'), amount: config.creditPackStars}],
    );
};

export const isValidCheckout = (ctx: Context) => {
    const query = ctx.preCheckoutQuery;

    if (!query) {
        return false;
    }

    const payment = getStarPaymentForCheckout(query.invoice_payload);

    return Boolean(
        payment &&
        payment.telegram_user_id === query.from.id &&
        payment.stars === query.total_amount &&
        payment.credits === config.creditPackSize &&
        query.currency === 'XTR' &&
        payment.status === 'invoice_sent',
    );
};
