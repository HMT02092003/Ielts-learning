-- CreateTable
CREATE TABLE "Vocabulary" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "term" TEXT NOT NULL,
    "normalizedTerm" TEXT NOT NULL,
    "partOfSpeech" TEXT,
    "phonetic" TEXT,
    "meaning" TEXT,
    "definition" TEXT,
    "notes" TEXT,
    "exampleSentence" TEXT,
    "sourceTestId" UUID,
    "sourceParagraphId" UUID,
    "sourceAttemptId" UUID,
    "sourceStart" INTEGER,
    "sourceEnd" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "state" "VocabState" NOT NULL DEFAULT 'NEW',
    "learningStep" INTEGER NOT NULL DEFAULT 0,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" TIMESTAMPTZ(3),
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Vocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabularyReview" (
    "id" UUID NOT NULL,
    "vocabularyId" UUID NOT NULL,
    "clientReviewId" UUID NOT NULL,
    "grade" INTEGER NOT NULL,
    "reviewedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prevIntervalDay" INTEGER NOT NULL,
    "newIntervalDay" INTEGER NOT NULL,
    "prevEaseFactor" DOUBLE PRECISION NOT NULL,
    "newEaseFactor" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "VocabularyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyStat" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,
    "attemptsStarted" INTEGER NOT NULL DEFAULT 0,
    "attemptsSubmitted" INTEGER NOT NULL DEFAULT 0,
    "questionsAnswered" INTEGER NOT NULL DEFAULT 0,
    "questionsCorrect" INTEGER NOT NULL DEFAULT 0,
    "wordsWritten" INTEGER NOT NULL DEFAULT 0,
    "speakingSeconds" INTEGER NOT NULL DEFAULT 0,
    "vocabAdded" INTEGER NOT NULL DEFAULT 0,
    "vocabReviewed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StudyStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTestMark" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "seriesKey" TEXT NOT NULL,
    "doneAt" TIMESTAMPTZ(3),
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserTestMark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DictionaryCache" (
    "id" UUID NOT NULL,
    "term" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DictionaryCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vocabulary_userId_dueAt_idx" ON "Vocabulary"("userId", "dueAt");

-- CreateIndex
CREATE INDEX "Vocabulary_userId_createdAt_idx" ON "Vocabulary"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Vocabulary_sourceTestId_idx" ON "Vocabulary"("sourceTestId");

-- CreateIndex
CREATE INDEX "Vocabulary_sourceParagraphId_idx" ON "Vocabulary"("sourceParagraphId");

-- CreateIndex
CREATE INDEX "Vocabulary_sourceAttemptId_idx" ON "Vocabulary"("sourceAttemptId");

-- CreateIndex
CREATE UNIQUE INDEX "Vocabulary_userId_normalizedTerm_key" ON "Vocabulary"("userId", "normalizedTerm");

-- CreateIndex
CREATE UNIQUE INDEX "VocabularyReview_clientReviewId_key" ON "VocabularyReview"("clientReviewId");

-- CreateIndex
CREATE INDEX "VocabularyReview_vocabularyId_reviewedAt_idx" ON "VocabularyReview"("vocabularyId", "reviewedAt");

-- CreateIndex
CREATE INDEX "StudyStat_date_idx" ON "StudyStat"("date");

-- CreateIndex
CREATE UNIQUE INDEX "StudyStat_userId_date_key" ON "StudyStat"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "UserTestMark_userId_seriesKey_key" ON "UserTestMark"("userId", "seriesKey");

-- CreateIndex
CREATE INDEX "DictionaryCache_expiresAt_idx" ON "DictionaryCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DictionaryCache_provider_term_key" ON "DictionaryCache"("provider", "term");

-- AddForeignKey
ALTER TABLE "Vocabulary" ADD CONSTRAINT "Vocabulary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vocabulary" ADD CONSTRAINT "Vocabulary_sourceTestId_fkey" FOREIGN KEY ("sourceTestId") REFERENCES "Test"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vocabulary" ADD CONSTRAINT "Vocabulary_sourceParagraphId_fkey" FOREIGN KEY ("sourceParagraphId") REFERENCES "Paragraph"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vocabulary" ADD CONSTRAINT "Vocabulary_sourceAttemptId_fkey" FOREIGN KEY ("sourceAttemptId") REFERENCES "Attempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyReview" ADD CONSTRAINT "VocabularyReview_vocabularyId_fkey" FOREIGN KEY ("vocabularyId") REFERENCES "Vocabulary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyStat" ADD CONSTRAINT "StudyStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTestMark" ADD CONSTRAINT "UserTestMark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
