-- Add vehicleCondition to trips (Runner | Non-Runner)
ALTER TABLE `trips` ADD COLUMN `vehicleCondition` VARCHAR(20) NULL;

-- Add vehicleCondition to quotation_items
ALTER TABLE `quotation_items` ADD COLUMN `vehicleCondition` VARCHAR(20) NULL;

-- Add vehicle info to invoices
ALTER TABLE `invoices` ADD COLUMN `vehicleDescription` VARCHAR(255) NULL;
ALTER TABLE `invoices` ADD COLUMN `vehicleCondition` VARCHAR(20) NULL;
