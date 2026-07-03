-- DropForeignKey
ALTER TABLE `customer_collections` DROP FOREIGN KEY `customer_collections_tripId_fkey`;

-- DropForeignKey
ALTER TABLE `delivery_otps` DROP FOREIGN KEY `delivery_otps_tripId_fkey`;

-- DropForeignKey
ALTER TABLE `driver_documents` DROP FOREIGN KEY `driver_documents_driverId_fkey`;

-- DropForeignKey
ALTER TABLE `driver_emergency_contacts` DROP FOREIGN KEY `driver_emergency_contacts_driverId_fkey`;

-- DropForeignKey
ALTER TABLE `driver_expenses` DROP FOREIGN KEY `driver_expenses_driverId_fkey`;

-- DropForeignKey
ALTER TABLE `driver_incidents` DROP FOREIGN KEY `driver_incidents_driverId_fkey`;

-- DropForeignKey
ALTER TABLE `driver_payroll_configs` DROP FOREIGN KEY `driver_payroll_configs_driverId_fkey`;

-- DropForeignKey
ALTER TABLE `driver_warnings` DROP FOREIGN KEY `driver_warnings_driverId_fkey`;

-- DropForeignKey
ALTER TABLE `drivers` DROP FOREIGN KEY `drivers_assignedTrailerId_fkey`;

-- DropForeignKey
ALTER TABLE `drivers` DROP FOREIGN KEY `drivers_assignedVehicleId_fkey`;

-- DropForeignKey
ALTER TABLE `flat_deck_cargo` DROP FOREIGN KEY `flat_deck_cargo_jobId_fkey`;

-- DropForeignKey
ALTER TABLE `flat_deck_jobs` DROP FOREIGN KEY `flat_deck_jobs_trailerId_fkey`;

-- DropForeignKey
ALTER TABLE `flat_deck_jobs` DROP FOREIGN KEY `flat_deck_jobs_vehicleId_fkey`;

-- DropForeignKey
ALTER TABLE `fuel` DROP FOREIGN KEY `fuel_driverId_fkey`;

-- DropForeignKey
ALTER TABLE `fuel` DROP FOREIGN KEY `fuel_vehicleId_fkey`;

-- DropForeignKey
ALTER TABLE `gate_scans` DROP FOREIGN KEY `gate_scans_tripId_fkey`;

-- DropForeignKey
ALTER TABLE `geofence_events` DROP FOREIGN KEY `geofence_events_geofenceId_fkey`;

-- DropForeignKey
ALTER TABLE `geofence_events` DROP FOREIGN KEY `geofence_events_vehicleId_fkey`;

-- DropForeignKey
ALTER TABLE `geofence_vehicles` DROP FOREIGN KEY `geofence_vehicles_geofenceId_fkey`;

-- DropForeignKey
ALTER TABLE `geofence_vehicles` DROP FOREIGN KEY `geofence_vehicles_vehicleId_fkey`;

-- DropForeignKey
ALTER TABLE `income_expenses` DROP FOREIGN KEY `income_expenses_vehicleId_fkey`;

-- DropForeignKey
ALTER TABLE `inspection_images` DROP FOREIGN KEY `inspection_images_driverId_fkey`;

-- DropForeignKey
ALTER TABLE `inspection_images` DROP FOREIGN KEY `inspection_images_inspectionId_fkey`;

-- DropForeignKey
ALTER TABLE `inspection_images` DROP FOREIGN KEY `inspection_images_tripId_fkey`;

-- DropForeignKey
ALTER TABLE `inspection_items` DROP FOREIGN KEY `inspection_items_categoryId_fkey`;

-- DropForeignKey
ALTER TABLE `inspections` DROP FOREIGN KEY `inspections_driverId_fkey`;

-- DropForeignKey
ALTER TABLE `inspections` DROP FOREIGN KEY `inspections_tripId_fkey`;

-- DropForeignKey
ALTER TABLE `invoice_items` DROP FOREIGN KEY `invoice_items_invoiceId_fkey`;

-- DropForeignKey
ALTER TABLE `invoice_payments` DROP FOREIGN KEY `invoice_payments_invoiceId_fkey`;

-- DropForeignKey
ALTER TABLE `invoices` DROP FOREIGN KEY `invoices_customerId_fkey`;

-- DropForeignKey
ALTER TABLE `invoices` DROP FOREIGN KEY `invoices_tripId_fkey`;

-- DropForeignKey
ALTER TABLE `payroll_entries` DROP FOREIGN KEY `payroll_entries_driverId_fkey`;

