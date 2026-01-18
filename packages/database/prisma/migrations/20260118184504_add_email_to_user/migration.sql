-- AlterTable
ALTER TABLE "User" ALTER COLUMN "githubId" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");
