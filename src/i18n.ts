import type {Context} from 'grammy';
import {config} from './config';

const messages = {
    en: {
        start: '<b>🎙 Audio to Voice</b>\n\nSend me an audio file, then add a caption. I will convert it into a Telegram voice message.\n\nYou can edit the caption after conversion and remove the buttons before forwarding.',
        help: '<b>✨ How it works</b>\n\n1. Send an audio file.\n2. Add a caption right away or send it as the next message.\n3. Edit the caption with the button under the voice message.\n4. Remove buttons before forwarding.\n\nUse /balance to check your limits and /buy to get more conversions.',
        expectedAudio: '🎧 <b>Please send an audio file.</b>\n\nYou can attach a caption immediately or send it as the next text message.',
        processing: '⏳ <b>Processing audio...</b>\n\nConverting it into a voice message.',
        conversionError: '⚠️ <b>Conversion failed.</b>\n\nPlease try again.',
        audioTooLarge: '⚠️ <b>Audio file is too large.</b>\n\nPlease send a file up to {limitMb} MB.',
        audioTooLong: '⚠️ <b>Audio is too long.</b>\n\nPlease send audio up to {limitMinutes} minutes.',
        conversionQueueFull: '⏳ <b>Too many conversions are running right now.</b>\n\nPlease try again in a few minutes.',
        voiceMessagesForbidden: '🚫 <b>Voice messages are blocked.</b>\n\nTelegram did not allow me to send a voice message to this chat. Please allow voice messages in your Telegram privacy/settings and try again.',
        sendCaption: '✍️ <b>Send the caption</b>\n\nReply with the text you want to attach to this voice message.',
        sendNewCaption: '✏️ <b>Send the new caption</b>\n\nYour next text message will replace the current caption.',
        captionTooLong: '⚠️ <b>Caption is too long.</b>\n\nPlease send up to 1024 characters.',
        missingAudioForCaption: '⚠️ <b>Audio not found.</b>\n\nPlease send the audio file again.',
        missingVoiceToEdit: '⚠️ <b>Voice message not found.</b>\n\nPlease try the edit flow again.',
        captionUpdated: '✅ <b>Caption updated.</b>',
        captionUpdateError: '⚠️ <b>Could not update the caption.</b>\n\nPlease try again.',
        editStartError: 'Could not start caption editing.',
        removeButtonsError: 'Could not remove buttons.',
        removeButtonsSuccess: 'Buttons removed.',
        notYourConversion: 'This voice message belongs to another user.',
        limitReached: '🔒 <b>Daily free limit reached.</b>\n\nBuy a credits pack to keep converting today.',
        buyCredits: `Buy ${config.creditPackSize} conversions for ${config.creditPackStars} Stars`,
        invoiceTitle: `${config.creditPackSize} voice conversions`,
        invoiceDescription: `Adds ${config.creditPackSize} paid conversions to your bot balance.`,
        invoiceLabel: `${config.creditPackSize} conversions`,
        paymentReceived: `✅ <b>Payment received.</b>\n\nAdded ${config.creditPackSize} conversions to your balance.`,
        paymentRejected: 'Could not approve this payment. Please try again.',
        balance: '📊 <b>Your balance</b>\n\nFree conversions today: <b>{freeRemaining}/{freeLimit}</b>\nPaid conversions: <b>{credits}</b>',
        changeCaptionButton: '✏️ Change caption',
        removeButtonsButton: '🧹 Remove buttons',
    },
    ru: {
        start: '<b>🎙 Audio to Voice</b>\n\nОтправь мне аудиофайл и добавь подпись. Я превращу его в голосовое сообщение Telegram.\n\nПосле конвертации подпись можно изменить, а кнопки убрать перед пересылкой.',
        help: '<b>✨ Как это работает</b>\n\n1. Отправь аудиофайл.\n2. Добавь подпись сразу или отправь ее следующим сообщением.\n3. Измени подпись кнопкой под voice-сообщением.\n4. Убери кнопки перед пересылкой.\n\nКоманда /balance покажет лимиты, /buy купит дополнительные конвертации.',
        expectedAudio: '🎧 <b>Отправь аудиофайл.</b>\n\nПодпись можно добавить сразу или отправить следующим текстовым сообщением.',
        processing: '⏳ <b>Обрабатываю аудио...</b>\n\nКонвертирую его в голосовое сообщение.',
        conversionError: '⚠️ <b>Конвертация не удалась.</b>\n\nПопробуй еще раз.',
        audioTooLarge: '⚠️ <b>Файл слишком большой.</b>\n\nОтправь файл до {limitMb} МБ.',
        audioTooLong: '⚠️ <b>Аудио слишком длинное.</b>\n\nОтправь аудио до {limitMinutes} минут.',
        conversionQueueFull: '⏳ <b>Сейчас обрабатывается слишком много аудио.</b>\n\nПопробуй еще раз через несколько минут.',
        voiceMessagesForbidden: '🚫 <b>Голосовые сообщения заблокированы.</b>\n\nTelegram не разрешил отправить voice в этот чат. Разреши голосовые сообщения в настройках Telegram и попробуй еще раз.',
        sendCaption: '✍️ <b>Отправь подпись</b>\n\nСледующее текстовое сообщение станет подписью к voice.',
        sendNewCaption: '✏️ <b>Отправь новую подпись</b>\n\nСледующее текстовое сообщение заменит текущую подпись.',
        captionTooLong: '⚠️ <b>Подпись слишком длинная.</b>\n\nОтправь текст до 1024 символов.',
        missingAudioForCaption: '⚠️ <b>Аудио не найдено.</b>\n\nОтправь аудиофайл еще раз.',
        missingVoiceToEdit: '⚠️ <b>Voice-сообщение не найдено.</b>\n\nПопробуй запустить редактирование еще раз.',
        captionUpdated: '✅ <b>Подпись обновлена.</b>',
        captionUpdateError: '⚠️ <b>Не получилось обновить подпись.</b>\n\nПопробуй еще раз.',
        editStartError: 'Не получилось начать редактирование подписи.',
        removeButtonsError: 'Не получилось убрать кнопки.',
        removeButtonsSuccess: 'Кнопки убраны.',
        notYourConversion: 'Это voice-сообщение принадлежит другому пользователю.',
        limitReached: '🔒 <b>Бесплатный лимит на сегодня закончился.</b>\n\nКупи пакет конвертаций, чтобы продолжить.',
        buyCredits: `Купить ${config.creditPackSize} конвертаций за ${config.creditPackStars} Stars`,
        invoiceTitle: `${config.creditPackSize} конвертаций в voice`,
        invoiceDescription: `Добавляет ${config.creditPackSize} платных конвертаций на баланс бота.`,
        invoiceLabel: `${config.creditPackSize} конвертаций`,
        paymentReceived: `✅ <b>Оплата получена.</b>\n\nДобавлено ${config.creditPackSize} конвертаций на баланс.`,
        paymentRejected: 'Не получилось подтвердить платеж. Попробуй еще раз.',
        balance: '📊 <b>Твой баланс</b>\n\nБесплатные конвертации сегодня: <b>{freeRemaining}/{freeLimit}</b>\nПлатные конвертации: <b>{credits}</b>',
        changeCaptionButton: '✏️ Изменить подпись',
        removeButtonsButton: '🧹 Убрать кнопки',
    },
} as const;

export type MessageKey = keyof typeof messages.en;

export const locale = (ctx: Context): keyof typeof messages => {
    return ctx.from?.language_code?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
};

export const t = (ctx: Context, key: MessageKey) => messages[locale(ctx)][key];

export const formatMessage = (template: string, values: Record<string, string | number>) => {
    return Object.entries(values).reduce((message, [key, value]) => {
        return message.replace(`{${key}}`, String(value));
    }, template);
};
