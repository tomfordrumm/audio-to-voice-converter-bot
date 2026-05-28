import {db} from './database';
import {createBot} from './bot-app';
import {logger} from './logger';

const {bot, configure, stopPendingState} = createBot();

bot.catch((error) => {
    logger.error('Unhandled bot error.', {error: error.error});
});

const shutdown = async (signal: NodeJS.Signals) => {
    logger.info('Received shutdown signal. Stopping bot.', {signal});

    try {
        bot.stop();
    } catch (error) {
        logger.error('Could not stop bot cleanly.', {signal, error});
    }

    stopPendingState();

    try {
        db.close();
    } catch (error) {
        logger.error('Could not close database cleanly.', {signal, error});
    }
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

configure()
    .catch((error) => {
        logger.error('Could not configure bot commands.', {error});
    })
    .finally(() => {
        bot.start();
    });
