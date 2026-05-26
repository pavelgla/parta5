import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffprobePath from '@ffprobe-installer/ffprobe';
import type { Job } from 'bullmq';
import { prisma } from '@parta5/db';
import { createStorageFromEnv } from '@parta5/storage';
import { pino } from 'pino';

ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

const log = pino({ name: 'transcode-video' });
const storage = createStorageFromEnv();

export interface TranscodeVideoJob {
  videoAssetId: string;
}

function ffprobePromise(
  filePath: string,
): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const stream = metadata.streams.find((s) => s.codec_type === 'video');
      resolve({
        duration: Math.round(metadata.format.duration ?? 0),
        width: stream?.width ?? 0,
        height: stream?.height ?? 0,
      });
    });
  });
}

function runFfmpeg(command: ffmpeg.FfmpegCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    command
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err))
      .run();
  });
}

export async function handleTranscodeVideo(job: Job<TranscodeVideoJob>): Promise<void> {
  const { videoAssetId } = job.data;
  const tmpDir = await mkdtemp(join(tmpdir(), `parta5-video-${videoAssetId}-`));

  try {
    const asset = await prisma.videoAsset.findUniqueOrThrow({ where: { id: videoAssetId } });

    await prisma.videoAsset.update({
      where: { id: videoAssetId },
      data: { status: 'TRANSCODING' },
    });

    // Download source file
    const sourceFile = join(tmpDir, 'source.mp4');
    const stream = await storage.getObjectStream(asset.sourceKey);
    await pipeline(stream as NodeJS.ReadableStream, createWriteStream(sourceFile));

    // Probe metadata
    const { duration, width, height } = await ffprobePromise(sourceFile);
    await prisma.videoAsset.update({
      where: { id: videoAssetId },
      data: { durationSeconds: duration, width, height },
    });

    // Generate poster
    const posterFile = join(tmpDir, 'poster.jpg');
    await runFfmpeg(ffmpeg(sourceFile).outputOptions(['-vframes', '1', '-an']).output(posterFile));
    const posterKey = `schools/${asset.schoolId}/posters/${videoAssetId}.jpg`;
    await storage.putObjectFromPath(posterKey, posterFile, 'image/jpeg');

    // Transcode HLS
    const hlsDir = join(tmpDir, 'hls');
    await mkdir(hlsDir);

    const qualities = [
      { name: '360p', scale: 640, bitrate: '800k', audioBitrate: '96k' },
      { name: '720p', scale: 1280, bitrate: '2800k', audioBitrate: '128k' },
      { name: '1080p', scale: 1920, bitrate: '5000k', audioBitrate: '192k' },
    ].filter((q) => q.scale <= (width || 1920));

    // Build ffmpeg command for all variants at once
    const cmd = ffmpeg(sourceFile);
    const varStreamMap: string[] = [];

    qualities.forEach((q, i) => {
      cmd
        .outputOptions([
          `-map 0:v:0`,
          `-map 0:a:0`,
          `-c:v:${i} libx264`,
          `-c:a:${i} aac`,
          `-b:v:${i} ${q.bitrate}`,
          `-b:a:${i} ${q.audioBitrate}`,
          `-vf:${i} scale=${q.scale}:-2`,
          `-preset fast`,
          `-crf 23`,
        ])
        .outputOptions([`-hls_time 6`, `-hls_playlist_type vod`]);
      varStreamMap.push(`v:${i},a:${i},name:${q.name}`);
    });

    cmd
      .outputOptions([
        `-var_stream_map`,
        varStreamMap.join(' '),
        `-master_pl_name master.m3u8`,
        `-hls_segment_filename ${hlsDir}/%v/seg%03d.ts`,
      ])
      .output(`${hlsDir}/%v/index.m3u8`);

    await runFfmpeg(cmd);

    // Upload HLS files to S3
    const hlsPrefix = `schools/${asset.schoolId}/hls/${videoAssetId}`;
    const { readdir } = await import('node:fs/promises');

    const masterM3u8 = join(hlsDir, 'master.m3u8');
    const masterKey = `${hlsPrefix}/master.m3u8`;
    await storage.putObjectFromPath(masterKey, masterM3u8, 'application/x-mpegURL');

    for (const variantName of qualities.map((q) => q.name)) {
      const varDir = join(hlsDir, variantName);
      let files: string[];
      try {
        files = await readdir(varDir);
      } catch {
        continue;
      }
      for (const file of files) {
        const filePath = join(varDir, file);
        const key = `${hlsPrefix}/${variantName}/${file}`;
        const contentType = file.endsWith('.m3u8') ? 'application/x-mpegURL' : 'video/MP2T';
        await storage.putObjectFromPath(key, filePath, contentType);
      }
    }

    await prisma.videoAsset.update({
      where: { id: videoAssetId },
      data: {
        status: 'READY',
        hlsMasterKey: masterKey,
        posterKey,
        durationSeconds: duration,
        width,
        height,
      },
    });

    log.info({ videoAssetId }, 'Transcoding complete');
  } catch (err) {
    log.error({ videoAssetId, err }, 'Transcoding failed');
    await prisma.videoAsset.update({
      where: { id: videoAssetId },
      data: { status: 'FAILED', errorMessage: String(err) },
    });
    throw err;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
