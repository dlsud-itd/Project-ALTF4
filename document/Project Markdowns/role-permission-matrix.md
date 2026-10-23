# Role-to-Permission Matrix

This document defines the authorization and access control architecture for ClinicQueue, mapping system roles and university affiliations to allowed API endpoints, frontend views, and clinic operations.

---

## 1. Role and Affiliation Dimensions

ClinicQueue enforces a dual-dimension identity model:

| Dimension | Enum Type | Values | Purpose |
| :--- | :--- | :--- | :--- |
| **Access Role** (`role`) | `AccessRole` | `PATIENT`, `STAFF`, `ADMIN` | Determines system permissions, accessible routes, and administrative capability. |
| **Affiliation** (`affiliation`) | `ClinicAffiliation` | `STUDENT`, `FACULTY`, `STAFF` | Identifies the user's institutional status at DLSU-D for clinical reporting and queue prioritization. |

> **Note:** A user's `affiliation` of `STAFF` refers to university staff/personnel (as a patient cohort), whereas `AccessRole` of `STAFF` refers to healthcare clinic staff operating the queue console.

---

## 2. API Endpoint Permissions Matrix

| Endpoint | Method | Public / Auth | Required Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| `/api/v1/auth/register` | `POST` | Public | None | Create new user account (`PATIENT` default role). |
| `/api/v1/auth/login` | `POST` | Public | None | Authenticate user; returns JWT with `jti` and user role. Inactive users rejected (401). |
| `/api/v1/auth/logout` | `POST` | Authenticated | Any active user | Revokes token via `RevokedToken` table. |
| `/api/v1/users/me` | `GET` | Authenticated | Any active user | Returns current user's profile (`id`, `fullName`, `email`, `affiliation`, `role`, `isActive`). |
| `/api/v1/users/:id` | `GET` | Authenticated | Self (`id === req.user.id`) or `ADMIN` | Returns specific user profile; non-matching IDs return 403 Forbidden. |
| `/api/v1/queues/:id/walk-in` | `POST` | Public / Auth | Any user | Register a walk-in patient into active queue. |
| `/api/v1/queues/:id/status` | `GET` | Public | Any user | Fetch current queue statistics (active ticket, total waiting, served count). |
| `/api/v1/queues/:id/events` | `GET (SSE)` | Public | Any user | Real-time Server-Sent Events stream for queue updates and ticket calling. |
| `/api/v1/queues/:id/call-next` | `POST` | Authenticated | `STAFF`, `ADMIN` | Call the next waiting patient at designated counter. |
| `/api/v1/queues/:id/entries/:entryId` | `PATCH` | Authenticated | `STAFF`, `ADMIN` | Update entry status (`CALLED`, `IN_SERVICE`, `SERVED`, `NO_SHOW`, `CANCELLED`). |

---

## 3. Frontend Route Protection Matrix

| Route | Guard(s) | Allowed Roles | Unauthenticated Redirect | Unauthorized Redirect |
| :--- | :--- | :--- | :--- | :--- |
| `/login` | `GuestGuard` / Redirect | Guests | N/A (accessible) | Redirect to home route based on role if logged in. |
| `/register` | `GuestGuard` / Redirect | Guests | N/A (accessible) | Redirect to home route based on role if logged in. |
| `/patient` | `AuthGuard`, `RoleGuard` | `PATIENT` | `/login?returnUrl=/patient` | `/staff` (if staff) or `/login` |
| `/staff` | `AuthGuard`, `RoleGuard` | `STAFF`, `ADMIN` | `/login?returnUrl=/staff` | `/patient` (if patient) or `/login` |
| `**` (Fallback) | None | All | Redirect to `/login` | N/A |

---

## 4. Account Lifecycle & Inactive Account Enforcement

- **Deactivated Accounts (`isActive: false`):**
  - **Login Attempt:** Returns `401 Unauthorized` (`Invalid email or password`).
  - **Existing JWTs:** `JwtStrategy` queries database on each authenticated request; if `isActive` is `false`, the request is immediately rejected with `401 Unauthorized`.
  - **Client Guards:** Frontend `AuthGuard` checks `user.isActive`. If deactivated during an active session, client storage is cleared and user is redirected to `/login?error=inactive`.
- **Token Revocation (Logout):**
  - Revoked tokens are persisted in `RevokedToken` table with expiration timestamp.
  - Expired revoked tokens are garbage-collected automatically upon subsequent logout calls.
