# ClinicQueue Monorepo

> Real-Time University Clinic Queue Management System  
> Designed for De La Salle University - Dasmariñas (DLSU-D ITD) by Team ALTF4.

---

## 1. System Overview

ClinicQueue is a full-stack real-time queueing and consultation coordination platform. The system streamlines patient walk-in triage, live consultation queue display, and healthcare staff counter operations.

### About the Project
ClinicQueue helps patients join the clinic queue and lets staff coordinate consultations through a live queue display and staff console. Real-time updates are powered by the backend API and its Socket.IO gateway.

### Deployment Targets
- **Vercel Deployment**: [https://project-altf4.vercel.app/display](https://project-altf4.vercel.app/display)
- **Render Deployment**: [https://project-altf4.onrender.com/display](https://project-altf4.onrender.com/display)
- **Frontend**: [Vercel](https://vercel.com) — Angular 19 Single Page Application.
- **Backend & WebSockets**: [Render](https://render.com) — NestJS 11 REST API and Socket.IO Server.
- **Database**: [Supabase](https://supabase.com) — Hosted PostgreSQL with transaction pooling.
- **Source Control & CI**: [GitHub](https://github.com) — Monorepo source control and automation.

### Technology Stack
- **Frontend**: Angular 19, RxJS, PrimeNG, and SCSS.
- **Backend**: NestJS 11 REST API with Socket.IO for real-time updates.
- **Database**: PostgreSQL managed with Prisma ORM.

---

## 2. Monorepo Structure

The repository has two main application folders: `apps/web` contains the Angular client, and `apps/api` contains the NestJS API, Prisma schema, migrations, and seed script.

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

### Prerequisites
- **Node.js**: `v20.x` or `v22.x` (LTS) or `v24.x`
- **npm**: `v10.x` or higher
- **PostgreSQL**: Supabase instance (or local PostgreSQL)

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
npm run prisma:migrate:dev
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

### Authentication & Profile API

The backend routes below use the `/api/v1` prefix:

| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/auth/register` | Create a patient account; `fullName`, `email`, `password`, and `affiliation` are required. |
| `POST` | `/auth/login` | Authenticate and receive a JWT access token. |
| `POST` | `/auth/logout` | Revoke the authenticated bearer token. |
| `GET` | `/users/me` | Retrieve the authenticated user's profile. |
| `GET` | `/users/:id` | Retrieve the authenticated user's profile by ID; other users' profiles are forbidden. |

Registration accepts `student`, `faculty`, or `staff` affiliation values and requires a password of at least six characters. Names and emails are trimmed, email addresses are lowercased, and passwords are stored as Argon2 hashes. Authentication and profile endpoints return the response shapes in the API specification (`message` or profile fields on success; `{ "error": "..." }` on failure). Set `JWT_SECRET` in the environment; the API does not use a built-in fallback secret. Logged-out token IDs are stored in PostgreSQL until expiration.

---

## 7. Detailed Documentation Links

- [System Architecture](document/Project%20Markdowns/architecture.md)
- [Environment Variables](document/Project%20Markdowns/environment-variables.md)
- [Vercel & Render Deployment Guide](document/Project%20Markdowns/deployment-vercel-render.md)
- [Database Migrations Guide](document/Project%20Markdowns/database-migrations.md)