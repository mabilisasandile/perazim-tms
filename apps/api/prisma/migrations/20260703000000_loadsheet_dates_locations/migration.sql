-- AlterTable truck_load_sheets: add scheduling & location fields
ALTER TABLE `truck_load_sheets`
    ADD COLUMN `startDate` DATETIME(3) NULL,
    ADD COLUMN `endDate` DATETIME(3) NULL,
    ADD COLUMN `pickupLocation` VARCHAR(191) NULL,
    ADD COLUMN `dropOffLocation` VARCHAR(191) NULL;
