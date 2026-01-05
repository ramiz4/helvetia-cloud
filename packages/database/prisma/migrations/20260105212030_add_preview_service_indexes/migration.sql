-- CreateIndex
CREATE INDEX "Service_prNumber_isPreview_idx" ON "Service"("prNumber", "isPreview");

-- CreateIndex
CREATE INDEX "Service_repoUrl_prNumber_isPreview_idx" ON "Service"("repoUrl", "prNumber", "isPreview");
