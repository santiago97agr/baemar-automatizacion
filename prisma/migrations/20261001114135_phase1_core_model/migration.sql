-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "aliases" TEXT NOT NULL DEFAULT '[]',
    "taxId" TEXT,
    "areas" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Activo',
    "assignee" TEXT,
    "notionPageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "name" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Contact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "area" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "status" TEXT NOT NULL DEFAULT 'Pendiente',
    "description" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "entryDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME,
    "economicValue" REAL,
    "assignee" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'Email',
    "notionPageId" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'pending',
    "syncError" TEXT,
    "syncAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communicationId" TEXT NOT NULL,
    "clientId" TEXT,
    "taskId" TEXT,
    "filename" TEXT NOT NULL,
    "contentType" TEXT,
    "size" INTEGER,
    "sha256" TEXT,
    "dropboxPath" TEXT,
    "uploadStatus" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Attachment_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "AiActivity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'Email',
    "direction" TEXT NOT NULL DEFAULT 'Entrante',
    "subject" TEXT NOT NULL DEFAULT '(sin asunto)',
    "from" TEXT NOT NULL DEFAULT '(desconocido)',
    "to" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attachments" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'General',
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "description" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "aiRaw" TEXT NOT NULL DEFAULT '',
    "relevance" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewReason" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'not_required',
    "processingStatus" TEXT NOT NULL DEFAULT 'done',
    "status" TEXT NOT NULL DEFAULT 'ok',
    "errorMessage" TEXT,
    "externalRef" TEXT,
    "notionPageId" TEXT,
    "clientId" TEXT,
    "taskId" TEXT,
    "correctedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiActivity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AiActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AiActivity" ("aiRaw", "attachments", "body", "createdAt", "description", "errorMessage", "from", "id", "messageId", "needsReview", "priority", "reviewReason", "reviewStatus", "status", "subject", "summary", "title", "type", "updatedAt") SELECT "aiRaw", "attachments", "body", "createdAt", "description", "errorMessage", "from", "id", "messageId", "needsReview", "priority", "reviewReason", "reviewStatus", "status", "subject", "summary", "title", "type", "updatedAt" FROM "AiActivity";
DROP TABLE "AiActivity";
ALTER TABLE "new_AiActivity" RENAME TO "AiActivity";
CREATE UNIQUE INDEX "AiActivity_messageId_key" ON "AiActivity"("messageId");
CREATE UNIQUE INDEX "AiActivity_notionPageId_key" ON "AiActivity"("notionPageId");
CREATE INDEX "AiActivity_clientId_idx" ON "AiActivity"("clientId");
CREATE INDEX "AiActivity_taskId_idx" ON "AiActivity"("taskId");
CREATE INDEX "AiActivity_reviewStatus_idx" ON "AiActivity"("reviewStatus");
CREATE INDEX "AiActivity_processingStatus_idx" ON "AiActivity"("processingStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Client_taxId_key" ON "Client"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_notionPageId_key" ON "Client"("notionPageId");

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "Client"("name");

-- CreateIndex
CREATE INDEX "Contact_clientId_idx" ON "Contact"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_channel_address_key" ON "Contact"("channel", "address");

-- CreateIndex
CREATE UNIQUE INDEX "Task_notionPageId_key" ON "Task"("notionPageId");

-- CreateIndex
CREATE INDEX "Task_clientId_status_idx" ON "Task"("clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_dropboxPath_key" ON "Attachment"("dropboxPath");

-- CreateIndex
CREATE INDEX "Attachment_uploadStatus_idx" ON "Attachment"("uploadStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_communicationId_filename_key" ON "Attachment"("communicationId", "filename");

-- CreateIndex
CREATE INDEX "Feedback_activityId_idx" ON "Feedback"("activityId");
