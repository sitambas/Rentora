# Rentora

Rent management for property owners, managers and tenants: rent billing and collection, leases, maintenance requests, tenant applications, messaging, building notices and smart-locker parcels.

| Part | Folder | Stack |
| --- | --- | --- |
| API | `apps/api` | Node.js, Express, Prisma, PostgreSQL |
| Web app | `apps/web` | Next.js 15 (React 19) |
| Mobile app | `apps/mobile` | Expo SDK 58 (React Native), iOS and Android |
| Shared types and helpers | `packages/shared` | TypeScript, no dependencies |

`apps/api`, `apps/web` and `packages/shared` are npm workspaces. `apps/mobile` is its own npm project (Expo manages its versions) and imports `packages/shared` through `metro.config.js`.

## Run it locally

You need Node.js 20+ and PostgreSQL.

```bash
npm install
```

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`: set `DATABASE_URL` to your Postgres database and `JWT_SECRET` to a long random string (`openssl rand -hex 32`). Then create the database tables:

```bash
createdb rentora_app
```

```bash
npm run db:setup
```

Start the API (port 4000) and the web app (port 3000) in two terminals:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Open http://localhost:3000.

### Mobile app

```bash
cd apps/mobile && npm install && npx expo start
```

Scan the QR code with Expo Go on your phone. The phone must be on the same Wi-Fi as your computer; the app finds the API on the computer running `expo start` automatically. To point it at another server, set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` (see `.env.example`).

### First steps

The database starts empty.

1. On the web app, choose **Create an account** and sign up as an owner.
2. Add a property, then its units.
3. Move a tenant into a unit. Rentora creates the tenant's account and shows a temporary password once; send it to them so they can sign in on the web or the mobile app.
4. To give a manager access, have them sign up as a manager, then enter their mobile number on the property.

## Who can do what

- **Owners** sign up on the web, add properties and units, assign a manager by mobile number, and see everything for their properties.
- **Managers** sign up on the web, then see only the properties an owner assigned to them.
- **Tenants** don't sign up. An owner or manager adds them to a unit (or approves their application), which creates their account and shows a one-time temporary password to pass on.

| Feature | Web | Mobile |
| --- | --- | --- |
| Dashboard: collected, overdue, occupancy, cash-flow chart, action items | ✓ | ✓ |
| Units with search and filters, unit ledger | ✓ | ✓ |
| Send rent reminders, record payments | ✓ | ✓ |
| Bill a month's rent for all leases | ✓ | ✓ |
| Add units | ✓ | ✓ |
| Add properties, move tenants in, renew or end leases | ✓ | Web only |
| Maintenance requests and status updates | ✓ | ✓ |
| Applications: add, approve (creates lease), decline | ✓ | Approve and decline |
| Messages between tenants and owners/managers | ✓ | ✓ |
| Building notices, parcels with locker PINs | ✓ | ✓ (log deliveries on web) |
| Tenant: pay rent, breakdown, auto-pay toggle, history | ✓ | ✓ |

## How billing works

Each active lease gets one invoice per month (`Invoice`, unique per lease and month), due on the 5th. An invoice is **due** until the end of its due date, **overdue** after that, and **paid** once `paidAt` is set. Moving a tenant in bills the first month; **Bill rent** on the Payments screen creates the current month's invoices for every active lease and skips ones that already exist. Reminders are limited to one per invoice every 12 hours.

## Before going live

- **Online payments are in test mode.** `POST /invoices/:id/pay` marks the invoice paid straight away with a generated reference. Replace it with a payment gateway (for example Razorpay: create an order, confirm by webhook) before taking real money.
- **No automatic monthly billing yet.** Run **Bill rent** each month, or call `POST /invoices/generate` from a scheduled job.
- **Notifications are in-app only.** Reminders and notices appear in the bell menu; SMS, WhatsApp, email and push notifications are not connected.
- **Mobile sign-in stores the token in the device keychain** (`expo-secure-store`). The web app keeps it in `localStorage`; move to an httpOnly cookie if the web app and API share a domain.
- Set `CORS_ORIGINS` in `apps/api/.env` to your web app's real address.

## Hosting

`apps/api/Dockerfile` and `apps/web/Dockerfile` build production images from the repository root. [docs/deploy-coolify.md](docs/deploy-coolify.md) walks through running the database, API and web app on your own server with Coolify, including HTTPS, backups and rebuilding the Android app against the hosted API.

## Tests and checks

```bash
npm test
```

Runs the API end-to-end tests against the database in `apps/api/.env.test` (create it from `.env.example` with a database name containing `test`). The tests wipe that database and fill it with sample data from `apps/api/prisma/test-data.ts`, which refuses to run against any database whose URL doesn't contain `test`.

```bash
npm run typecheck
```

```bash
cd apps/mobile && npx tsc --noEmit && npx expo-doctor
```

## API overview

All routes except `/auth/login`, `/auth/register` and `/health` need `Authorization: Bearer <token>`.

| Area | Routes |
| --- | --- |
| Auth | `POST /auth/login`, `POST /auth/register`, `GET/PATCH /auth/me`, `POST /auth/password` |
| Owner dashboard | `GET /dashboard` |
| Properties and units | `GET/POST /properties`, `PATCH /properties/:id`, `GET/POST /units`, `GET/PATCH /units/:id` |
| Leases | `POST /leases`, `POST /leases/:id/renew`, `POST /leases/:id/end`, `PATCH /leases/mine` |
| Invoices | `GET /invoices`, `POST /invoices/generate`, `POST /invoices/:id/record`, `/remind`, `/pay` |
| Maintenance | `GET/POST /tickets`, `PATCH /tickets/:id` |
| Applications | `GET/POST /applications`, `POST /applications/:id/approve`, `/reject` |
| Notices and parcels | `GET/POST /notices`, `DELETE /notices/:id`, `GET/POST /parcels`, `POST /parcels/:id/collect` |
| Messages | `GET /messages`, `GET/POST /messages/:userId` |
| Notifications | `GET /notifications`, `POST /notifications/read-all` |
| Tenant home | `GET /home` |
