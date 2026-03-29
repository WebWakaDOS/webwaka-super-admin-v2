-- Migration: 011_fix_password_hashing.sql
-- Description: Replace bcrypt password hashes with PBKDF2-SHA256 hashes
--
-- Background:
--   The Cloudflare Workers runtime does NOT support bcrypt. The original
--   migration 003_init_rbac.sql seeded a bcrypt hash for the demo admin user,
--   which would cause all login attempts to fail in production (the login
--   handler was also missing password verification entirely — see security audit).
--
--   This migration replaces the bcrypt hash with a PBKDF2-SHA256 hash using
--   the same demo password ('password') for the seeded admin user.
--
--   Format: pbkdf2:<iterations>:<salt_hex>:<hash_hex>
--   Algorithm: PBKDF2-SHA256, 310,000 iterations (OWASP 2024 recommendation)
--   Salt: 16 bytes (128 bits) — deterministic for seed data only
--
-- IMPORTANT: The demo admin password is 'password'.
--   This MUST be changed immediately after first login in any real environment.
--   Use POST /auth/change-password to update.
--
-- Applied: 2026-03-23
-- Author: Manus AI (cross-repo orchestrator)
-- Security Audit Reference: March 2026 WebWakaDOS Security Audit

UPDATE users
SET password_hash = 'pbkdf2:310000:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6:62d7921785dc68f5571931e5f4c4bbd090cae058f37309adb56e582a3301dbd7',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'user-superadmin'
  AND email = 'admin@webwaka.com';
