# Deployment Guide - WebWaka Super Admin v2

This guide covers deploying the v2 application to Cloudflare (Workers + Pages).

## Prerequisites

1. **Cloudflare Account** - Sign up at [cloudflare.com](https://cloudflare.com)
2. **Wrangler CLI** - Install globally: `npm install -g wrangler`
3. **Node.js 18+** - Required for build tools
4. **GitHub Account** - For source control (optional but recommended)

## Step 1: Prepare for Deployment

### 1.1 Authenticate with Cloudflare

```bash
wrangler login
```

This opens a browser to authenticate and grant Wrangler access to your Cloudflare account.

### 1.2 Create KV Namespaces

```bash
# Create production namespaces
wrangler kv:namespace create "SESSIONS" --preview false
wrangler kv:namespace create "CACHE" --preview false

# Create preview/staging namespaces
wrangler kv:namespace create "SESSIONS" --preview true
wrangler kv:namespace create "CACHE" --preview true
```

Note the namespace IDs returned and update `workers/wrangler.toml`.

### 1.3 Set Environment Variables

```bash
# Set JWT secret for production
wrangler secret put JWT_SECRET --env production
# Enter your secret when prompted

# Set JWT secret for staging
wrangler secret put JWT_SECRET --env staging
# Enter your secret when prompted
```

## Step 2: Deploy Workers API

```bash
cd workers

# Build the Worker
pnpm build

# Deploy to production
wrangler deploy --env production

# Or deploy to staging
wrangler deploy --env staging
```

After deployment, Wrangler will output your Worker URL:
```
✨ Deployed to https://webwaka-super-admin-api.webwakaagent18.workers.dev
```

## Step 3: Deploy Frontend to Cloudflare Pages

### Option A: Connect GitHub Repository

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Pages**
3. Click **Create a project** → **Connect to Git**
4. Select your GitHub repository
5. Configure build settings:
   - **Framework preset**: Vite
   - **Build command**: `pnpm install && pnpm build`
   - **Build output directory**: `frontend/dist`
   - **Root directory**: `frontend`
6. Add environment variables:
   ```
   VITE_API_URL=https://webwaka-super-admin-api.webwakaagent18.workers.dev
   ```
7. Click **Save and Deploy**

### Option B: Deploy Manually

```bash
cd frontend

# Build the frontend
pnpm build

# Install Wrangler Pages plugin
npm install -g @cloudflare/wrangler

# Deploy to Pages
wrangler pages deploy dist
```

## Step 4: Configure Custom Domain (Optional)

1. In Cloudflare Dashboard, go to **Pages** → Your project
2. Click **Custom domains**
3. Add your custom domain (e.g., `admin.yourdomain.com`)
4. Follow DNS configuration instructions

## Step 5: Set Up Environment Variables

### Frontend Environment Variables

Create `frontend/.env.production`:
```
VITE_API_URL=https://webwaka-super-admin-api.webwakaagent18.workers.dev
VITE_APP_TITLE=WebWaka Super Admin
```

### Workers Environment Variables

Already configured in `workers/wrangler.toml` and via `wrangler secret put`.

## Step 6: Verify Deployment

### Test Worker API

```bash
curl https://webwaka-super-admin-api.webwakaagent18.workers.dev/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-03-16T...",
  "environment": "production"
}
```

### Test Login

```bash
curl -X POST https://webwaka-super-admin-api.webwakaagent18.workers.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@webwaka.com","password":"password"}'
```

### Access Frontend

Open your Pages URL in a browser and test login with:
- Email: `admin@webwaka.com`
- Password: `password`

## Step 7: Monitor & Troubleshoot

### View Worker Logs

```bash
wrangler tail --env production
```

### View Pages Build Logs

1. Go to Cloudflare Dashboard → Pages
2. Click your project
3. Go to **Deployments** tab
4. Click a deployment to view logs

### Common Issues

**Issue**: CORS errors
- **Solution**: Verify CORS middleware is enabled in `workers/src/index.ts`

**Issue**: 404 on API endpoints
- **Solution**: Check that Worker routes are correctly configured in `wrangler.toml`

**Issue**: Frontend can't reach API
- **Solution**: Verify `VITE_API_URL` environment variable is set correctly

## Step 8: Set Up CI/CD (Optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - run: pnpm install
      
      - name: Deploy Workers
        run: cd workers && pnpm deploy --env production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      
      - name: Deploy Pages
        run: cd frontend && pnpm build && wrangler pages deploy dist
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

## Performance Optimization

### Enable Caching

Update `workers/wrangler.toml`:
```toml
[env.production]
routes = [
  { pattern = "api.yourdomain.com/*", zone_name = "yourdomain.com", custom_domain = true }
]
```

### Monitor Performance

1. Go to Cloudflare Dashboard
2. Navigate to **Analytics** for your Pages project
3. Check metrics like:
   - Page load time
   - Error rate
   - Cache hit ratio

## Scaling & Limits

- **Workers**: Unlimited requests (with rate limiting)
- **KV Store**: 1GB free, then $0.50/GB
- **Pages**: 500 builds/month free
- **Bandwidth**: Included with Cloudflare plan

## Rollback

### Rollback Worker

```bash
# View deployment history
wrangler deployments list

# Rollback to previous version
wrangler rollback --env production
```

### Rollback Pages

1. Go to Cloudflare Dashboard → Pages
2. Click your project
3. Go to **Deployments**
4. Click the deployment to rollback to
5. Click **Rollback to this deployment**

## Next Steps

1. ✅ Set up monitoring and alerting
2. ✅ Configure custom domain
3. ✅ Set up CI/CD pipeline
4. ✅ Enable analytics
5. ✅ Configure backup strategy
6. ✅ Plan for database integration (Cloudflare D1)

## Support

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Hono Documentation](https://hono.dev/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
