-- CreateTable
CREATE TABLE "LearningEvent" (
    "id" BIGSERIAL NOT NULL,
    "schoolId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "verb" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" UUID NOT NULL,
    "result" JSONB,
    "context" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningEvent_schoolId_timestamp_idx" ON "LearningEvent"("schoolId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "LearningEvent_actorId_timestamp_idx" ON "LearningEvent"("actorId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "LearningEvent_objectType_objectId_idx" ON "LearningEvent"("objectType", "objectId");
