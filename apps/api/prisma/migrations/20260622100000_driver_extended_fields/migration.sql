ALTER TABLE `drivers`
  ADD COLUMN `alternativePhone` VARCHAR(191) NULL,
  ADD COLUMN `idNumber`         VARCHAR(191) NULL,
  ADD COLUMN `nationality`      VARCHAR(191) NULL,
  ADD COLUMN `bloodGroup`       VARCHAR(191) NULL,
  ADD COLUMN `licenseType`      VARCHAR(191) NULL,
  ADD COLUMN `pdpNumber`        VARCHAR(191) NULL,
  ADD COLUMN `pdpExpiry`        DATETIME(3)  NULL,
  ADD COLUMN `notes`            TEXT         NULL;
