-- CreateTable
CREATE TABLE "OcrJob" (
    "id" UUID NOT NULL,
    "createdById" UUID,
    "title" TEXT,
    "status" "OcrJobStatus" NOT NULL DEFAULT 'QUEUED',
    "method" "OcrMethod",
    "language" TEXT NOT NULL DEFAULT 'eng',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAfter" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pageCount" INTEGER,
    "rawText" TEXT,
    "meanConfidence" DOUBLE PRECISION,
    "reviewDraft" JSONB,
    "draftVersion" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "importedTestId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OcrJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcrJobSource" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "pageOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OcrJobSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcrPage" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "imageFileId" UUID NOT NULL,
    "widthPx" INTEGER NOT NULL,
    "heightPx" INTEGER NOT NULL,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "method" "OcrMethod" NOT NULL,
    "meanConfidence" DOUBLE PRECISION,
    "blocks" JSONB NOT NULL,
    "reviewStatus" "OcrPageReview" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OcrPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OcrJob_status_runAfter_idx" ON "OcrJob"("status", "runAfter");

-- CreateIndex
CREATE INDEX "OcrJob_createdById_createdAt_idx" ON "OcrJob"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "OcrJob_importedTestId_idx" ON "OcrJob"("importedTestId");

-- CreateIndex
CREATE INDEX "OcrJobSource_fileId_idx" ON "OcrJobSource"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "OcrJobSource_jobId_pageOrder_key" ON "OcrJobSource"("jobId", "pageOrder");

-- CreateIndex
CREATE INDEX "OcrPage_imageFileId_idx" ON "OcrPage"("imageFileId");

-- CreateIndex
CREATE UNIQUE INDEX "OcrPage_jobId_pageNumber_key" ON "OcrPage"("jobId", "pageNumber");

-- AddForeignKey
ALTER TABLE "OcrJob" ADD CONSTRAINT "OcrJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrJob" ADD CONSTRAINT "OcrJob_importedTestId_fkey" FOREIGN KEY ("importedTestId") REFERENCES "Test"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrJobSource" ADD CONSTRAINT "OcrJobSource_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "OcrJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrJobSource" ADD CONSTRAINT "OcrJobSource_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrPage" ADD CONSTRAINT "OcrPage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "OcrJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrPage" ADD CONSTRAINT "OcrPage_imageFileId_fkey" FOREIGN KEY ("imageFileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
