-- CreateTable
CREATE TABLE `payroll_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `baseEnabled` BOOLEAN NOT NULL DEFAULT false,
    `defaultBaseSalary` DECIMAL(10, 2) NULL,
    `tripRateEnabled` BOOLEAN NOT NULL DEFAULT true,
    `defaultTripRate` DECIMAL(10, 2) NULL,
    `commissionEnabled` BOOLEAN NOT NULL DEFAULT false,
    `commissionRate` DOUBLE NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'ZAR',
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `driver_payroll_configs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `driverId` INTEGER NOT NULL,
    `baseSalary` DECIMAL(10, 2) NULL,
    `tripRate` DECIMAL(10, 2) NULL,
    `commissionRate` DOUBLE NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `driver_payroll_configs_driverId_key`(`driverId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `driverId` INTEGER NOT NULL,
    `periodType` VARCHAR(191) NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `baseSalary` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `tripCount` INTEGER NOT NULL DEFAULT 0,
    `tripEarnings` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `commissions` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `bonuses` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `deductions` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `grossPay` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `netPay` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `approvedAt` DATETIME(3) NULL,
    `approvedBy` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `paymentRef` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payroll_entries_driverId_idx`(`driverId`),
    INDEX `payroll_entries_status_idx`(`status`),
    INDEX `payroll_entries_periodStart_idx`(`periodStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_trip_links` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payrollEntryId` INTEGER NOT NULL,
    `tripId` INTEGER NOT NULL,
    `tripAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `tripRate` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `commission` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `driverEarnings` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payroll_trip_links_payrollEntryId_idx`(`payrollEntryId`),
    UNIQUE INDEX `payroll_trip_links_payrollEntryId_tripId_key`(`payrollEntryId`, `tripId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `driver_payroll_configs` ADD CONSTRAINT `driver_payroll_configs_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `drivers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_entries` ADD CONSTRAINT `payroll_entries_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `drivers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_trip_links` ADD CONSTRAINT `payroll_trip_links_payrollEntryId_fkey` FOREIGN KEY (`payrollEntryId`) REFERENCES `payroll_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_trip_links` ADD CONSTRAINT `payroll_trip_links_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `trips`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
