-- CreateTable
CREATE TABLE `flat_deck_jobs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reference` VARCHAR(191) NOT NULL,
    `trailerType` ENUM('FLAT_12M', 'SUPERLINK_FLAT_DECK', 'TAUTLINER', 'LOWBED') NOT NULL,
    `trailerId` INTEGER NULL,
    `vehicleId` INTEGER NULL,
    `driverName` VARCHAR(191) NULL,
    `origin` VARCHAR(191) NOT NULL,
    `destination` VARCHAR(191) NOT NULL,
    `plannedDate` DATETIME(3) NOT NULL,
    `deliveredAt` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PLANNED',
    `totalWeight` DOUBLE NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `flat_deck_jobs_reference_key`(`reference`),
    INDEX `flat_deck_jobs_status_idx`(`status`),
    INDEX `flat_deck_jobs_trailerType_idx`(`trailerType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `flat_deck_cargo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `jobId` INTEGER NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `weightPerUnit` DOUBLE NOT NULL,
    `totalWeight` DOUBLE NOT NULL,
    `lengthM` DOUBLE NULL,
    `widthM` DOUBLE NULL,
    `heightM` DOUBLE NULL,
    `specialRequirement` VARCHAR(191) NOT NULL DEFAULT 'STANDARD',
    `notes` VARCHAR(191) NULL,

    INDEX `flat_deck_cargo_jobId_idx`(`jobId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `flat_deck_routes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `origin` VARCHAR(191) NOT NULL,
    `destination` VARCHAR(191) NOT NULL,
    `distanceKm` DOUBLE NULL,
    `maxWeightTonnes` DOUBLE NULL,
    `maxHeightM` DOUBLE NULL,
    `maxLengthM` DOUBLE NULL,
    `allows12mFlat` BOOLEAN NOT NULL DEFAULT true,
    `allowsSuperlink` BOOLEAN NOT NULL DEFAULT true,
    `allowsTautliner` BOOLEAN NOT NULL DEFAULT true,
    `allowsLowbed` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `flat_deck_jobs` ADD CONSTRAINT `flat_deck_jobs_trailerId_fkey` FOREIGN KEY (`trailerId`) REFERENCES `trailers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `flat_deck_jobs` ADD CONSTRAINT `flat_deck_jobs_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `flat_deck_cargo` ADD CONSTRAINT `flat_deck_cargo_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `flat_deck_jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
