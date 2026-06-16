/*
  Warnings:

  - You are about to alter the column `vehicleDescription` on the `invoices` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.

*/
-- AlterTable
ALTER TABLE `invoices` MODIFY `vehicleDescription` VARCHAR(191) NULL,
    MODIFY `vehicleCondition` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `quotation_items` MODIFY `vehicleCondition` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `trailers` MODIFY `category` VARCHAR(191) NULL,
    MODIFY `licenseNo` VARCHAR(191) NULL,
    MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'Available';

-- AlterTable
ALTER TABLE `trips` MODIFY `vehicleCondition` VARCHAR(191) NULL;
