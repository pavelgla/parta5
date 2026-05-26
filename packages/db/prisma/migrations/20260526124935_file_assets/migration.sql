-- CreateEnum
CREATE TYPE "FileAssetStatus" AS ENUM ('PENDING', 'UPLOADED', 'DELETED');

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "schoolId" UUID NOT NULL,
    "uploaderId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "FileAssetStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileAsset_key_key" ON "FileAsset"("key");

-- CreateIndex
CREATE INDEX "FileAsset_schoolId_idx" ON "FileAsset"("schoolId");

-- CreateIndex
CREATE INDEX "FileAsset_uploaderId_idx" ON "FileAsset"("uploaderId");

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
