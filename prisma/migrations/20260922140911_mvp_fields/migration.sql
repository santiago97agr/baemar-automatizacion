/*
  Warnings:

  - Added the required column `from` to the `AiActivity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subject` to the `AiActivity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `AiActivity` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "activityId" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "ErrorLog_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "AiActivity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ActivityTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "targetUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActivityTarget_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "AiActivity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ActivityTarget" ("activityId", "createdAt", "errorMessage", "id", "payload", "status", "targetId", "targetType", "targetUrl", "updatedAt") SELECT "activityId", "createdAt", "errorMessage", "id", "payload", "status", "targetId", "targetType", "targetUrl", "updatedAt" FROM "ActivityTarget";
DROP TABLE "ActivityTarget";
ALTER TABLE "new_ActivityTarget" RENAME TO "ActivityTarget";
CREATE INDEX "ActivityTarget_targetType_status_idx" ON "ActivityTarget"("targetType", "status");
CREATE TABLE "new_AiActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "attachments" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "aiRaw" TEXT NOT NULL DEFAULT '',
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewReason" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'not_required',
    "status" TEXT NOT NULL DEFAULT 'ok',
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AiActivity" ("aiRaw", "createdAt", "description", "errorMessage", "id", "messageId", "priority", "status", "summary", "title", "type") SELECT "aiRaw", "createdAt", "description", "errorMessage", "id", "messageId", "priority", "status", "summary", "title", "type" FROM "AiActivity";
DROP TABLE "AiActivity";
ALTER TABLE "new_AiActivity" RENAME TO "AiActivity";
CREATE UNIQUE INDEX "AiActivity_messageId_key" ON "AiActivity"("messageId");
CREATE TABLE "new_Feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "emailMessageId" TEXT,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Feedback_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "AiActivity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Feedback" ("activityId", "createdAt", "emailMessageId", "id", "text", "type") SELECT "activityId", "createdAt", "emailMessageId", "id", "text", "type" FROM "Feedback";
DROP TABLE "Feedback";
ALTER TABLE "new_Feedback" RENAME TO "Feedback";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
