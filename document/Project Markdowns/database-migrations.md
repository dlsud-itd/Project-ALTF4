# Database Migration Guide: Prisma & Supabase PostgreSQL

This document outlines the standard operating procedures for developing, applying, and deploying database migrations for the ClinicQueue system.

---

## 1. Connection Architecture: Pooled vs. Direct URLs

Prisma ORM communicates with Supabase PostgreSQL using two distinct connection strings configured in `apps/api/prisma/schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

- **`DATABASE_URL` (Port 6543)**: Connection pooler (PgBouncer in Transaction Mode). Used by the NestJS application at runtime to manage thousands of concurrent connections efficiently.
- **`DIRECT_URL` (Port 5432)**: Direct PostgreSQL connection. **Mandatory** for Prisma migration commands (`prisma migrate`), advisory locks, and table schema alterations, which cannot operate through a transaction pooler.

---

## 2. Local Development Workflow

### Step 1: Modify Prisma Schema
Edit `apps/api/prisma/schema.prisma` to add or modify models, relations, or enums.

### Step 2: Create and Apply Migration
Run the development migration command from the repository root:
```bash
npm run prisma:migrate:dev -- --name add_feature_name
```
This command:
1. Compares `schema.prisma` against your development database.
2. Generates a new SQL migration file in `apps/api/prisma/migrations/<timestamp>_<name>/migration.sql`.
3. Applies the SQL migration to your database.
4. Regenerates the Prisma Client automatically.

### Step 3: Seed Local Data
To populate seed accounts and an initial daily queue session:
```bash
npm run prisma:seed
```

---

## 3. Production Deployment Migration Workflow

> [!WARNING]
> Never use `prisma db push` in production. It does not track migration history and can lead to irreversible data loss or unversioned schema drift.

### Step 1: Pre-Deployment Migration Run
Before new backend container code receives traffic, apply pending committed migrations using the direct URL:

```bash
npm run prisma:migrate:deploy
```

`prisma migrate deploy`:
- Reads all SQL files in `apps/api/prisma/migrations/`.
- Queries the `_prisma_migrations` table in your Supabase database.
- Safely applies only unapplied migrations in chronological order.
- Exits with an error if a checksum mismatch or unresolved schema drift is detected.

### Step 2: One-Off Migration via Render Dashboard or CI
If your Render plan supports a Pre-Deploy command:
- Add `npm run prisma:migrate:deploy` to the Pre-Deploy Command field in the Render dashboard.
- If not supported on your plan, execute `npm run prisma:migrate:deploy` from an administrative CLI or GitHub Actions deployment workflow before activating the new version.

---

## 4. Troubleshooting & Best Practices

1. **Advisory Lock Timeouts**:
   If a migration hangs, verify that `DIRECT_URL` points to port `5432` and NOT port `6543`.
2. **Never Edit Past Migrations**:
   Once a migration is committed and pushed, create a new migration rather than modifying existing migration files.
3. **Foreign Key Deletion Rules**:
   Ensure `onDelete: Cascade` or `onDelete: SetNull` is explicitly set to prevent orphaned records.
