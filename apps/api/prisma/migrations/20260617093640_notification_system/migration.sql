-- CreateTable
CREATE TABLE `notification_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `notificationType` VARCHAR(191) NOT NULL,
    `emailEnabled` BOOLEAN NOT NULL DEFAULT false,
    `smsEnabled` BOOLEAN NOT NULL DEFAULT false,
    `whatsappEnabled` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `notification_settings_notificationType_key`(`notificationType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `twilio_config` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `accountSid` VARCHAR(191) NOT NULL,
    `authToken` VARCHAR(191) NOT NULL,
    `fromPhone` VARCHAR(191) NOT NULL,
    `whatsappFrom` VARCHAR(191) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `whatsapp_config` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `phoneNumberId` VARCHAR(191) NOT NULL,
    `accessToken` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `recipientType` VARCHAR(191) NOT NULL,
    `recipientName` VARCHAR(191) NULL,
    `recipientEmail` VARCHAR(191) NULL,
    `recipientPhone` VARCHAR(191) NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` INTEGER NOT NULL,
    `subject` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `sentAt` DATETIME(3) NULL,
    `failureReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_type_idx`(`type`),
    INDEX `notifications_channel_idx`(`channel`),
    INDEX `notifications_status_idx`(`status`),
    INDEX `notifications_entityType_entityId_idx`(`entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
