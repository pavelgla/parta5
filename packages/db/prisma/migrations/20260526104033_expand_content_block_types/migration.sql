-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContentBlockType" ADD VALUE 'HEADING';
ALTER TYPE "ContentBlockType" ADD VALUE 'LIST';
ALTER TYPE "ContentBlockType" ADD VALUE 'IMAGE';
ALTER TYPE "ContentBlockType" ADD VALUE 'VIDEO_EMBED';
ALTER TYPE "ContentBlockType" ADD VALUE 'CALLOUT';
ALTER TYPE "ContentBlockType" ADD VALUE 'CODE';
ALTER TYPE "ContentBlockType" ADD VALUE 'QUOTE';
ALTER TYPE "ContentBlockType" ADD VALUE 'DIVIDER';
ALTER TYPE "ContentBlockType" ADD VALUE 'EMBED_IFRAME';
