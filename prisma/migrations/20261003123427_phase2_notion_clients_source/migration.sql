/*
  Warnings:

  - You are about to drop the `Contact` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `taskId` on the `Attachment` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Contact_channel_address_key";

-- DropIndex
DROP INDEX "Contact_clientId_idx";

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "email" TEXT;
ALTER TABLE "Client" ADD COLUMN "lastSyncedAt" DATETIME;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Contact";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communicationId" TEXT NOT NULL,
    "clientId" TEXT,
    "filename" TEXT NOT NULL,
    "contentType" TEXT,
    "size" INTEGER,
    "sha256" TEXT,
    "contentBase64" TEXT,
    "dropboxPath" TEXT,
    "uploadStatus" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Attachment_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "AiActivity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Attachment" ("attempts", "clientId", "communicationId", "contentBase64", "contentType", "createdAt", "dropboxPath", "errorMessage", "filename", "id", "sha256", "size", "updatedAt", "uploadStatus") SELECT "attempts", "clientId", "communicationId", "contentBase64", "contentType", "createdAt", "dropboxPath", "errorMessage", "filename", "id", "sha256", "size", "updatedAt", "uploadStatus" FROM "Attachment";
DROP TABLE "Attachment";
ALTER TABLE "new_Attachment" RENAME TO "Attachment";
CREATE UNIQUE INDEX "Attachment_dropboxPath_key" ON "Attachment"("dropboxPath");
CREATE INDEX "Attachment_uploadStatus_idx" ON "Attachment"("uploadStatus");
CREATE UNIQUE INDEX "Attachment_communicationId_filename_key" ON "Attachment"("communicationId", "filename");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Client_email_idx" ON "Client"("email");
