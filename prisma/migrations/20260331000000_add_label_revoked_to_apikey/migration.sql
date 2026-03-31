-- AlterTable
ALTER TABLE `ApiKey` ADD COLUMN `label` VARCHAR(191) NULL,
                     ADD COLUMN `revoked` BOOLEAN NOT NULL DEFAULT false;
