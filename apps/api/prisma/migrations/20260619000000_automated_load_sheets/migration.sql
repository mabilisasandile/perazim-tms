-- Drop old basic load_sheets table (replaced by truck_load_sheets)
DROP TABLE IF EXISTS `load_sheets`;

-- CreateTable truck_load_sheets
CREATE TABLE IF NOT EXISTS `truck_load_sheets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `loadSheetNo` VARCHAR(191) NOT NULL,
    `truckId` INTEGER NOT NULL,
    `trailerId` INTEGER NULL,
    `driverId` INTEGER NOT NULL,
    `route` VARCHAR(191) NOT NULL,
    `capacity` INTEGER NOT NULL,
    `status` ENUM('OPEN', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `notes` TEXT NULL,
    `dispatchedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `truck_load_sheets_loadSheetNo_key`(`loadSheetNo`),
    INDEX `truck_load_sheets_truckId_idx`(`truckId`),
    INDEX `truck_load_sheets_driverId_idx`(`driverId`),
    INDEX `truck_load_sheets_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable truck_load_sheet_vehicles
CREATE TABLE IF NOT EXISTS `truck_load_sheet_vehicles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `loadSheetId` INTEGER NOT NULL,
    `tripId` INTEGER NOT NULL,
    `pickupLocation` VARCHAR(191) NOT NULL,
    `deliveryLocation` VARCHAR(191) NOT NULL,
    `vehicleCondition` VARCHAR(191) NULL,
    `status` ENUM('YET_TO_START', 'ONGOING', 'COMPLETED') NOT NULL DEFAULT 'YET_TO_START',
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `pickedUpAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,

    UNIQUE INDEX `truck_load_sheet_vehicles_tripId_key`(`tripId`),
    INDEX `truck_load_sheet_vehicles_loadSheetId_idx`(`loadSheetId`),
    INDEX `truck_load_sheet_vehicles_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
