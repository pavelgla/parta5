-- CreateEnum
CREATE TYPE "CourseImportStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "CourseImport" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "schoolId" UUID NOT NULL,
    "fileAssetId" UUID NOT NULL,
    "status" "CourseImportStatus" NOT NULL DEFAULT 'PENDING',
    "report" JSONB,
    "error" TEXT,
    "courseId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseImport_schoolId_idx" ON "CourseImport"("schoolId");

-- AddForeignKey
ALTER TABLE "CourseImport" ADD CONSTRAINT "CourseImport_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseImport" ADD CONSTRAINT "CourseImport_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseImport" ADD CONSTRAINT "CourseImport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
