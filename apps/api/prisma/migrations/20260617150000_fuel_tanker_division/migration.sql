-- CreateTable
CREATE TABLE `fuel_tankers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `registrationNo` VARCHAR(191) NOT NULL,
    `totalCapacity` DOUBLE NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `fuel_tankers_registrationNo_key`(`registrationNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tanker_compartments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tankerId` INTEGER NOT NULL,
    `compartmentNo` INTEGER NOT NULL,
    `capacity` DOUBLE NOT NULL,
    `fuelType` ENUM('DIESEL', 'PETROL', 'PARAFFIN') NOT NULL,
    `currentVolume` DOUBLE NOT NULL DEFAULT 0,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tanker_compartments_tankerId_compartmentNo_key`(`tankerId`, `compartmentNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tanker_deliveries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reference` VARCHAR(191) NOT NULL,
    `tankerId` INTEGER NOT NULL,
    `driverName` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PLANNED',
    `plannedDate` DATETIME(3) NOT NULL,
    `departedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tanker_deliveries_reference_key`(`reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tanker_delivery_stops` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `deliveryId` INTEGER NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 1,
    `customerName` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NOT NULL,
    `fuelType` ENUM('DIESEL', 'PETROL', 'PARAFFIN') NOT NULL,
    `plannedVolume` DOUBLE NOT NULL,
    `deliveredVolume` DOUBLE NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `deliveredAt` DATETIME(3) NULL,
    `notes` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tanker_loads` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tankerId` INTEGER NOT NULL,
    `fuelType` ENUM('DIESEL', 'PETROL', 'PARAFFIN') NOT NULL,
    `volume` DOUBLE NOT NULL,
    `pricePerLitre` DECIMAL(10, 4) NOT NULL,
    `totalCost` DECIMAL(10, 2) NOT NULL,
    `depotName` VARCHAR(191) NOT NULL,
    `driverName` VARCHAR(191) NULL,
    `loadDate` DATETIME(3) NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tanker_compartments` ADD CONSTRAINT `tanker_compartments_tankerId_fkey` FOREIGN KEY (`tankerId`) REFERENCES `fuel_tankers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tanker_deliveries` ADD CONSTRAINT `tanker_deliveries_tankerId_fkey` FOREIGN KEY (`tankerId`) REFERENCES `fuel_tankers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tanker_delivery_stops` ADD CONSTRAINT `tanker_delivery_stops_deliveryId_fkey` FOREIGN KEY (`deliveryId`) REFERENCES `tanker_deliveries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tanker_loads` ADD CONSTRAINT `tanker_loads_tankerId_fkey` FOREIGN KEY (`tankerId`) REFERENCES `fuel_tankers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
