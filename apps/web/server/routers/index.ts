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
import { eventsRouter } from './events';
import { importRouter } from './import';
import { questionBankRouter } from './question-bank';
import { quizRouter } from './quiz';
import { attemptRouter } from './attempt';
import { gradebookRouter } from './gradebook';
import { userRouter } from './user';
import { groupRouter } from './group';
import { schoolRouter } from './school';
import { catalogRouter } from './catalog';

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
  events: eventsRouter,
  import: importRouter,
  questionBank: questionBankRouter,
  quiz: quizRouter,
  attempt: attemptRouter,
  gradebook: gradebookRouter,
  user: userRouter,
  group: groupRouter,
  school: schoolRouter,
  catalog: catalogRouter,
});

export type AppRouter = typeof appRouter;
