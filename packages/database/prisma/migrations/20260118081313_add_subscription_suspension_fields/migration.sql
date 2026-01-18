-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "lastSuspensionAt" TIMESTAMP(3),
ADD COLUMN     "lastWarningEmailAt" TIMESTAMP(3);
