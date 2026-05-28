import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import {config} from '../config';
import {ConversionQueue} from './conversion-queue';

const resolvedFfmpegPath = ffmpegPath || ffmpegInstaller.path;
ffmpeg.setFfmpegPath(resolvedFfmpegPath);

const conversionQueue = new ConversionQueue(config.maxConcurrentConversions, config.maxQueuedConversions);

export const hasConversionCapacity = () => conversionQueue.hasCapacity();

export const convertToVoiceOgg = async (fileUrl: string, outputPath: string) => {
    await conversionQueue.run(() => new Promise<void>((resolve, reject) => {
        const command = ffmpeg(fileUrl)
            .audioCodec('libopus')
            .audioChannels(1)
            .audioFrequency(48000)
            .audioBitrate('64k')
            .outputOptions('-vn', '-application', 'voip')
            .toFormat('ogg')
            .on('end', () => {
                clearTimeout(timeout);
                resolve();
            })
            .on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });

        const timeout = setTimeout(() => {
            command.kill('SIGKILL');
            reject(new Error(`FFmpeg conversion timed out after ${config.ffmpegTimeoutMs}ms.`));
        }, config.ffmpegTimeoutMs);

        command.save(outputPath);
    }));
};
