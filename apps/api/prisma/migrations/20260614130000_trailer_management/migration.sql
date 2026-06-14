-- Add full trailer management fields
ALTER TABLE `trailers`
  ADD COLUMN `category`          VARCHAR(50)  NULL,
  ADD COLUMN `licenseNo`         VARCHAR(100) NULL,
  ADD COLUMN `status`            VARCHAR(30)  NOT NULL DEFAULT 'Available',
  ADD COLUMN `assignedVehicleId` INT          NULL;

-- FK: trailer → vehicle (the truck that pulls this trailer)
ALTER TABLE `trailers`
  ADD CONSTRAINT `trailers_assignedVehicleId_fkey`
  FOREIGN KEY (`assignedVehicleId`) REFERENCES `vehicles`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
