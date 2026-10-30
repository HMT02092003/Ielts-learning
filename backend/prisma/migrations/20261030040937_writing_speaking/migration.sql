-- CreateTable
CREATE TABLE "WritingSubmission" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "partId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "status" "WritingSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "lastClientSeq" INTEGER NOT NULL DEFAULT 0,
    "lastSavedAt" TIMESTAMPTZ(3),
    "submittedAt" TIMESTAMPTZ(3),
    "selfChecklist" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WritingSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingEvaluation" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "evaluator" "EvaluatorKind" NOT NULL,
    "evaluatorVersion" TEXT NOT NULL,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'PENDING',
    "textHash" TEXT NOT NULL,
    "language" TEXT,
    "isEstimate" BOOLEAN NOT NULL DEFAULT true,
    "bandTaskResponse" DOUBLE PRECISION,
    "bandCoherence" DOUBLE PRECISION,
    "bandLexical" DOUBLE PRECISION,
    "bandGrammar" DOUBLE PRECISION,
    "bandOverall" DOUBLE PRECISION,
    "result" JSONB,
    "comment" TEXT,
    "reviewerId" UUID,
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WritingEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingRecording" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "partId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "questionIndex" INTEGER NOT NULL DEFAULT 0,
    "take" INTEGER NOT NULL DEFAULT 1,
    "fileId" UUID NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SpeakingRecording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingEvaluation" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "recordingId" UUID,
    "evaluator" "EvaluatorKind" NOT NULL DEFAULT 'HUMAN',
    "evaluatorVersion" TEXT,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'DONE',
    "isEstimate" BOOLEAN NOT NULL DEFAULT false,
    "bandFluency" DOUBLE PRECISION,
    "bandLexical" DOUBLE PRECISION,
    "bandGrammar" DOUBLE PRECISION,
    "bandPronunciation" DOUBLE PRECISION,
    "bandOverall" DOUBLE PRECISION,
    "result" JSONB,
    "comment" TEXT,
    "reviewerId" UUID,
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SpeakingEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WritingSubmission_userId_createdAt_idx" ON "WritingSubmission"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WritingSubmission_partId_userId_idx" ON "WritingSubmission"("partId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "WritingSubmission_attemptId_partId_key" ON "WritingSubmission"("attemptId", "partId");

-- CreateIndex
CREATE INDEX "WritingEvaluation_submissionId_createdAt_idx" ON "WritingEvaluation"("submissionId", "createdAt");

-- CreateIndex
CREATE INDEX "WritingEvaluation_evaluator_status_idx" ON "WritingEvaluation"("evaluator", "status");

-- CreateIndex
CREATE INDEX "WritingEvaluation_reviewerId_idx" ON "WritingEvaluation"("reviewerId");

-- CreateIndex
CREATE INDEX "SpeakingRecording_userId_createdAt_idx" ON "SpeakingRecording"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SpeakingRecording_partId_idx" ON "SpeakingRecording"("partId");

-- CreateIndex
CREATE INDEX "SpeakingRecording_fileId_idx" ON "SpeakingRecording"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "SpeakingRecording_attemptId_partId_questionIndex_take_key" ON "SpeakingRecording"("attemptId", "partId", "questionIndex", "take");

-- CreateIndex
CREATE INDEX "SpeakingEvaluation_attemptId_createdAt_idx" ON "SpeakingEvaluation"("attemptId", "createdAt");

-- CreateIndex
CREATE INDEX "SpeakingEvaluation_recordingId_idx" ON "SpeakingEvaluation"("recordingId");

-- CreateIndex
CREATE INDEX "SpeakingEvaluation_reviewerId_idx" ON "SpeakingEvaluation"("reviewerId");

-- AddForeignKey
ALTER TABLE "WritingSubmission" ADD CONSTRAINT "WritingSubmission_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingSubmission" ADD CONSTRAINT "WritingSubmission_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingSubmission" ADD CONSTRAINT "WritingSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingEvaluation" ADD CONSTRAINT "WritingEvaluation_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "WritingSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingEvaluation" ADD CONSTRAINT "WritingEvaluation_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingRecording" ADD CONSTRAINT "SpeakingRecording_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingRecording" ADD CONSTRAINT "SpeakingRecording_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingRecording" ADD CONSTRAINT "SpeakingRecording_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingRecording" ADD CONSTRAINT "SpeakingRecording_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingEvaluation" ADD CONSTRAINT "SpeakingEvaluation_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingEvaluation" ADD CONSTRAINT "SpeakingEvaluation_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "SpeakingRecording"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingEvaluation" ADD CONSTRAINT "SpeakingEvaluation_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
