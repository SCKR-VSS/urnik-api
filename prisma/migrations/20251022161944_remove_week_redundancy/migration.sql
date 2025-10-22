/*
  Warnings:

  - You are about to drop the column `value` on the `Week` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Week_value_key";

-- AlterTable
ALTER TABLE "Week" DROP COLUMN "value",
ALTER COLUMN "id" DROP DEFAULT;
DROP SEQUENCE "Week_id_seq";
