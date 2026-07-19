/*
  Warnings:

  - A unique constraint covering the columns `[customerReference]` on the table `customers` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `customers` ADD COLUMN `customerReference` VARCHAR(191) NULL,
    ADD COLUMN `termsAcceptedAt` DATETIME(3) NULL,
    ADD COLUMN `termsAcceptedVersion` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `amountRefunded` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX `customers_customerReference_key` ON `customers`(`customerReference`);
