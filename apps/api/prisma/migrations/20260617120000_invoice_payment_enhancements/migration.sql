-- Invoice & Payment Enhancements Migration
-- Features: Deposit Tracking, Outstanding Balance, Bulk Vehicle Invoicing,
--           Proof of Payment Uploads, Payment Audit Trail,
--           Prevent Trip Closure Before Payment, Pay-Later Accounts

-- ── 1. Customer: add pay-later flag ──────────────────────────────────────────
ALTER TABLE `customers`
  ADD COLUMN `payLaterApproved` BOOLEAN NOT NULL DEFAULT false;

-- ── 2. Invoice: add deposit/balance tracking and trip link ────────────────────
ALTER TABLE `invoices`
  ADD COLUMN `tripId`          INTEGER          NULL,
  ADD COLUMN `depositRequired` DECIMAL(10, 2)   NULL,
  ADD COLUMN `depositPaid`     DECIMAL(10, 2)   NOT NULL DEFAULT 0,
  ADD COLUMN `amountPaid`      DECIMAL(10, 2)   NOT NULL DEFAULT 0;

-- ── 3. Invoice: add FK for customer (previously unrelated column) ─────────────
ALTER TABLE `invoices`
  ADD CONSTRAINT `invoices_customerId_fkey`
    FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 4. Invoice: add FK for optional trip link ─────────────────────────────────
ALTER TABLE `invoices`
  ADD CONSTRAINT `invoices_tripId_fkey`
    FOREIGN KEY (`tripId`) REFERENCES `trips`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 5. Create invoice_items (bulk vehicle invoicing) ─────────────────────────
CREATE TABLE `invoice_items` (
  `id`               INTEGER      NOT NULL AUTO_INCREMENT,
  `invoiceId`        INTEGER      NOT NULL,
  `description`      VARCHAR(191) NOT NULL,
  `vehicleCondition` VARCHAR(191) NULL,
  `quantity`         INTEGER      NOT NULL DEFAULT 1,
  `unitPrice`        DECIMAL(10, 2) NOT NULL,
  `total`            DECIMAL(10, 2) NOT NULL,
  INDEX `invoice_items_invoiceId_idx`(`invoiceId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `invoice_items`
  ADD CONSTRAINT `invoice_items_invoiceId_fkey`
    FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 6. Create invoice_payments (deposit tracking, POP uploads, audit trail) ───
CREATE TABLE `invoice_payments` (
  `id`        INTEGER      NOT NULL AUTO_INCREMENT,
  `invoiceId` INTEGER      NOT NULL,
  `type`      VARCHAR(191) NOT NULL DEFAULT 'PAYMENT',
  `amount`    DECIMAL(10, 2) NOT NULL,
  `method`    VARCHAR(191) NOT NULL DEFAULT 'manual',
  `reference` VARCHAR(191) NULL,
  `proofPath` VARCHAR(191) NULL,
  `notes`     TEXT         NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `invoice_payments_invoiceId_idx`(`invoiceId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `invoice_payments`
  ADD CONSTRAINT `invoice_payments_invoiceId_fkey`
    FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
