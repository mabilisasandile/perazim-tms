/*
  Warnings:

  - A unique constraint covering the columns `[fleetNumber]` on the table `vehicles` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `truck_load_sheet_vehicles` ADD COLUMN `invoiceNumber` VARCHAR(191) NULL,
    ADD COLUMN `orderNumber` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `vehicles` ADD COLUMN `colour` VARCHAR(191) NULL,
    ADD COLUMN `fleetNumber` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `vehicles_fleetNumber_key` ON `vehicles`(`fleetNumber`);
