# Changelog — webwaka-super-admin-v2

## [2.1.0] — 2026-03-29 — Security Hardening

### Security (CRITICAL fixes)
- **Fixed: Password bypass** — `POST /auth/login` now fetches `password_hash` from DB and
  calls `verifyPassword()` (PBKDF2-SHA256, 310,000 iterations). Previously the password
  field was extracted from the request but never compared against anything.
- **Fixed: Fake token generation** — Replaced `'jwt_' + Date.now() + '_' + Math.random()`
  with proper HS256-signed JWTs via `signJWT()` (Web Crypto API, Workers-native).
- **Fixed: Wildcard CORS** — Replaced `origin: '*'` with environment-aware allowlist.
  Production: `admin.webwaka.app`, `super-admin.webwaka.app` only.
- **Fixed: tenantId from JWT** — `getTenantId()` now reads exclusively from the verified
  JWT payload. Previously read from KV session which could be spoofed.
- **Added: Rate limiting** — `POST /auth/login` rate-limited to 10 attempts per 15 minutes
  per IP using KV-backed sliding window (`RATE_LIMIT_KV` binding required).
- **Added: Timing-safe user enumeration protection** — Dummy hash comparison runs even
  when user email is not found, preventing timing-based user enumeration attacks.
- **Added: `src/auth/password.ts`** — PBKDF2-SHA256 password hashing module
  (Workers-native, no bcrypt dependency).
- **Added: `migrations/011_fix_password_hashing.sql`** — Replaces the bcrypt demo hash
  in the seeded admin user with a PBKDF2 hash.
- **Updated: `wrangler.toml`** — Added `RATE_LIMIT_KV` binding (staging + production).
  Added comments for `JWT_SECRET` encrypted secret setup.

### Breaking Changes
- `RATE_LIMIT_KV` KV namespace must be created before deployment:
  `wrangler kv:namespace create RATE_LIMIT_KV --env staging`
- `JWT_SECRET` must be set as an encrypted secret:
  `wrangler secret put JWT_SECRET --env staging`
- Migration `011_fix_password_hashing.sql` must be applied to RBAC_DB before deployment.
- Frontend clients must discard old KV-based session tokens and re-authenticate to
  receive a proper signed JWT.

### References
- Security Audit: March 2026 WebWakaDOS Cross-Repo Security Audit
- PR: fix/auth-security-hardening
