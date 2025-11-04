-- AlterTable
ALTER TABLE "User" ADD COLUMN "giphyApiKey" TEXT;

-- CreateTable
CREATE TABLE "MediaView" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "MediaView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaView_mediaId_idx" ON "MediaView"("mediaId");

-- CreateIndex
CREATE INDEX "MediaView_viewedAt_idx" ON "MediaView"("viewedAt");

-- AddForeignKey
ALTER TABLE "MediaView" ADD CONSTRAINT "MediaView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
