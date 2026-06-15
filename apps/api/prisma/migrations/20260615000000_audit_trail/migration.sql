-- CreateTable
CREATE TABLE `audit_logs` (
    `id`         INTEGER      NOT NULL AUTO_INCREMENT,
    `username`   VARCHAR(191) NOT NULL,
    `ipAddress`  VARCHAR(191) NULL,
    `actionType` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId`   INTEGER      NULL,
    `oldValue`   JSON         NULL,
    `newValue`   JSON         NULL,
    `createdAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_username_idx`(`username`),
    INDEX `audit_logs_actionType_idx`(`actionType`),
    INDEX `audit_logs_entityType_idx`(`entityType`),
    INDEX `audit_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
