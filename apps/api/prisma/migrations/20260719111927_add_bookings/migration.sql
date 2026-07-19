-- DropIndex
DROP INDEX `driver_expenses_driverId_fkey` ON `driver_expenses`;

-- DropIndex
DROP INDEX `drivers_assignedTrailerId_fkey` ON `drivers`;

-- DropIndex
DROP INDEX `drivers_assignedVehicleId_fkey` ON `drivers`;

-- DropIndex
DROP INDEX `flat_deck_cargo_jobId_idx` ON `flat_deck_cargo`;

-- DropIndex
DROP INDEX `flat_deck_jobs_trailerId_fkey` ON `flat_deck_jobs`;

-- DropIndex
DROP INDEX `flat_deck_jobs_vehicleId_fkey` ON `flat_deck_jobs`;

-- DropIndex
DROP INDEX `fuel_driverId_fkey` ON `fuel`;

-- DropIndex
DROP INDEX `fuel_vehicleId_fkey` ON `fuel`;

-- DropIndex
DROP INDEX `gate_scans_tripId_fkey` ON `gate_scans`;

-- DropIndex
DROP INDEX `geofence_events_geofenceId_fkey` ON `geofence_events`;

-- DropIndex
DROP INDEX `geofence_events_vehicleId_fkey` ON `geofence_events`;

-- DropIndex
DROP INDEX `geofence_vehicles_vehicleId_fkey` ON `geofence_vehicles`;

-- DropIndex
DROP INDEX `income_expenses_vehicleId_fkey` ON `income_expenses`;

-- DropIndex
DROP INDEX `inspection_images_driverId_fkey` ON `inspection_images`;

-- DropIndex
DROP INDEX `inspection_images_inspectionId_fkey` ON `inspection_images`;

-- DropIndex
DROP INDEX `inspection_images_tripId_fkey` ON `inspection_images`;

-- DropIndex
DROP INDEX `inspection_items_categoryId_fkey` ON `inspection_items`;

-- DropIndex
DROP INDEX `inspections_driverId_fkey` ON `inspections`;

-- DropIndex
DROP INDEX `inspections_tripId_fkey` ON `inspections`;

-- DropIndex
DROP INDEX `invoices_customerId_fkey` ON `invoices`;

-- DropIndex
DROP INDEX `invoices_tripId_fkey` ON `invoices`;

-- DropIndex
DROP INDEX `payroll_trip_links_tripId_fkey` ON `payroll_trip_links`;

-- DropIndex
DROP INDEX `pod_photos_podId_fkey` ON `pod_photos`;

-- DropIndex
DROP INDEX `positions_tripId_fkey` ON `positions`;

-- DropIndex
DROP INDEX `positions_vehicleId_fkey` ON `positions`;

-- DropIndex
DROP INDEX `quotation_items_quotationId_fkey` ON `quotation_items`;

-- DropIndex
DROP INDEX `quotations_customerId_fkey` ON `quotations`;

-- DropIndex
DROP INDEX `reminders_vehicleId_fkey` ON `reminders`;

-- DropIndex
DROP INDEX `tanker_deliveries_tankerId_fkey` ON `tanker_deliveries`;

-- DropIndex
DROP INDEX `tanker_delivery_stops_deliveryId_fkey` ON `tanker_delivery_stops`;

-- DropIndex
DROP INDEX `tanker_loads_tankerId_fkey` ON `tanker_loads`;

-- DropIndex
DROP INDEX `timesheets_driverId_fkey` ON `timesheets`;

-- DropIndex
DROP INDEX `trailers_assignedVehicleId_fkey` ON `trailers`;

-- DropIndex
DROP INDEX `trip_expenses_tripId_fkey` ON `trip_expenses`;

-- DropIndex
DROP INDEX `trip_legs_driverId_fkey` ON `trip_legs`;

-- DropIndex
DROP INDEX `trip_legs_tripId_fkey` ON `trip_legs`;

-- DropIndex
DROP INDEX `trips_createdById_fkey` ON `trips`;

-- DropIndex
DROP INDEX `trips_customerId_fkey` ON `trips`;

-- DropIndex
DROP INDEX `trips_driverId_fkey` ON `trips`;

-- DropIndex
DROP INDEX `trips_trailerId_fkey` ON `trips`;

-- DropIndex
DROP INDEX `trips_vehicleId_fkey` ON `trips`;

-- DropIndex
DROP INDEX `vehicles_groupId_fkey` ON `vehicles`;

-- DropIndex
DROP INDEX `warehouse_transfers_fromWarehouseId_fkey` ON `warehouse_transfers`;

-- DropIndex
DROP INDEX `warehouse_transfers_toWarehouseId_fkey` ON `warehouse_transfers`;

-- DropIndex
DROP INDEX `warehouse_transfers_warehouseVehicleId_fkey` ON `warehouse_transfers`;

-- DropIndex
DROP INDEX `warehouse_vehicles_warehouseId_fkey` ON `warehouse_vehicles`;

-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `bookingId` INTEGER NULL;

-- AlterTable
ALTER TABLE `trips` ADD COLUMN `bookingId` INTEGER NULL;

-- CreateTable
CREATE TABLE `bookings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bookingNumber` VARCHAR(191) NOT NULL,
    `customerId` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `notes` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bookings_bookingNumber_key`(`bookingNumber`),
    INDEX `bookings_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `invoices_bookingId_idx` ON `invoices`(`bookingId`);

-- CreateIndex
CREATE INDEX `trips_bookingId_idx` ON `trips`(`bookingId`);
