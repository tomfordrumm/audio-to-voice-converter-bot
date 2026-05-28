import {randomUUID} from 'crypto';
import {config} from '../config';
import {db} from '../database';
import {now} from '../time';

export const createStarPayment = (telegramUserId: number) => {
    const payload = `credits:${telegramUserId}:${randomUUID()}`;
    const createdAt = now();

    db.prepare(`
        INSERT INTO star_payments (
            payload,
            telegram_user_id,
            stars,
            credits,
            status,
            created_at,
            updated_at
        ) VALUES (
            @payload,
            @telegram_user_id,
            @stars,
            @credits,
            'invoice_sent',
            @created_at,
            @updated_at
        )
    `).run({
        payload,
        telegram_user_id: telegramUserId,
        stars: config.creditPackStars,
        credits: config.creditPackSize,
        created_at: createdAt,
        updated_at: createdAt,
    });

    return payload;
};

export const getStarPaymentForCheckout = (payload: string) => {
    return db.prepare(`
        SELECT id, telegram_user_id, stars, credits, status
        FROM star_payments
        WHERE payload = ?
    `).get(payload) as {
        id: number;
        telegram_user_id: number;
        stars: number;
        credits: number;
        status: string;
    } | undefined;
};

export const completeStarPayment = db.transaction((
    telegramUserId: number,
    payload: string,
    stars: number,
    telegramPaymentChargeId: string,
    providerPaymentChargeId: string,
) => {
    const updatedAt = now();
    const result = db.prepare(`
        UPDATE star_payments
        SET
            status = 'paid',
            telegram_payment_charge_id = @telegram_payment_charge_id,
            provider_payment_charge_id = @provider_payment_charge_id,
            updated_at = @updated_at
        WHERE payload = @payload
          AND telegram_user_id = @telegram_user_id
          AND stars = @stars
          AND credits = @credits
          AND status = 'invoice_sent'
    `).run({
        payload,
        telegram_user_id: telegramUserId,
        stars,
        credits: config.creditPackSize,
        telegram_payment_charge_id: telegramPaymentChargeId,
        provider_payment_charge_id: providerPaymentChargeId,
        updated_at: updatedAt,
    });

    if (result.changes === 0) {
        return false;
    }

    db.prepare(`
        UPDATE users
        SET paid_credits = paid_credits + @credits,
            updated_at = @updated_at
        WHERE telegram_user_id = @telegram_user_id
    `).run({
        telegram_user_id: telegramUserId,
        credits: config.creditPackSize,
        updated_at: updatedAt,
    });

    return true;
});