-- DropForeignKey
ALTER TABLE `payroll_trip_links` DROP FOREIGN KEY `payroll_trip_links_payrollEntryId_fkey`;

-- DropForeignKey
ALTER TABLE `payroll_trip_links` DROP FOREIGN KEY `payroll_trip_links_tripId_fkey`;

-- DropForeignKey
ALTER TABLE `pod_photos` DROP FOREIGN KEY `pod_photos_podId_fkey`;

-- DropForeignKey
ALTER TABLE `positions` DROP FOREIGN KEY `positions_tripId_fkey`;

-- DropForeignKey
ALTER TABLE `positions` DROP FOREIGN KEY `positions_vehicleId_fkey`;

-- DropForeignKey
ALTER TABLE `proofs_of_delivery` DROP FOREIGN KEY `proofs_of_delivery_tripId_fkey`;

-- DropForeignKey
ALTER TABLE `quotation_items` DROP FOREIGN KEY `quotation_items_quotationId_fkey`;

-- DropForeignKey
ALTER TABLE `quotations` DROP FOREIGN KEY `quotations_customerId_fkey`;

-- DropForeignKey
ALTER TABLE `reminders` DROP FOREIGN KEY `reminders_vehicleId_fkey`;

-- DropForeignKey
ALTER TABLE `tanker_compartments` DROP FOREIGN KEY `tanker_compartments_tankerId_fkey`;

-- DropForeignKey
ALTER TABLE `tanker_deliveries` DROP FOREIGN KEY `tanker_deliveries_tankerId_fkey`;

-- DropForeignKey
ALTER TABLE `tanker_delivery_stops` DROP FOREIGN KEY `tanker_delivery_stops_deliveryId_fkey`;

-- DropForeignKey
ALTER TABLE `tanker_loads` DROP FOREIGN KEY `tanker_loads_tankerId_fkey`;

-- DropForeignKey
ALTER TABLE `timesheets` DROP FOREIGN KEY `timesheets_driverId_fkey`;

-- DropForeignKey
ALTER TABLE `trailers` DROP FOREIGN KEY `trailers_assignedVehicleId_fkey`;

-- DropForeignKey
ALTER TABLE `trip_expenses` DROP FOREIGN KEY `trip_expenses_tripId_fkey`;

-- DropForeignKey
ALTER TABLE `trip_legs` DROP FOREIGN KEY `trip_legs_driverId_fkey`;

-- DropForeignKey
ALTER TABLE `trip_legs` DROP FOREIGN KEY `trip_legs_tripId_fkey`;

-- DropForeignKey
ALTER TABLE `trip_payments` DROP FOREIGN KEY `trip_payments_tripId_fkey`;

-- DropForeignKey
ALTER TABLE `trips` DROP FOREIGN KEY `trips_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `trips` DROP FOREIGN KEY `trips_customerId_fkey`;

-- DropForeignKey
ALTER TABLE `trips` DROP FOREIGN KEY `trips_driverId_fkey`;

-- DropForeignKey
ALTER TABLE `trips` DROP FOREIGN KEY `trips_trailerId_fkey`;

-- DropForeignKey
ALTER TABLE `trips` DROP FOREIGN KEY `trips_vehicleId_fkey`;

-- DropForeignKey
ALTER TABLE `user_permissions` DROP FOREIGN KEY `user_permissions_userId_fkey`;

-- DropForeignKey
ALTER TABLE `vehicles` DROP FOREIGN KEY `vehicles_groupId_fkey`;

-- DropForeignKey
ALTER TABLE `warehouse_transfers` DROP FOREIGN KEY `warehouse_transfers_fromWarehouseId_fkey`;

-- DropForeignKey
ALTER TABLE `warehouse_transfers` DROP FOREIGN KEY `warehouse_transfers_toWarehouseId_fkey`;

-- DropForeignKey
ALTER TABLE `warehouse_transfers` DROP FOREIGN KEY `warehouse_transfers_warehouseVehicleId_fkey`;

-- DropForeignKey
ALTER TABLE `warehouse_vehicles` DROP FOREIGN KEY `warehouse_vehicles_tripId_fkey`;

-- DropForeignKey
ALTER TABLE `warehouse_vehicles` DROP FOREIGN KEY `warehouse_vehicles_warehouseId_fkey`;

-- DropIndex
DROP INDEX `flat_deck_jobs_status_idx` ON `flat_deck_jobs`;

-- DropIndex
DROP INDEX `flat_deck_jobs_trailerType_idx` ON `flat_deck_jobs`;
