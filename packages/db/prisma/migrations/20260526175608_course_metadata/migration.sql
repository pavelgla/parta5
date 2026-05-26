-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "coverFileAssetId" UUID,
ADD COLUMN     "gradeLevel" INTEGER,
ADD COLUMN     "longDescription" JSONB,
ADD COLUMN     "shortDescription" TEXT,
ADD COLUMN     "subject" TEXT;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_coverFileAssetId_fkey" FOREIGN KEY ("coverFileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
