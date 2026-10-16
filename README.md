# ClinicQueue Monorepo

> Real-Time University Clinic Queue Management System  
> Designed for De La Salle University - Dasmariñas (DLSU-D ITD) by Team ALTF4.

---

## 1. System Overview

ClinicQueue is a full-stack real-time queueing and consultation coordination platform. The system streamlines patient walk-in triage, live consultation queue display, and healthcare staff counter operations.

### Deployment Targets
- **Frontend**: [Vercel](https://vercel.com) — Angular 19 Single Page Application.
- **Backend & WebSockets**: [Render](https://render.com) — NestJS 11 REST API and Socket.IO Server.
- **Database**: [Supabase](https://supabase.com) — Hosted PostgreSQL with transaction pooling.
- **Source Control & CI**: [GitHub](https://github.com) — Monorepo source control and automation.

---

## 2. Monorepo Structure

```
Project-ALTF4/
├── apps/
│   ├── web/                    # Angular 19 Frontend
│   └── api/                    # NestJS 11 API & Socket.IO Gateway
│       └── prisma/             # Prisma schema, migrations, seed script
├── document/
│   └── Project Markdowns/      # Technical & deployment documentation
│       ├── architecture.md
│       ├── database-migrations.md
│       ├── deployment-vercel-render.md
│       └── environment-variables.md
├── scripts/                    # Verification scripts
├── e2e/                        # Playwright E2E smoke tests
├── package.json                # Root npm workspaces manifest
├── render.yaml                 # Render infrastructure configuration
├── vercel.json                 # Vercel routing & build configuration
├── .env.example                # Safe environment variables template
└── README.md                   # This document
```

---

## 3. Prerequisites

- **Node.js**: `v20.x` or `v22.x` (LTS) or `v24.x`
- **npm**: `v10.x` or higher
- **PostgreSQL**: Supabase instance (or local PostgreSQL)

---

## 4. Quick Start & Local Development

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/dlsud-itd/Project-ALTF4.git
cd Project-ALTF4
npm install
```

### 2. Configure Environment Variables
Copy the template to create your local `.env`:
```bash
cp .env.example .env
```
Update `DATABASE_URL` and `DIRECT_URL` with your local or Supabase credentials.

### 3. Generate Database Client & Seed
```bash
npm run prisma:generate
npm run prisma:seed
```

### 4. Run Development Servers
In separate terminals or concurrent windows:
```bash
# Start NestJS backend (runs on http://localhost:3000)
npm run dev:api

# Start Angular frontend (runs on http://localhost:4200)
npm run dev:web
```

---

## 5. Root Workspace Commands

| Command | Description |
| :--- | :--- |
| `npm run dev:web` | Start the Angular development server |
| `npm run dev:api` | Start NestJS in watch mode |
| `npm run build:web` | Build Angular for production (`apps/web/dist/web/browser`) |
| `npm run build:api` | Compile NestJS backend (`apps/api/dist/main.js`) |
| `npm run build` | Generate Prisma client and build both apps in order |
| `npm run lint` | Run code linter |
| `npm run test` | Run automated backend unit/integration tests |
| `npm run test:e2e` | Run Playwright browser-level smoke tests |
| `npm run prisma:generate` | Generate Prisma Client from `schema.prisma` |
| `npm run prisma:migrate:dev` | Create and apply development database migrations |
| `npm run prisma:migrate:deploy` | Apply pending production migrations safely |
| `npm run prisma:seed` | Seed initial admin, staff, and daily queue records |

---

## 6. Key Endpoints

- **Frontend App**: `http://localhost:4200`
  - `/display` — Live Queue Display Board
  - `/patient` — Walk-In Queue Registration Portal
  - `/staff` — Clinic Staff Console
- **Backend API**: `http://localhost:3000/api/v1`
- **Health Check**: `http://localhost:3000/health`
- **Swagger Documentation**: `http://localhost:3000/api/docs`

---

## 7. Detailed Documentation Links

- [System Architecture](file:///c:/Users/VICTUS/Desktop/Project-ALTF4/document/Project%20Markdowns/architecture.md)
- [Environment Variables](file:///c:/Users/VICTUS/Desktop/Project-ALTF4/document/Project%20Markdowns/environment-variables.md)
- [Vercel & Render Deployment Guide](file:///c:/Users/VICTUS/Desktop/Project-ALTF4/document/Project%20Markdowns/deployment-vercel-render.md)
- [Database Migrations Guide](file:///c:/Users/VICTUS/Desktop/Project-ALTF4/document/Project%20Markdowns/database-migrations.md)