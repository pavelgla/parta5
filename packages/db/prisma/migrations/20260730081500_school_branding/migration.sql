-- AlterTable
ALTER TABLE "School" ADD COLUMN     "brandColor" TEXT,
ADD COLUMN     "contactAddress" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "domain" TEXT,
ADD COLUMN     "footerLinks" JSONB,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "logoFileAssetId" UUID,
ADD COLUMN     "siteUrl" TEXT,
ADD COLUMN     "tagline" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "School_domain_key" ON "School"("domain");

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_logoFileAssetId_fkey" FOREIGN KEY ("logoFileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
