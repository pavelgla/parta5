import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { pino } from 'pino';
import { handleTranscodeVideo } from './jobs/transcode-video.js';
import { handleImportCourse } from './jobs/import-course.js';
import { handleExpireAttempts } from './jobs/expire-attempts.js';

const log = pino({
  name: 'worker',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
});

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

connection.on('connect', () => log.info('Redis connected'));
connection.on('error', (err) => log.error({ err }, 'Redis error'));

const worker = new Worker(
  'video-transcode',
  async (job) => {
    log.info({ jobId: job.id, name: job.name }, 'Processing job');
    if (job.name === 'transcode-video') {
      await handleTranscodeVideo(job);
    }
  },
  { connection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2) },
);

worker.on('completed', (job) => log.info({ jobId: job.id }, 'Job completed'));
worker.on('failed', (job, err) => log.error({ jobId: job?.id, err }, 'Job failed'));

// Course import is a long-running single-shot job (extract mbz, upload files,
// create course/modules/lessons in one pass) — concurrency 1 and a generous
// lock so a slow import doesn't get treated as stalled and re-picked up.
const importWorker = new Worker(
  'course-import',
  async (job) => {
    log.info({ jobId: job.id, name: job.name }, 'Processing import job');
    if (job.name === 'import-course') {
      await handleImportCourse(job);
    }
  },
  {
    connection,
    concurrency: 1,
    lockDuration: 10 * 60_000,
    maxStalledCount: 1,
  },
);

importWorker.on('completed', (job) => log.info({ jobId: job.id }, 'Import job completed'));
importWorker.on('failed', (job, err) => log.error({ jobId: job?.id, err }, 'Import job failed'));

// Periodic maintenance: closes quiz attempts that ran past their time limit
// and were never submitted by the client. Concurrency 1 — cheap, low-volume,
// no need to parallelize the per-run sweep.
const maintenanceQueue = new Queue('quiz-maintenance', { connection });

const maintenanceWorker = new Worker(
  'quiz-maintenance',
  async (job) => {
    log.info({ jobId: job.id, name: job.name }, 'Processing maintenance job');
    if (job.name === 'expire-attempts') {
      await handleExpireAttempts();
    }
  },
  { connection, concurrency: 1 },
);

maintenanceWorker.on('completed', (job) =>
  log.info({ jobId: job.id }, 'Maintenance job completed'),
);
maintenanceWorker.on('failed', (job, err) =>
  log.error({ jobId: job?.id, err }, 'Maintenance job failed'),
);

await maintenanceQueue.upsertJobScheduler(
  'expire-attempts',
  { every: 60_000 },
  {
    name: 'expire-attempts',
  },
);

log.info('Worker started, waiting for jobs');

process.on('SIGTERM', async () => {
  await worker.close();
  await importWorker.close();
  await maintenanceWorker.close();
  await maintenanceQueue.close();
  connection.disconnect();
  process.exit(0);
});
