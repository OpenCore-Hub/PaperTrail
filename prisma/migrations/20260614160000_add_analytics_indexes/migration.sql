-- Add indexes to support analytics aggregation and filtering at scale.

CREATE INDEX IF NOT EXISTS "share_links_document_id_idx" ON "share_links"("document_id");

CREATE INDEX IF NOT EXISTS "view_sessions_link_id_idx" ON "view_sessions"("link_id");
CREATE INDEX IF NOT EXISTS "view_sessions_started_at_idx" ON "view_sessions"("started_at");
CREATE INDEX IF NOT EXISTS "view_sessions_fingerprint_idx" ON "view_sessions"("fingerprint");
CREATE INDEX IF NOT EXISTS "view_sessions_viewer_email_idx" ON "view_sessions"("viewer_email");
CREATE INDEX IF NOT EXISTS "view_sessions_link_id_started_at_idx" ON "view_sessions"("link_id", "started_at");

CREATE INDEX IF NOT EXISTS "page_views_session_id_idx" ON "page_views"("session_id");
CREATE INDEX IF NOT EXISTS "page_views_page_number_idx" ON "page_views"("page_number");
