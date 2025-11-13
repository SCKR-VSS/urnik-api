/*
  Warnings:

  - You are about to drop the `ProfTime` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProfTime" DROP CONSTRAINT "ProfTime_profId_fkey";

-- DropForeignKey
ALTER TABLE "ProfTime" DROP CONSTRAINT "ProfTime_timetableId_fkey";

-- DropTable
DROP TABLE "ProfTime";
