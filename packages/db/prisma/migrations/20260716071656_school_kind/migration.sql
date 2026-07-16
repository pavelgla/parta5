-- CreateEnum
CREATE TYPE "SchoolKind" AS ENUM ('SCHOOL', 'SUPPLEMENTARY', 'VOCATIONAL');

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "kind" "SchoolKind" NOT NULL DEFAULT 'SCHOOL';
