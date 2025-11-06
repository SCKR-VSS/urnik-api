/*
  Warnings:

  - The `subjects` column on the `Mail` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Mail" DROP COLUMN "subjects",
ADD COLUMN     "subjects" JSONB,
ALTER COLUMN "groups" DROP NOT NULL;
