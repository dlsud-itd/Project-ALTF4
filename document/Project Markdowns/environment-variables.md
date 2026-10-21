# Environment Variables Specification

This document lists all configuration variables required by the ClinicQueue monorepo across environments.

## 1. Variable Inventory

| Variable Name | Required By | Environment | Sensitive | Description & Example |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Backend (`api`) | Local & Render | No | Set to `development` or `production`. Controls NestJS logging verbosity. |
| `PORT` | Backend (`api`) | Local & Render | No | Server port. Defaults to `3000` locally. Automatically provided by Render (`10000`). |
| `DATABASE_URL` | Backend (`api`), Prisma | Local & Render | **YES** | Supabase pooled connection string (port 6543 with `?pgbouncer=true`). |
| `DIRECT_URL` | Backend (`api`), Prisma | Local & Render | **YES** | Supabase direct connection string (port 5432) for running migrations. |
| `JWT_SECRET` | Backend (`api`) | Local & Render | **YES** | Required cryptographic key used to sign and verify JSON Web Tokens; the API does not use a built-in fallback. |
| `JWT_EXPIRES_IN`| Backend (`api`) | Local & Render | No | Token lifetime window. Default: `1d`. |
| `CORS_ORIGINS` | Backend (`api`) | Local & Render | No | Comma-separated allowed frontend origins (e.g. `http://localhost:4200,https://clinicqueue.vercel.app`). |
| `PUBLIC_API_URL`| Frontend (`web`) | Local & Vercel | No | Publicly accessible base URL of the NestJS REST API (`/api/v1`). |
| `PUBLIC_WS_URL` | Frontend (`web`) | Local & Vercel | No | Publicly accessible URL of the Socket.IO WebSocket server. |

---

## 2. Configuration by Platform

### Local Development (`.env`)
Create a local `.env` file in the repository root by copying the template:
```bash
cp .env.example .env
```
Ensure that `.env` is listed in `.gitignore` and never committed to version control.

### Render Backend Configuration (Render Dashboard)
Configure the following under **Environment** for your `clinicqueue-api` Web Service:
- `NODE_ENV`: `production`
- `PORT`: `10000`
- `DATABASE_URL`: `postgresql://postgres.[REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1`
- `DIRECT_URL`: `postgresql://postgres.[REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`
- `JWT_SECRET`: *(Generate a secure random string, e.g. using `openssl rand -base64 32`)*
- `JWT_EXPIRES_IN`: `1d`
- `CORS_ORIGINS`: `https://[your-vercel-app].vercel.app`

### Vercel Frontend Configuration (Vercel Dashboard)
Angular browser code executes on the client device and cannot securely consume server-side secrets. The public API URL is configured via:
1. **Build Configuration**: In `apps/web/src/environments/environment.prod.ts`, set the production Render URL:
   ```typescript
   export const environment = {
     production: true,
     apiUrl: 'https://clinicqueue-api.onrender.com/api/v1',
     wsUrl: 'https://clinicqueue-api.onrender.com',
   };
   ```
2. **Optional Runtime Injection**: Set a script variable in `index.html` or configure Vercel rewrite rules if dynamic domain changes are required without recompiling.
