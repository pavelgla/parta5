-- CreateTable
CREATE TABLE "LessonCompletion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lessonId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonCompletion_userId_idx" ON "LessonCompletion"("userId");

-- CreateIndex
CREATE INDEX "LessonCompletion_schoolId_idx" ON "LessonCompletion"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonCompletion_lessonId_userId_key" ON "LessonCompletion"("lessonId", "userId");

-- AddForeignKey
ALTER TABLE "LessonCompletion" ADD CONSTRAINT "LessonCompletion_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonCompletion" ADD CONSTRAINT "LessonCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "LessonCompletion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LessonCompletion" FORCE ROW LEVEL SECURITY;
CREATE POLICY school_isolation ON "LessonCompletion"
  USING ("schoolId" = current_setting('app.current_school_id', true)::uuid);
