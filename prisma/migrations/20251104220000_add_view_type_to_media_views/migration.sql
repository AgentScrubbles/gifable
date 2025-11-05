-- AlterTable
ALTER TABLE "MediaView" ADD COLUMN "viewType" TEXT NOT NULL DEFAULT 'external';

-- CreateIndex
CREATE INDEX "MediaView_viewType_idx" ON "MediaView"("viewType");
