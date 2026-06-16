-- CreateTable
CREATE TABLE `gate_scans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scanType` VARCHAR(191) NOT NULL,
    `trackingCode` VARCHAR(191) NOT NULL,
    `tripId` INTEGER NULL,
    `driverName` VARCHAR(191) NULL,
    `driverLicense` VARCHAR(191) NULL,
    `driverPhone` VARCHAR(191) NULL,
    `towTruckReg` VARCHAR(191) NULL,
    `towTruckDriver` VARCHAR(191) NULL,
    `officerName` VARCHAR(191) NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT false,
    `gateName` VARCHAR(191) NULL,
    `scannedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` TEXT NULL,

    INDEX `gate_scans_trackingCode_idx`(`trackingCode`),
    INDEX `gate_scans_scanType_idx`(`scanType`),
    INDEX `gate_scans_scannedAt_idx`(`scannedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `gate_scans` ADD CONSTRAINT `gate_scans_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `trips`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
