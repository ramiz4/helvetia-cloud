-- CreateTable
CREATE TABLE "TermsVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermsVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTermsAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "termsVersionId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTermsAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TermsVersion_version_key" ON "TermsVersion"("version");

-- CreateIndex
CREATE INDEX "TermsVersion_version_idx" ON "TermsVersion"("version");

-- CreateIndex
CREATE INDEX "TermsVersion_language_idx" ON "TermsVersion"("language");

-- CreateIndex
CREATE INDEX "TermsVersion_effectiveAt_idx" ON "TermsVersion"("effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "TermsVersion_version_language_key" ON "TermsVersion"("version", "language");

-- CreateIndex
CREATE INDEX "UserTermsAcceptance_userId_idx" ON "UserTermsAcceptance"("userId");

-- CreateIndex
CREATE INDEX "UserTermsAcceptance_termsVersionId_idx" ON "UserTermsAcceptance"("termsVersionId");

-- CreateIndex
CREATE INDEX "UserTermsAcceptance_acceptedAt_idx" ON "UserTermsAcceptance"("acceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserTermsAcceptance_userId_termsVersionId_key" ON "UserTermsAcceptance"("userId", "termsVersionId");

-- AddForeignKey
ALTER TABLE "UserTermsAcceptance" ADD CONSTRAINT "UserTermsAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTermsAcceptance" ADD CONSTRAINT "UserTermsAcceptance_termsVersionId_fkey" FOREIGN KEY ("termsVersionId") REFERENCES "TermsVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
