import { router } from '../trpc/init';
import { courseRouter } from './course';
import { moduleRouter } from './module';
import { lessonRouter } from './lesson';
import { blockRouter } from './block';
import { enrollmentRouter } from './enrollment';
import { learnRouter } from './learn';
import { fileRouter } from './file';
import { videoRouter } from './video';
import { embedRouter } from './embed';
import { progressRouter } from './progress';

export const appRouter = router({
  course: courseRouter,
  module: moduleRouter,
  lesson: lessonRouter,
  block: blockRouter,
  enrollment: enrollmentRouter,
  learn: learnRouter,
  file: fileRouter,
  video: videoRouter,
  embed: embedRouter,
  progress: progressRouter,
});

export type AppRouter = typeof appRouter;
