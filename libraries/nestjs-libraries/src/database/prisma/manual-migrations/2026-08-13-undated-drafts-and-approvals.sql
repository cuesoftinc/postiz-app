-- Undated drafts + server-side approvals gate
-- Written 2026-08-13. Apply by hand; this repo has no prisma/migrations
-- directory (package.json drives schema changes with `prisma db push`), so
-- these statements are the reviewable record of what db push would do.
--
-- SAFETY: every statement is additive or widening. Nothing is dropped, no
-- column changes type, and no existing row changes value.
--
--   1. Post.publishDate NOT NULL -> NULL is a WIDENING of the domain. Every
--      existing row already holds a value and keeps it; dropping NOT NULL
--      cannot invalidate a row that is already non-null. Postgres implements
--      this as a catalog-only change (it rewrites no heap pages), so it takes
--      an ACCESS EXCLUSIVE lock for a moment but does not scan the table.
--   2. Both new columns are NOT NULL DEFAULT false. On Postgres 11+ adding a
--      NOT NULL column with a non-volatile default is also catalog-only, so
--      existing rows are not rewritten and every one of them reads as false --
--      which is the intended value: no historical post needs approval, and no
--      existing org has the gate switched on.
--   3. The new index is created non-concurrently inside the transaction, which
--      is correct for a table of this size. If Post is ever large enough that
--      the write lock matters, run the CREATE INDEX separately as CREATE INDEX
--      CONCURRENTLY (which cannot run inside a transaction block).
--
-- ROLLBACK is at the bottom, commented out.

BEGIN;

-- 1. An undated draft becomes representable. See schema.prisma: a null date is
--    only ever legal on a DRAFT; PostsService refuses to move a dateless post
--    into QUEUE, because the publish workflow sleeps until publishDate.
ALTER TABLE "Post" ALTER COLUMN "publishDate" DROP NOT NULL;

-- 2. The approvals gate as a first-class field rather than a tag-name
--    convention. The org tag named 'needs-approval' stays as the UI's label,
--    but a tag can be renamed or deleted, so the server's rule lives here.
ALTER TABLE "Post"
  ADD COLUMN "needsApproval" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Post_needsApproval_idx" ON "Post"("needsApproval");

-- 3. The org-level switch. Default false keeps every existing install's
--    behaviour identical until somebody deliberately turns it on.
ALTER TABLE "Organization"
  ADD COLUMN "requireApproval" BOOLEAN NOT NULL DEFAULT false;

COMMIT;


-- Verification (expect: is_nullable = YES for publishDate, and both new
-- columns present with default false):
--
--   SELECT table_name, column_name, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE (table_name = 'Post'
--           AND column_name IN ('publishDate', 'needsApproval'))
--       OR (table_name = 'Organization' AND column_name = 'requireApproval')
--    ORDER BY table_name, column_name;
--
-- Expect 0, since nothing writes a null date until the new routes are used:
--
--   SELECT count(*) FROM "Post" WHERE "publishDate" IS NULL;


-- ROLLBACK. Note that step 1 can only be reverted if no undated draft exists;
-- delete or date them first, or the ALTER will fail (which is the desired
-- behaviour -- it refuses rather than inventing a date).
--
--   BEGIN;
--   ALTER TABLE "Organization" DROP COLUMN "requireApproval";
--   DROP INDEX "Post_needsApproval_idx";
--   ALTER TABLE "Post" DROP COLUMN "needsApproval";
--   DELETE FROM "Post" WHERE "publishDate" IS NULL;  -- or give them dates
--   ALTER TABLE "Post" ALTER COLUMN "publishDate" SET NOT NULL;
--   COMMIT;
