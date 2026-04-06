-- Migration 013: Add TOTP 2FA columns to users table
-- Two columns: totp_secret (encrypted TOTP seed) + totp_enabled flag

ALTER TABLE users ADD COLUMN totp_secret TEXT;
ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0 CHECK (totp_enabled IN (0, 1));

-- Index for quick lookups when validating 2FA
CREATE INDEX IF NOT EXISTS idx_users_totp ON users(id, totp_enabled);
