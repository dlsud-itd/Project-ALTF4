# ClinicQueue End-to-End Production Deployment Guide

This guide describes the sequential procedure for deploying ClinicQueue across **Supabase**, **Render**, and **Vercel**.

---

## Deployment Architecture Overview
- **Database**: PostgreSQL hosted on **Supabase** (Southeast Asia / Singapore region recommended).
- **Backend**: NestJS 11 REST API + Socket.IO server hosted on **Render** as a long-running Web Service.
- **Frontend**: Angular 19 SPA hosted on **Vercel**.

---

## Step-by-Step Deployment Procedure

### Step 1: Create Supabase PostgreSQL Project
*(Manual Action in Supabase Dashboard)*
1. Log in to [supabase.com](https://supabase.com) and create a new project (e.g. `clinicqueue-db`).
2. Note your database password and project reference ID.
3. Navigate to **Project Settings** > **Database**:
   - Locate the **Connection string** section.
   - Select **URI** mode with **Transaction Pooler** (Port `6543`) for `DATABASE_URL`.
   - Select **Session** or **Direct connection** (Port `5432`) for `DIRECT_URL`.

---

### Step 2: Configure Database Connection Strings
*(Local Developer Machine)*
1. Add both connection strings to your local `.env`:
   ```env
   DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
   DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
   ```

---

### Step 3: Apply the Initial Database Migration
*(Local Developer Machine)*
Execute the migration command from the repository root:
```bash
npm run prisma:migrate:deploy
```
If scaffolding the first migration schema:
```bash
npm run prisma:migrate:dev -- --name init_clinicqueue
```
To populate the seed data (admin and staff user accounts, initial daily queue session):
```bash
npm run prisma:seed
```

---

### Step 4: Push Repository to GitHub
*(Local Developer Machine)*
Ensure all files are committed and pushed to your GitHub repository:
```bash
git checkout main
git push origin main
```

---

### Step 5: Create and Configure Render Web Service
*(Manual Action in Render Dashboard)*
1. Log in to [render.com](https://render.com) and select **New +** > **Web Service**.
2. Connect your GitHub repository `Project-ALTF4`.
3. Configure the service settings:
   - **Name**: `clinicqueue-api`
   - **Region**: Singapore (`singapore`)
   - **Branch**: `main`
   - **Root Directory**: Leave blank (monorepo root)
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run prisma:generate && npm run build:api`
   - **Start Command**: `node apps/api/dist/main.js`
   - **Plan**: `Starter` (or Free for testing)
4. Under **Advanced** > **Health Check Path**:
   - Set to `/health`
5. Under **Environment Variables**, add:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `DATABASE_URL`: `[Your Supabase Transaction Pooler URL]`
   - `DIRECT_URL`: `[Your Supabase Direct Port 5432 URL]`
   - `JWT_SECRET`: `[High-entropy secure random string]`
   - `JWT_EXPIRES_IN`: `1d`
   - `CORS_ORIGINS`: `http://localhost:4200` *(will update with Vercel domain in Step 9)*

---

### Step 6: Deploy Backend and Verify Health Check
1. Click **Create Web Service** on Render.
2. Monitor build logs:
   - Verify `prisma generate` succeeded.
   - Verify `nest build` succeeded.
   - Verify server started and logged `ClinicQueue API server running on http://0.0.0.0:10000`.
3. Test the live health check endpoint:
   ```bash
   curl https://clinicqueue-api.onrender.com/health
   ```
   Expected response:
   ```json
   {
     "status": "ok",
     "service": "clinicqueue-api",
     "timestamp": "2026-10-16T...",
     "uptimeSeconds": 15,
     "database": "connected"
   }
   ```
4. Access Swagger documentation at `https://clinicqueue-api.onrender.com/api/docs`.

---

### Step 7: Configure Vercel Project for Angular Frontend
*(Manual Action in Vercel Dashboard)*
1. Log in to [vercel.com](https://vercel.com) and click **Add New** > **Project**.
2. Import the `Project-ALTF4` repository.
3. In **Project Configuration**:
   - **Framework Preset**: `Angular`
   - **Root Directory**: Click edit and select or leave root. (With `vercel.json` present at the root, Vercel automatically detects the build command and output directory).
   - **Build Command**: `npm run build:web`
   - **Output Directory**: `apps/web/dist/web/browser`
   - **Install Command**: `npm install`
4. Confirm `apps/web/src/environments/environment.prod.ts` contains your Render backend domain:
   ```typescript
   export const environment = {
     production: true,
     apiUrl: 'https://clinicqueue-api.onrender.com/api/v1',
     wsUrl: 'https://clinicqueue-api.onrender.com',
   };
   ```

---

### Step 8: Deploy the Frontend
1. Click **Deploy** in Vercel.
2. Verify that the build succeeds and outputs to `apps/web/dist/web/browser`.
3. Note your assigned Vercel URL (e.g. `https://clinicqueue.vercel.app`).

---

### Step 9: Configure Vercel Origin in Render CORS Settings
*(Manual Action in Render Dashboard)*
1. Return to the Render dashboard for `clinicqueue-api`.
2. Go to **Environment** and update `CORS_ORIGINS`:
   ```
   https://clinicqueue.vercel.app,http://localhost:4200
   ```
3. Save changes. Render will automatically perform a zero-downtime rolling restart.

---

### Step 10: Verification Checklist
Perform these checks on the live deployment:
- [ ] Direct navigation to `https://clinicqueue.vercel.app/display` loads the Queue Board.
- [ ] Browser refresh on `/display`, `/patient`, and `/staff` does not throw 404 (rewrites working).
- [ ] Connection badge in header indicates `Online` (Socket.IO WebSocket connected to Render).
- [ ] Submitting a patient walk-in generates a sequential ticket number.
- [ ] Staff station can authenticate and call next patient.
- [ ] Live display updates dynamically without full-page refresh.
