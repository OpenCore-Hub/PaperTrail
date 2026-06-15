-- CreateEnum
CREATE TYPE "StorageType" AS ENUM ('UPLOADTHING', 'S3', 'LOCAL');

-- CreateEnum
CREATE TYPE "AiIndexStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "documents" ALTER COLUMN "storage_key" DROP NOT NULL,
ALTER COLUMN "file_size" DROP NOT NULL,
ALTER COLUMN "page_count" DROP NOT NULL;

-- CreateTable
CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "storage_type" "StorageType" NOT NULL DEFAULT 'UPLOADTHING',
    "file_size" INTEGER NOT NULL,
    "page_count" INTEGER NOT NULL DEFAULT 0,
    "content_type" TEXT NOT NULL,
    "ai_status" "AiIndexStatus" NOT NULL DEFAULT 'PENDING',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_versions_document_id_version_number_idx" ON "document_versions"("document_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_document_id_version_number_key" ON "document_versions"("document_id", "version_number");

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing documents into document_versions as version 1
INSERT INTO "document_versions" (
  "document_id",
  "version_number",
  "storage_key",
  "storage_type",
  "file_size",
  "page_count",
  "content_type",
  "created_by",
  "created_at"
)
SELECT
  "id",
  1,
  "storage_key",
  'UPLOADTHING',
  "file_size",
  COALESCE("page_count", 0),
  'application/pdf',
  "uploaded_by",
  "created_at"
FROM "documents";
