-- CreateEnum
CREATE TYPE "VideoAssetStatus" AS ENUM ('PENDING', 'UPLOADING', 'TRANSCODING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "VideoAsset" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "schoolId" UUID NOT NULL,
    "uploaderId" UUID NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "hlsMasterKey" TEXT,
    "posterKey" TEXT,
    "durationSeconds" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "status" "VideoAssetStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoAsset_sourceKey_key" ON "VideoAsset"("sourceKey");

-- CreateIndex
CREATE INDEX "VideoAsset_schoolId_idx" ON "VideoAsset"("schoolId");

-- CreateIndex
CREATE INDEX "VideoAsset_status_idx" ON "VideoAsset"("status");

-- AddForeignKey
ALTER TABLE "VideoAsset" ADD CONSTRAINT "VideoAsset_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
