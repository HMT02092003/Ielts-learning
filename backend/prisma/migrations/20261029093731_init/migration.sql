-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STUDENT');

-- CreateEnum
CREATE TYPE "TestSource" AS ENUM ('CAM', 'VOL', 'PRE_IELTS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TestType" AS ENUM ('ACADEMIC', 'GENERAL');

-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Skill" AS ENUM ('LISTENING', 'READING', 'WRITING', 'SPEAKING');

-- CreateEnum
CREATE TYPE "ParagraphKind" AS ENUM ('BODY', 'HEADING', 'SUBHEADING', 'FIGURE', 'FOOTNOTE');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE_SINGLE', 'MULTIPLE_CHOICE_MULTI', 'TRUE_FALSE_NOT_GIVEN', 'YES_NO_NOT_GIVEN', 'MATCHING_HEADINGS', 'MATCHING_INFORMATION', 'MATCHING_FEATURES', 'SENTENCE_COMPLETION', 'SUMMARY_COMPLETION', 'NOTE_TABLE_FLOWCHART_COMPLETION', 'SHORT_ANSWER', 'MAP_DIAGRAM_LABELLING');

-- CreateEnum
CREATE TYPE "WritingTaskKind" AS ENUM ('ACADEMIC_REPORT', 'GENERAL_LETTER', 'ESSAY');

-- CreateEnum
CREATE TYPE "AttemptMode" AS ENUM ('EXAM', 'PRACTICE');

-- CreateEnum
CREATE TYPE "AttemptScope" AS ENUM ('SECTION', 'PART', 'QUESTION_TYPE', 'QUESTION_IDS');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('CREATED', 'IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "SubmitReason" AS ENUM ('USER', 'DEADLINE', 'ADMIN');

-- CreateEnum
CREATE TYPE "AnnotationKind" AS ENUM ('HIGHLIGHT', 'NOTE');

-- CreateEnum
CREATE TYPE "AnnotationTargetKind" AS ENUM ('PARAGRAPH', 'QUESTION', 'GROUP');

-- CreateEnum
CREATE TYPE "WritingSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "EvaluatorKind" AS ENUM ('LIBRARY', 'LLM', 'HUMAN');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "StorageDriver" AS ENUM ('LOCAL', 'S3');

-- CreateEnum
CREATE TYPE "FilePurpose" AS ENUM ('TEST_AUDIO', 'TEST_IMAGE', 'SPEAKING_RECORDING', 'OCR_SOURCE', 'OCR_PAGE');

-- CreateEnum
CREATE TYPE "OcrJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'NEEDS_REVIEW', 'FAILED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "OcrMethod" AS ENUM ('PDF_TEXT', 'TESSERACT', 'MIXED');

-- CreateEnum
CREATE TYPE "BandTableKind" AS ENUM ('LISTENING', 'READING_ACADEMIC', 'READING_GENERAL');

-- CreateEnum
CREATE TYPE "VocabState" AS ENUM ('NEW', 'LEARNING', 'REVIEW', 'RELEARNING');

-- CreateEnum
CREATE TYPE "OcrPageReview" AS ENUM ('PENDING', 'APPROVED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "targetBand" DOUBLE PRECISION,
    "examDate" DATE,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "familyExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "persistent" BOOLEAN NOT NULL DEFAULT false,
    "rotatedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" UUID NOT NULL,
    "driver" "StorageDriver" NOT NULL DEFAULT 'LOCAL',
    "storageKey" TEXT NOT NULL,
    "purpose" "FilePurpose" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "originalName" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "widthPx" INTEGER,
    "heightPx" INTEGER,
    "durationMs" INTEGER,
    "uploadedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Test" (
    "id" UUID NOT NULL,
    "seriesKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "TestStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedSeriesKey" TEXT,
    "source" "TestSource" NOT NULL,
    "type" "TestType" NOT NULL DEFAULT 'ACADEMIC',
    "title" TEXT NOT NULL,
    "sourceRef" TEXT,
    "bookNumber" INTEGER,
    "testNumber" INTEGER,
    "description" TEXT,
    "contentHash" TEXT,
    "bandTableId" UUID,
    "publishedAt" TIMESTAMPTZ(3),
    "createdById" UUID,
    "publishedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Test_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" UUID NOT NULL,
    "testId" UUID NOT NULL,
    "skill" "Skill" NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "instructions" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Part" (
    "id" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT,
    "instructions" TEXT,
    "suggestedMinutes" INTEGER,
    "durationSec" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passage" (
    "id" UUID NOT NULL,
    "partId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Passage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paragraph" (
    "id" UUID NOT NULL,
    "passageId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT,
    "kind" "ParagraphKind" NOT NULL DEFAULT 'BODY',
    "text" TEXT NOT NULL,
    "imageId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Paragraph_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audio" (
    "id" UUID NOT NULL,
    "partId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "startMs" INTEGER,
    "endMs" INTEGER,
    "transcript" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Audio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingTask" (
    "id" UUID NOT NULL,
    "partId" UUID NOT NULL,
    "kind" "WritingTaskKind" NOT NULL,
    "prompt" TEXT NOT NULL,
    "imageId" UUID,
    "visual" TEXT,
    "minWords" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WritingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingPart" (
    "id" UUID NOT NULL,
    "partId" UUID NOT NULL,
    "topic" TEXT,
    "questions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cueCard" JSONB,
    "prepSeconds" INTEGER NOT NULL DEFAULT 0,
    "speakSeconds" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SpeakingPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionGroup" (
    "id" UUID NOT NULL,
    "partId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "QuestionType" NOT NULL,
    "instructions" TEXT NOT NULL,
    "questionFrom" INTEGER NOT NULL,
    "questionTo" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "imageId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "QuestionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "prompt" TEXT,
    "content" JSONB NOT NULL DEFAULT '{}',
    "correctAnswer" JSONB NOT NULL,
    "acceptedAnswers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "wordLimit" INTEGER,
    "explanation" TEXT,
    "evidence" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BandTable" (
    "id" UUID NOT NULL,
    "kind" "BandTableKind" NOT NULL,
    "version" INTEGER NOT NULL,
    "activeKind" "BandTableKind",
    "name" TEXT NOT NULL,
    "rows" JSONB NOT NULL,
    "rowsHash" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "isReference" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BandTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "testId" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "mode" "AttemptMode" NOT NULL,
    "scope" "AttemptScope" NOT NULL,
    "partId" UUID,
    "questionTypes" "QuestionType"[] DEFAULT ARRAY[]::"QuestionType"[],
    "questionNumbers" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "sourceAttemptId" UUID,
    "scopeKey" TEXT NOT NULL,
    "activeScopeKey" TEXT,
    "isPreview" BOOLEAN NOT NULL DEFAULT false,
    "status" "AttemptStatus" NOT NULL DEFAULT 'CREATED',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMPTZ(3),
    "timeLimitSec" INTEGER,
    "deadlineAt" TIMESTAMPTZ(3),
    "submittedAt" TIMESTAMPTZ(3),
    "submitReason" "SubmitReason",
    "lastClientSeq" INTEGER NOT NULL DEFAULT 0,
    "lastSavedAt" TIMESTAMPTZ(3),
    "currentQuestionNumber" INTEGER,
    "uiState" JSONB NOT NULL DEFAULT '{}',
    "rawScore" INTEGER,
    "maxScore" INTEGER,
    "band" DOUBLE PRECISION,
    "bandTableId" UUID,
    "scoringVersion" TEXT,
    "scoredAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttemptPart" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "partId" UUID NOT NULL,
    "timeSpentMs" INTEGER NOT NULL DEFAULT 0,
    "rawScore" INTEGER,
    "maxScore" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AttemptPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "value" JSONB,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" TIMESTAMPTZ(3),
    "isCorrect" BOOLEAN,
    "scoringNotes" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Annotation" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "kind" "AnnotationKind" NOT NULL,
    "targetKind" "AnnotationTargetKind" NOT NULL,
    "paragraphId" UUID,
    "questionId" UUID,
    "questionGroupId" UUID,
    "field" TEXT,
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "exact" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT '',
    "suffix" TEXT NOT NULL DEFAULT '',
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Annotation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_storageKey_key" ON "StoredFile"("storageKey");

-- CreateIndex
CREATE INDEX "StoredFile_sha256_purpose_idx" ON "StoredFile"("sha256", "purpose");

-- CreateIndex
CREATE INDEX "StoredFile_purpose_createdAt_idx" ON "StoredFile"("purpose", "createdAt");

-- CreateIndex
CREATE INDEX "StoredFile_uploadedById_idx" ON "StoredFile"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "Test_publishedSeriesKey_key" ON "Test"("publishedSeriesKey");

-- CreateIndex
CREATE INDEX "Test_status_source_bookNumber_testNumber_idx" ON "Test"("status", "source", "bookNumber", "testNumber");

-- CreateIndex
CREATE INDEX "Test_seriesKey_status_idx" ON "Test"("seriesKey", "status");

-- CreateIndex
CREATE INDEX "Test_contentHash_idx" ON "Test"("contentHash");

-- CreateIndex
CREATE INDEX "Test_bandTableId_idx" ON "Test"("bandTableId");

-- CreateIndex
CREATE INDEX "Test_createdById_idx" ON "Test"("createdById");

-- CreateIndex
CREATE INDEX "Test_publishedById_idx" ON "Test"("publishedById");

-- CreateIndex
CREATE INDEX "Test_createdAt_idx" ON "Test"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Test_seriesKey_version_key" ON "Test"("seriesKey", "version");

-- CreateIndex
CREATE INDEX "Section_skill_idx" ON "Section"("skill");

-- CreateIndex
CREATE UNIQUE INDEX "Section_testId_skill_key" ON "Section"("testId", "skill");

-- CreateIndex
CREATE UNIQUE INDEX "Part_sectionId_number_key" ON "Part"("sectionId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Passage_partId_key" ON "Passage"("partId");

-- CreateIndex
CREATE INDEX "Paragraph_imageId_idx" ON "Paragraph"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "Paragraph_passageId_order_key" ON "Paragraph"("passageId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Paragraph_passageId_label_key" ON "Paragraph"("passageId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Audio_partId_key" ON "Audio"("partId");

-- CreateIndex
CREATE INDEX "Audio_fileId_idx" ON "Audio"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "WritingTask_partId_key" ON "WritingTask"("partId");

-- CreateIndex
CREATE INDEX "WritingTask_imageId_idx" ON "WritingTask"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "SpeakingPart_partId_key" ON "SpeakingPart"("partId");

-- CreateIndex
CREATE INDEX "QuestionGroup_type_idx" ON "QuestionGroup"("type");

-- CreateIndex
CREATE INDEX "QuestionGroup_imageId_idx" ON "QuestionGroup"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionGroup_partId_order_key" ON "QuestionGroup"("partId", "order");

-- CreateIndex
CREATE INDEX "Question_groupId_idx" ON "Question"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_sectionId_number_key" ON "Question"("sectionId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "BandTable_activeKind_key" ON "BandTable"("activeKind");

-- CreateIndex
CREATE INDEX "BandTable_createdById_idx" ON "BandTable"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "BandTable_kind_version_key" ON "BandTable"("kind", "version");

-- CreateIndex
CREATE INDEX "Attempt_userId_status_idx" ON "Attempt"("userId", "status");

-- CreateIndex
CREATE INDEX "Attempt_userId_createdAt_idx" ON "Attempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Attempt_testId_idx" ON "Attempt"("testId");

-- CreateIndex
CREATE INDEX "Attempt_sectionId_idx" ON "Attempt"("sectionId");

-- CreateIndex
CREATE INDEX "Attempt_partId_idx" ON "Attempt"("partId");

-- CreateIndex
CREATE INDEX "Attempt_bandTableId_idx" ON "Attempt"("bandTableId");

-- CreateIndex
CREATE INDEX "Attempt_sourceAttemptId_idx" ON "Attempt"("sourceAttemptId");

-- CreateIndex
CREATE INDEX "Attempt_status_deadlineAt_idx" ON "Attempt"("status", "deadlineAt");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_userId_sectionId_activeScopeKey_key" ON "Attempt"("userId", "sectionId", "activeScopeKey");

-- CreateIndex
CREATE INDEX "AttemptPart_partId_idx" ON "AttemptPart"("partId");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptPart_attemptId_partId_key" ON "AttemptPart"("attemptId", "partId");

-- CreateIndex
CREATE INDEX "Answer_questionId_idx" ON "Answer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_attemptId_questionId_key" ON "Answer"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "Annotation_paragraphId_idx" ON "Annotation"("paragraphId");

-- CreateIndex
CREATE INDEX "Annotation_questionId_idx" ON "Annotation"("questionId");

-- CreateIndex
CREATE INDEX "Annotation_questionGroupId_idx" ON "Annotation"("questionGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Annotation_attemptId_clientId_key" ON "Annotation"("attemptId", "clientId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_bandTableId_fkey" FOREIGN KEY ("bandTableId") REFERENCES "BandTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passage" ADD CONSTRAINT "Passage_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paragraph" ADD CONSTRAINT "Paragraph_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Passage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paragraph" ADD CONSTRAINT "Paragraph_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audio" ADD CONSTRAINT "Audio_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audio" ADD CONSTRAINT "Audio_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingTask" ADD CONSTRAINT "WritingTask_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingTask" ADD CONSTRAINT "WritingTask_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingPart" ADD CONSTRAINT "SpeakingPart_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionGroup" ADD CONSTRAINT "QuestionGroup_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionGroup" ADD CONSTRAINT "QuestionGroup_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "QuestionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandTable" ADD CONSTRAINT "BandTable_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_bandTableId_fkey" FOREIGN KEY ("bandTableId") REFERENCES "BandTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_sourceAttemptId_fkey" FOREIGN KEY ("sourceAttemptId") REFERENCES "Attempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptPart" ADD CONSTRAINT "AttemptPart_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptPart" ADD CONSTRAINT "AttemptPart_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_paragraphId_fkey" FOREIGN KEY ("paragraphId") REFERENCES "Paragraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_questionGroupId_fkey" FOREIGN KEY ("questionGroupId") REFERENCES "QuestionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ───────── Hand-written CHECK constraints (Prisma schema cannot express these) ─────────
-- Bands: 0..9 in steps of 0.5
ALTER TABLE "User" ADD CONSTRAINT "User_targetBand_range"
  CHECK ("targetBand" IS NULL OR ("targetBand" BETWEEN 0 AND 9 AND "targetBand" * 2 = floor("targetBand" * 2)));
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_band_range"
  CHECK ("band" IS NULL OR ("band" BETWEEN 0 AND 9 AND "band" * 2 = floor("band" * 2)));

-- Content sanity
ALTER TABLE "Test" ADD CONSTRAINT "Test_version_positive" CHECK ("version" >= 1);
ALTER TABLE "Part" ADD CONSTRAINT "Part_number_positive" CHECK ("number" >= 1);
ALTER TABLE "Question" ADD CONSTRAINT "Question_number_range" CHECK ("number" BETWEEN 1 AND 40);
ALTER TABLE "QuestionGroup" ADD CONSTRAINT "QuestionGroup_range"
  CHECK ("questionFrom" BETWEEN 1 AND 40 AND "questionTo" BETWEEN 1 AND 40 AND "questionFrom" <= "questionTo");
ALTER TABLE "AttemptPart" ADD CONSTRAINT "AttemptPart_time_nonneg" CHECK ("timeSpentMs" >= 0);

-- "Only one" invariants implemented with nullable unique columns
ALTER TABLE "Test" ADD CONSTRAINT "Test_publishedSeriesKey_consistent"
  CHECK ("publishedSeriesKey" IS NULL OR ("status" = 'PUBLISHED' AND "publishedSeriesKey" = "seriesKey"));
ALTER TABLE "BandTable" ADD CONSTRAINT "BandTable_activeKind_consistent"
  CHECK ("activeKind" IS NULL OR "activeKind" = "kind");
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_activeScopeKey_consistent"
  CHECK ("activeScopeKey" IS NULL OR ("status" IN ('CREATED', 'IN_PROGRESS') AND "activeScopeKey" = "scopeKey"));

-- Annotation: targetKind decides exactly which FK is set; `field` only for QUESTION/GROUP
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_target_matches_kind" CHECK (
  (("targetKind" = 'PARAGRAPH') = ("paragraphId" IS NOT NULL)) AND
  (("targetKind" = 'QUESTION') = ("questionId" IS NOT NULL)) AND
  (("targetKind" = 'GROUP') = ("questionGroupId" IS NOT NULL)) AND
  (("targetKind" = 'PARAGRAPH') = ("field" IS NULL))
);
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_offsets" CHECK ("startOffset" >= 0 AND "endOffset" > "startOffset");
