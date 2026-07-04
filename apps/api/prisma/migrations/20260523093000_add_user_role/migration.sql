-- Add a simple application role for admin-only operations.
ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'USER';
