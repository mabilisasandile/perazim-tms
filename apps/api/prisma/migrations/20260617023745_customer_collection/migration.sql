-- CreateTable
CREATE TABLE `customer_collections` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tripId` INTEGER NOT NULL,
    `collectorFirstName` VARCHAR(191) NOT NULL,
    `collectorLastName` VARCHAR(191) NOT NULL,
    `collectorPhone` VARCHAR(191) NOT NULL,
    `collectorEmail` VARCHAR(191) NULL,
    `relationshipToOwner` VARCHAR(191) NULL,
    `idType` VARCHAR(191) NOT NULL,
    `idNumber` VARCHAR(191) NOT NULL,
    `idPhotoPath` VARCHAR(191) NULL,
    `selfiePath` VARCHAR(191) NULL,
    `signature` LONGTEXT NOT NULL,
    `gpsLatitude` DOUBLE NULL,
    `gpsLongitude` DOUBLE NULL,
    `gpsAccuracy` DOUBLE NULL,
    `collectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `customer_collections_tripId_key`(`tripId`),
    INDEX `customer_collections_tripId_idx`(`tripId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `customer_collections` ADD CONSTRAINT `customer_collections_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `trips`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
