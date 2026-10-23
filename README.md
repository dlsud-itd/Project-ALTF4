# ClinicQueue

> Real-Time University Clinic Queue Management System  
> Designed for De La Salle University - Dasmariñas (DLSU-D ITD) by Team ALTF4.

---

## 1. System Overview

ClinicQueue is a full-stack real-time queueing and consultation coordination platform. The system streamlines patient walk-in triage, live consultation queue display, and healthcare staff counter operations.

### About the Project

ClinicQueue helps patients join the clinic queue and lets staff coordinate consultations through a live queue display and staff console. Real-time updates are pushed from the backend API to all connected clients via **Server-Sent Events (SSE)** — a unidirectional, HTTP-native push mechanism that requires no WebSocket handshake or third-party transport library.

> **Note — Monorepo-Inspired ≠ Monorepo**  
> This repository uses a **monorepo-inspired file structure**: all source code lives in a single Git repository under `apps/`, and shared tooling (scripts, Playwright, root `package.json`) is collocated at the root. However, it is **not** a true monorepo — there is no shared package graph, no cross-workspace TypeScript path aliases between `apps/api` and `apps/web`, and no unified build graph (e.g. Turborepo or Nx). Each application is independently built and deployed. The structure is chosen purely for developer convenience and source-control simplicity.

### Deployment Targets

- **Vercel Deployment**: [https://project-altf4.vercel.app/display](https://project-altf4.vercel.app/display)
- **Render Deployment**: [https://project-altf4.onrender.com/display](https://project-altf4.onrender.com/display)
- **Frontend**: [Vercel](https://vercel.com) — Angular 19 Single Page Application.
- **Backend & SSE**: [Render](https://render.com) — NestJS 11 REST API with Server-Sent Events.
- **Database**: [Supabase](https://supabase.com) — Hosted PostgreSQL with transaction pooling.
- **Source Control & CI**: [GitHub](https://github.com) — Source control and automation.

### Technology Stack

- **Frontend**: Angular 19, RxJS, PrimeNG, and SCSS.
- **Backend**: NestJS 11 REST API with Server-Sent Events (SSE) for real-time push updates.
- **Database**: PostgreSQL managed with Prisma ORM.

---

## 2. File Structure

> This is a **monorepo-inspired** layout — one repository, two self-contained apps — **not** a true monorepo with a unified build graph or shared package workspace.

```
Project-ALTF4/
├── apps/
│   ├── web/                    # Angular 19 Frontend (SPA)
│   └── api/                    # NestJS 11 API & SSE endpoint
│       └── prisma/             # Prisma schema, migrations, seed script
├── document/
│   └── Project Markdowns/      # Technical & deployment documentation
│       ├── architecture.md
│       ├── database-migrations.md
│       ├── deployment-vercel-render.md
│       └── environment-variables.md
├── scripts/                    # Verification scripts
├── e2e/                        # Playwright E2E smoke tests
├── package.json                # Root npm scripts (not a workspace manifest)
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

## 5. Root Commands

| Command                         | Description                                                |
| :------------------------------ | :--------------------------------------------------------- |
| `npm run dev:web`               | Start the Angular development server                       |
| `npm run dev:api`               | Start NestJS in watch mode                                 |
| `npm run build:web`             | Build Angular for production (`apps/web/dist/web/browser`) |
| `npm run build:api`             | Compile NestJS backend (`apps/api/dist/main.js`)           |
| `npm run build`                 | Generate Prisma client and build both apps in order        |
| `npm run lint`                  | Run code linter                                            |
| `npm run test`                  | Run automated backend unit/integration tests               |
| `npm run test:e2e`              | Run Playwright browser-level smoke tests                   |
| `npm run prisma:generate`       | Generate Prisma Client from `schema.prisma`                |
| `npm run prisma:migrate:dev`    | Create and apply development database migrations           |
| `npm run prisma:migrate:deploy` | Apply pending production migrations safely                 |
| `npm run prisma:seed`           | Seed initial admin, staff, and daily queue records         |

---

## 6. Key Endpoints

- **Frontend App**: `http://localhost:4200`
  - `/login` — Patient & Staff Login
  - `/register` — Patient Self-Registration
  - `/patient` — Patient Dashboard (protected, role: PATIENT)
  - `/staff` — Clinic Staff Console (protected, role: STAFF / ADMIN)
- **Backend API**: `http://localhost:3000/api/v1`
- **Health Check**: `http://localhost:3000/health`
- **Swagger Documentation**: `http://localhost:3000/api/docs`
- **SSE Stream**: `GET http://localhost:3000/api/v1/queues/:id/events` (native `EventSource`)

### Authentication & Profile API

The backend routes below use the `/api/v1` prefix:

| Method | Route            | Description                                                                                |
| :----- | :--------------- | :----------------------------------------------------------------------------------------- |
| `POST` | `/auth/register` | Create a patient account; `fullName`, `email`, `password`, and `affiliation` are required. |
| `POST` | `/auth/login`    | Authenticate and receive a JWT access token.                                               |
| `POST` | `/auth/logout`   | Revoke the authenticated bearer token.                                                     |
| `GET`  | `/users/me`      | Retrieve the authenticated user's profile.                                                 |
| `GET`  | `/users/:id`     | Retrieve a profile by ID; other users' profiles are forbidden.                             |

Registration accepts `student`, `faculty`, or `staff` affiliation values and requires a password of at least six characters. Names and emails are trimmed, email addresses are lowercased, and passwords are stored as Argon2 hashes. Authentication and profile endpoints return the response shapes in the API specification (`message` or profile fields on success; `{ "error": "..." }` on failure). Set `JWT_SECRET` in the environment; the API does not use a built-in fallback secret. Logged-out token IDs are stored in PostgreSQL until expiration.

### Real-Time Updates (SSE)

The queue module exposes a persistent SSE endpoint. Clients subscribe using the native browser `EventSource` API (or Angular's `HttpClient` with `observe: 'events'`). **No Socket.IO or WebSocket library is used.**

| SSE Event       | Trigger                                     |
| :-------------- | :------------------------------------------ |
| `queue:updated` | Patient joins walk-in, entry status changes |
| `queue:called`  | Staff calls the next patient                |

---

## 7. Detailed Documentation Links

- [System Architecture](document/Project%20Markdowns/architecture.md)
- [Environment Variables](document/Project%20Markdowns/environment-variables.md)
- [Vercel & Render Deployment Guide](document/Project%20Markdowns/deployment-vercel-render.md)
- [Database Migrations Guide](document/Project%20Markdowns/database-migrations.md)
