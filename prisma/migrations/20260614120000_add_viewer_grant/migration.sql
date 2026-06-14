-- CreateTable
CREATE TABLE "viewer_grants" (
    "id" TEXT NOT NULL,
    "link_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "viewer_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "viewer_grants_token_key" ON "viewer_grants"("token");

-- CreateIndex
CREATE INDEX "viewer_grants_link_id_idx" ON "viewer_grants"("link_id");

-- AddForeignKey
ALTER TABLE "viewer_grants" ADD CONSTRAINT "viewer_grants_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "share_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
