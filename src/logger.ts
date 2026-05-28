import {config} from './config';
import {errorMessage} from './errors';

type LogLevel = 'info' | 'warn' | 'error';
type LogContext = Record<string, unknown>;

const sanitizeValue = (value: unknown): unknown => {
    if (value instanceof Error) {
        return {
            name: value.name,
            message: errorMessage(value),
            stack: value.stack ? value.stack.split(config.token).join('[bot-token]') : undefined,
        };
    }

    if (typeof value === 'string') {
        return value.split(config.token).join('[bot-token]');
    }

    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, sanitizeValue(item)]),
        );
    }

    return value;
};

const writeLog = (level: LogLevel, message: string, context: LogContext = {}) => {
    const payload = {
        level,
        message,
        timestamp: new Date().toISOString(),
        ...sanitizeValue(context) as LogContext,
    };
    const line = JSON.stringify(payload);

    if (level === 'error') {
        console.error(line);
        return;
    }

    console.log(line);
};

export const logger = {
    info: (message: string, context?: LogContext) => writeLog('info', message, context),
    warn: (message: string, context?: LogContext) => writeLog('warn', message, context),
    error: (message: string, context?: LogContext) => writeLog('error', message, context),
};
