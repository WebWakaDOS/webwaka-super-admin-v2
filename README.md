# WebWaka Super Admin v2 - Cloudflare Workers Edition

A production-ready super admin platform built with **Cloudflare Workers** (Hono API backend) and **Cloudflare Pages** (React frontend). Fully compatible with edge computing, with zero cold starts and global distribution.

## Quick Start

```bash
# Install dependencies
pnpm install

# Development
pnpm dev

# Build
pnpm build

# Deploy
pnpm deploy
```

## Demo Credentials
- Email: `admin@webwaka.com`
- Password: `password`

## Features

- ✅ Dashboard with real-time metrics
- ✅ Tenant management (CRUD + provisioning)
- ✅ Billing with ledger and commission calculator
- ✅ Module registry and feature flags
- ✅ System health monitoring
- ✅ Settings and API key management
- ✅ JWT authentication with RBAC
- ✅ Mobile-first, PWA-ready
- ✅ Dark mode support

## Architecture

- **Frontend**: React 19 + Vite + Tailwind 4 (Cloudflare Pages)
- **Backend**: Hono API Framework (Cloudflare Workers)
- **Storage**: Cloudflare KV Store
- **Database**: Ready for Cloudflare D1 integration

## Project Structure

```
webwaka-super-admin-v2/
├── frontend/          # React app (Cloudflare Pages)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── contexts/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── App.tsx
│   └── vite.config.ts
│
├── workers/           # Hono API (Cloudflare Workers)
│   ├── src/
│   │   └── index.ts
│   └── wrangler.toml
│
└── package.json       # Root monorepo
```

## API Endpoints

- `POST /auth/login` - Login
- `POST /auth/logout` - Logout
- `GET /tenants` - List tenants
- `POST /tenants` - Create tenant
- `GET /billing/metrics` - Billing metrics
- `GET /modules` - List modules
- `GET /health/status` - Health status
- `GET /settings` - Get settings

See [workers/src/index.ts](workers/src/index.ts) for complete API documentation.

## Development

```bash
# Terminal 1: Frontend dev server
cd frontend && pnpm dev

# Terminal 2: Workers dev server
cd workers && pnpm dev
```

Frontend will proxy API calls to `http://localhost:8787`.

## Deployment

```bash
# Deploy Workers
cd workers && pnpm deploy

# Deploy Pages
cd frontend && pnpm build
# Then connect to Cloudflare Pages dashboard
```

## License

MIT
