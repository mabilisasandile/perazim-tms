-- AlterTable
ALTER TABLE `proofs_of_delivery` ADD COLUMN `identificationType` VARCHAR(191) NULL,
    ADD COLUMN `receiverPassportNumber` VARCHAR(191) NULL,
    ADD COLUMN `receiverPhotoPath` VARCHAR(191) NULL;
