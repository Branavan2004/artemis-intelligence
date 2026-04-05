-- ============================================================
-- Enable Row-Level Security (RLS) on sensitive tables
-- ============================================================
-- This is a defense-in-depth measure. Prisma already filters
-- rows by userId in every query, but RLS ensures that even a
-- compromised query or a direct DB connection cannot read
-- another user's data.
--
-- FORCE ROW LEVEL SECURITY bypasses the superuser exemption so
-- the policy applies to the Prisma app user as well.
-- ============================================================

-- ── ChatMessage ────────────────────────────────────────────────────────────────
ALTER TABLE "ChatMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatMessage" FORCE ROW LEVEL SECURITY;

-- Allow users to only SELECT/INSERT/UPDATE/DELETE their own messages.
-- The app sets app.current_user_id via SET LOCAL before each sensitive query
-- (see note below). When not set, current_setting returns '' and no rows match.
CREATE POLICY "chatmessage_user_isolation"
  ON "ChatMessage"
  USING ("userId" = current_setting('app.current_user_id', true))
  WITH CHECK ("userId" = current_setting('app.current_user_id', true));

-- ── SavedArticle ───────────────────────────────────────────────────────────────
ALTER TABLE "SavedArticle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedArticle" FORCE ROW LEVEL SECURITY;

CREATE POLICY "savedarticle_user_isolation"
  ON "SavedArticle"
  USING ("userId" = current_setting('app.current_user_id', true))
  WITH CHECK ("userId" = current_setting('app.current_user_id', true));

-- ── NOTE ───────────────────────────────────────────────────────────────────────
-- To activate the policy per-request, execute this before any data query:
--   SET LOCAL "app.current_user_id" = '<userId>';
-- This must run inside a transaction. Example in Prisma:
--   await prisma.$transaction([
--     prisma.$executeRaw`SET LOCAL "app.current_user_id" = ${userId}`,
--     prisma.chatMessage.findMany({ where: { userId } }),
--   ]);
