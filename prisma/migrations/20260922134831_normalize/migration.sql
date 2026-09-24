/*
  Warnings:

  - You are about to drop the `EmailLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `notionPageId` on the `Feedback` table. All the data in the column will be lost.
  - Added the required column `activityId` to the `Feedback` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "EmailLog_messageId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "EmailLog";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "AiActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "aiRaw" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ActivityTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "targetUrl" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActivityTarget_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "AiActivity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "emailMessageId" TEXT,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Feedback_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "AiActivity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Feedback" ("createdAt", "emailMessageId", "id", "text", "type") SELECT "createdAt", "emailMessageId", "id", "text", "type" FROM "Feedback";
DROP TABLE "Feedback";
ALTER TABLE "new_Feedback" RENAME TO "Feedback";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AiActivity_messageId_key" ON "AiActivity"("messageId");

-- CreateIndex
CREATE INDEX "ActivityTarget_targetType_status_idx" ON "ActivityTarget"("targetType", "status");
