/*
  Warnings:

  - A unique constraint covering the columns `[environmentId,name]` on the table `Service` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Service_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "Service_environmentId_name_key" ON "Service"("environmentId", "name");
