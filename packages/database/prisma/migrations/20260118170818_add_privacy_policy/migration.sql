-- DropIndex
DROP INDEX "TermsVersion_version_key";

-- CreateTable
CREATE TABLE "PrivacyPolicyVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPrivacyPolicyAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "privacyPolicyVersionId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPrivacyPolicyAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrivacyPolicyVersion_version_idx" ON "PrivacyPolicyVersion"("version");

-- CreateIndex
CREATE INDEX "PrivacyPolicyVersion_language_idx" ON "PrivacyPolicyVersion"("language");

-- CreateIndex
CREATE INDEX "PrivacyPolicyVersion_effectiveAt_idx" ON "PrivacyPolicyVersion"("effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "PrivacyPolicyVersion_version_language_key" ON "PrivacyPolicyVersion"("version", "language");

-- CreateIndex
CREATE INDEX "UserPrivacyPolicyAcceptance_userId_idx" ON "UserPrivacyPolicyAcceptance"("userId");

-- CreateIndex
CREATE INDEX "UserPrivacyPolicyAcceptance_privacyPolicyVersionId_idx" ON "UserPrivacyPolicyAcceptance"("privacyPolicyVersionId");

-- CreateIndex
CREATE INDEX "UserPrivacyPolicyAcceptance_acceptedAt_idx" ON "UserPrivacyPolicyAcceptance"("acceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserPrivacyPolicyAcceptance_userId_privacyPolicyVersionId_key" ON "UserPrivacyPolicyAcceptance"("userId", "privacyPolicyVersionId");

-- AddForeignKey
ALTER TABLE "UserPrivacyPolicyAcceptance" ADD CONSTRAINT "UserPrivacyPolicyAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPrivacyPolicyAcceptance" ADD CONSTRAINT "UserPrivacyPolicyAcceptance_privacyPolicyVersionId_fkey" FOREIGN KEY ("privacyPolicyVersionId") REFERENCES "PrivacyPolicyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
