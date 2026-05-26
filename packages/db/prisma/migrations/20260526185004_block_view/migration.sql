-- CreateTable
CREATE TABLE "BlockView" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blockId" UUID NOT NULL,
    "lessonId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "watchedSeconds" INTEGER,

    CONSTRAINT "BlockView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlockView_userId_idx" ON "BlockView"("userId");

-- CreateIndex
CREATE INDEX "BlockView_lessonId_idx" ON "BlockView"("lessonId");

-- CreateIndex
CREATE INDEX "BlockView_schoolId_idx" ON "BlockView"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockView_blockId_userId_key" ON "BlockView"("blockId", "userId");

-- AddForeignKey
ALTER TABLE "BlockView" ADD CONSTRAINT "BlockView_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "ContentBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockView" ADD CONSTRAINT "BlockView_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockView" ADD CONSTRAINT "BlockView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
