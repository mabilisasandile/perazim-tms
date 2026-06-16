-- AlterTable
ALTER TABLE `inspections` ADD COLUMN `damageNotes` TEXT NULL,
    ADD COLUMN `driverSignature` LONGTEXT NULL,
    ADD COLUMN `fuelLevel` INTEGER NULL,
    ADD COLUMN `odometerReading` DOUBLE NULL,
    ADD COLUMN `receiverName` VARCHAR(191) NULL,
    ADD COLUMN `receiverSignature` LONGTEXT NULL,
    ADD COLUMN `stage` VARCHAR(191) NOT NULL DEFAULT 'COLLECTION';

-- CreateIndex
CREATE INDEX `inspections_stage_idx` ON `inspections`(`stage`);
