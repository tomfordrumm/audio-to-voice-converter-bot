import {Bot} from 'grammy';
import {config, ensureRuntimeDirectories} from './config';
import {initializeDatabase} from './database';
import {registerCallbackHandlers, type PendingCaptionEdits} from './handlers/callbacks';
import {configureBotCommands, registerCommandHandlers} from './handlers/commands';
import {registerMessageHandlers, type PendingAudioCaptions} from './handlers/messages';
import {PendingStateStore} from './services/pending-state';

export const createBot = () => {
    ensureRuntimeDirectories();
    initializeDatabase();

    const bot = new Bot(config.token);
    const pendingStateTtlMs = config.pendingStateTtlSeconds * 1000;
    const pendingCleanupIntervalMs = Math.max(60000, Math.floor(pendingStateTtlMs / 2));
    const pendingAudioCaptions: PendingAudioCaptions = new PendingStateStore({
        namespace: 'audio_caption',
        ttlMs: pendingStateTtlMs,
        cleanupIntervalMs: pendingCleanupIntervalMs,
    });
    const pendingCaptionEdits: PendingCaptionEdits = new PendingStateStore({
        namespace: 'caption_edit',
        ttlMs: pendingStateTtlMs,
        cleanupIntervalMs: pendingCleanupIntervalMs,
    });

    registerCommandHandlers(bot);
    registerCallbackHandlers(bot, pendingCaptionEdits);
    registerMessageHandlers(bot, pendingAudioCaptions, pendingCaptionEdits);

    return {
        bot,
        configure: () => configureBotCommands(bot),
        stopPendingState: () => {
            pendingAudioCaptions.stop();
            pendingCaptionEdits.stop();
        },
    };
};
