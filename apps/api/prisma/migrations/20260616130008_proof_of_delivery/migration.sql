-- CreateTable
CREATE TABLE `proofs_of_delivery` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tripId` INTEGER NOT NULL,
    `receiverFirstName` VARCHAR(191) NOT NULL,
    `receiverLastName` VARCHAR(191) NOT NULL,
    `receiverPhone` VARCHAR(191) NOT NULL,
    `receiverEmail` VARCHAR(191) NULL,
    `receiverIdNumber` VARCHAR(191) NULL,
    `relationshipToOwner` VARCHAR(191) NULL,
    `signature` LONGTEXT NOT NULL,
    `gpsLatitude` DOUBLE NULL,
    `gpsLongitude` DOUBLE NULL,
    `gpsAccuracy` DOUBLE NULL,
    `deliveredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `proofs_of_delivery_tripId_key`(`tripId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pod_photos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `podId` INTEGER NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `proofs_of_delivery` ADD CONSTRAINT `proofs_of_delivery_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `trips`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pod_photos` ADD CONSTRAINT `pod_photos_podId_fkey` FOREIGN KEY (`podId`) REFERENCES `proofs_of_delivery`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
