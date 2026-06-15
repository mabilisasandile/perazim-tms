-- AlterTable users: add role, lockout, and activity fields
ALTER TABLE `users`
  ADD COLUMN `role`              VARCHAR(191) NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN `failedLoginCount`  INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN `lockedUntil`       DATETIME(3)  NULL,
  ADD COLUMN `lastLoginAt`       DATETIME(3)  NULL,
  ADD COLUMN `passwordChangedAt` DATETIME(3)  NULL;

-- Index on role
CREATE INDEX `users_role_idx` ON `users`(`role`);

-- AlterTable settings: add security policy fields
ALTER TABLE `settings`
  ADD COLUMN `minPasswordLength`     INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN `requireUppercase`      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `requireNumbers`        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `requireSpecialChars`   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `sessionTimeoutMinutes` INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN `maxLoginAttempts`      INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN `lockoutMinutes`        INTEGER NOT NULL DEFAULT 30;
