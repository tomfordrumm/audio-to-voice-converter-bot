import {GrammyError} from 'grammy';
import {config} from './config';

export const sanitizeErrorMessage = (message: string) => {
    return message.split(config.token).join('[bot-token]');
};

export const errorMessage = (error: unknown) => {
    if (error instanceof Error) {
        return sanitizeErrorMessage(error.message);
    }

    return sanitizeErrorMessage(String(error));
};

export const isVoiceMessagesForbiddenError = (error: unknown) => {
    return error instanceof GrammyError && error.description.includes('VOICE_MESSAGES_FORBIDDEN');
};
