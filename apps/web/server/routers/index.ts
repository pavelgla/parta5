import { router } from '../trpc/init';
import { courseRouter } from './course';
import { moduleRouter } from './module';
import { lessonRouter } from './lesson';
import { blockRouter } from './block';
import { enrollmentRouter } from './enrollment';

export const appRouter = router({
  course: courseRouter,
  module: moduleRouter,
  lesson: lessonRouter,
  block: blockRouter,
  enrollment: enrollmentRouter,
});

export type AppRouter = typeof appRouter;
