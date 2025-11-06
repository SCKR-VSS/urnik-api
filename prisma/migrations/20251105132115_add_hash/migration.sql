/*
  Warnings:

  - Added the required column `hash` to the `Mail` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Mail" ADD COLUMN     "hash" TEXT NOT NULL;
