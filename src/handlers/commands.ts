import type {Bot} from 'grammy';
import {t} from '../i18n';
import {upsertUser} from '../repositories';
import {showBalance} from '../services/conversions';
import {sendCreditsInvoice} from '../services/payments';
import {reply} from '../services/reply';

export const configureBotCommands = async (bot: Bot) => {
    await bot.api.setMyCommands([
        {command: 'start', description: 'Start the bot'},
        {command: 'help', description: 'How to use the bot'},
        {command: 'balance', description: 'Show free limit and paid credits'},
        {command: 'buy', description: 'Buy more conversions with Stars'},
    ]);

    await bot.api.setMyCommands([
        {command: 'start', description: 'Запустить бота'},
        {command: 'help', description: 'Как пользоваться ботом'},
        {command: 'balance', description: 'Показать лимиты и баланс'},
        {command: 'buy', description: 'Купить конвертации за Stars'},
    ], {language_code: 'ru'});
};

export const registerCommandHandlers = (bot: Bot) => {
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
};
