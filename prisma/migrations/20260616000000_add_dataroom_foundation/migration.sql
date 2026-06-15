-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DataroomRole') THEN
    CREATE TYPE "DataroomRole" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "datarooms" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brand" JSONB,
    "custom_domain" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "datarooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "dataroom_folders" (
    "id" TEXT NOT NULL,
    "dataroom_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dataroom_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "dataroom_documents" (
    "id" TEXT NOT NULL,
    "dataroom_id" TEXT NOT NULL,
    "folder_id" TEXT,
    "document_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dataroom_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "dataroom_permissions" (
    "id" TEXT NOT NULL,
    "dataroom_id" TEXT NOT NULL,
    "user_id" TEXT,
    "role" "DataroomRole" NOT NULL DEFAULT 'VIEWER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dataroom_permissions_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "share_links" ALTER COLUMN "document_id" DROP NOT NULL;
ALTER TABLE "share_links" ADD COLUMN IF NOT EXISTS "dataroom_id" TEXT;

-- Enforce that a share link belongs to either a document or a dataroom.
ALTER TABLE "share_links" DROP CONSTRAINT IF EXISTS "share_links_document_or_dataroom_check";
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_document_or_dataroom_check" CHECK (
    ("document_id" IS NOT NULL) OR ("dataroom_id" IS NOT NULL)
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "datarooms_custom_domain_key" ON "datarooms"("custom_domain");
CREATE INDEX IF NOT EXISTS "datarooms_workspace_id_idx" ON "datarooms"("workspace_id");
CREATE INDEX IF NOT EXISTS "dataroom_folders_dataroom_id_idx" ON "dataroom_folders"("dataroom_id");
CREATE INDEX IF NOT EXISTS "dataroom_folders_parent_id_idx" ON "dataroom_folders"("parent_id");
CREATE INDEX IF NOT EXISTS "dataroom_documents_dataroom_id_idx" ON "dataroom_documents"("dataroom_id");
CREATE INDEX IF NOT EXISTS "dataroom_documents_folder_id_idx" ON "dataroom_documents"("folder_id");
CREATE UNIQUE INDEX IF NOT EXISTS "dataroom_documents_dataroom_id_document_id_key" ON "dataroom_documents"("dataroom_id", "document_id");
CREATE INDEX IF NOT EXISTS "dataroom_permissions_dataroom_id_idx" ON "dataroom_permissions"("dataroom_id");
CREATE UNIQUE INDEX IF NOT EXISTS "dataroom_permissions_dataroom_id_user_id_key" ON "dataroom_permissions"("dataroom_id", "user_id");
CREATE INDEX IF NOT EXISTS "share_links_dataroom_id_idx" ON "share_links"("dataroom_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'datarooms_workspace_id_fkey') THEN
    ALTER TABLE "datarooms" ADD CONSTRAINT "datarooms_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dataroom_folders_dataroom_id_fkey') THEN
    ALTER TABLE "dataroom_folders" ADD CONSTRAINT "dataroom_folders_dataroom_id_fkey" FOREIGN KEY ("dataroom_id") REFERENCES "datarooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dataroom_folders_parent_id_fkey') THEN
    ALTER TABLE "dataroom_folders" ADD CONSTRAINT "dataroom_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "dataroom_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dataroom_documents_dataroom_id_fkey') THEN
    ALTER TABLE "dataroom_documents" ADD CONSTRAINT "dataroom_documents_dataroom_id_fkey" FOREIGN KEY ("dataroom_id") REFERENCES "datarooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dataroom_documents_folder_id_fkey') THEN
    ALTER TABLE "dataroom_documents" ADD CONSTRAINT "dataroom_documents_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "dataroom_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dataroom_documents_document_id_fkey') THEN
    ALTER TABLE "dataroom_documents" ADD CONSTRAINT "dataroom_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dataroom_permissions_dataroom_id_fkey') THEN
    ALTER TABLE "dataroom_permissions" ADD CONSTRAINT "dataroom_permissions_dataroom_id_fkey" FOREIGN KEY ("dataroom_id") REFERENCES "datarooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dataroom_permissions_user_id_fkey') THEN
    ALTER TABLE "dataroom_permissions" ADD CONSTRAINT "dataroom_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'share_links_dataroom_id_fkey') THEN
    ALTER TABLE "share_links" ADD CONSTRAINT "share_links_dataroom_id_fkey" FOREIGN KEY ("dataroom_id") REFERENCES "datarooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
