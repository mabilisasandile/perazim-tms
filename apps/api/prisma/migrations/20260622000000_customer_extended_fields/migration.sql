ALTER TABLE `customers`
  ADD COLUMN `alternativePhone` VARCHAR(191) NULL,
  ADD COLUMN `companyName`      VARCHAR(191) NULL,
  ADD COLUMN `vatNumber`        VARCHAR(191) NULL,
  ADD COLUMN `contactPerson`    VARCHAR(191) NULL,
  ADD COLUMN `notes`            TEXT         NULL;
