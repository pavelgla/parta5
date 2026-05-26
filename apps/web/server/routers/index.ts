import { router } from '../trpc/init';
import { courseRouter } from './course';
import { moduleRouter } from './module';
import { lessonRouter } from './lesson';
import { blockRouter } from './block';
import { enrollmentRouter } from './enrollment';
import { learnRouter } from './learn';

export const appRouter = router({
  course: courseRouter,
  module: moduleRouter,
  lesson: lessonRouter,
  block: blockRouter,
  enrollment: enrollmentRouter,
  learn: learnRouter,
});

export type AppRouter = typeof appRouter;
