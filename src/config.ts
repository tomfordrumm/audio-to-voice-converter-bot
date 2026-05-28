import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const positiveIntegerFromEnv = (name: string, defaultValue: number) => {
    const rawValue = process.env[name];

    if (rawValue === undefined || rawValue === '') {
        return defaultValue;
    }

    const value = Number(rawValue);

    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer.`);
    }

    return value;
};

const token = process.env.TOKEN;

if (!token) {
    throw new Error('TOKEN environment variable is required.');
}

export const config = {
    token,
    outputDir: 'output',
    databasePath: process.env.DATABASE_PATH || path.join('data', 'bot.sqlite'),
    freeDailyConversions: positiveIntegerFromEnv('FREE_DAILY_CONVERSIONS', 10),
    creditPackSize: positiveIntegerFromEnv('CREDIT_PACK_SIZE', 100),
    creditPackStars: positiveIntegerFromEnv('CREDIT_PACK_STARS', 50),
    maxAudioFileSizeBytes: positiveIntegerFromEnv('MAX_AUDIO_FILE_SIZE_MB', 20) * 1024 * 1024,
    maxAudioDurationSeconds: positiveIntegerFromEnv('MAX_AUDIO_DURATION_SECONDS', 600),
    maxConcurrentConversions: positiveIntegerFromEnv('MAX_CONCURRENT_CONVERSIONS', 2),
    maxQueuedConversions: positiveIntegerFromEnv('MAX_QUEUED_CONVERSIONS', 20),
    ffmpegTimeoutMs: positiveIntegerFromEnv('FFMPEG_TIMEOUT_MS', 120000),
    pendingStateTtlSeconds: positiveIntegerFromEnv('PENDING_STATE_TTL_SECONDS', 900),
};

export const ensureRuntimeDirectories = () => {
    if (!fs.existsSync(config.outputDir)) {
        fs.mkdirSync(config.outputDir, {recursive: true});
    }

    const databaseDir = path.dirname(config.databasePath);

    if (databaseDir !== '.' && !fs.existsSync(databaseDir)) {
        fs.mkdirSync(databaseDir, {recursive: true});
    }
};
