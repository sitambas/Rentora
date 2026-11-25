# Deploying Rentora on Coolify

[Coolify](https://coolify.io) is a free, self-hosted platform that runs apps from a Git repository on your own server. This guide puts the database, API and web app on one server, each with HTTPS.

You end up with:

| Part | Runs as | Address (example) |
|---|---|---|
| PostgreSQL | Coolify database | internal only |
| API | `apps/api/Dockerfile` | `https://api.rentora.example.com` |
| Web app | `apps/web/Dockerfile` | `https://app.rentora.example.com` |

## 1. Get a server

- A Linux server (Ubuntu 24.04 LTS is a safe choice) with at least **2 CPUs, 4 GB RAM and 30 GB disk**. Coolify itself needs 2 GB; building the web app needs more.
- Open ports **22**, **80** and **443**. Port **8000** is Coolify's dashboard until you give it a domain.
- A domain whose DNS you control.

Install Coolify as root:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Open `http://<server-ip>:8000`, create the admin account straight away (the first person to open the page becomes admin), and finish the onboarding with **This Machine** as the server.

## 2. Point DNS at the server

Create two **A records** pointing to the server's IP:

- `api.rentora.example.com`
- `app.rentora.example.com`

Coolify requests Let's Encrypt certificates once these resolve.

## 3. Push the code

Coolify builds from Git. Push this repository to GitHub (private is fine). In Coolify, add it either through **Sources → GitHub App** (deploys automatically on every push) or as a **Private Repository (with deploy key)**.

## 4. Create the database

1. **Projects → Add project** (e.g. "Rentora"), open the **production** environment.
2. **+ New → Database → PostgreSQL**. Keep the defaults and **Start** it.
3. Copy its **Postgres URL (internal)**. It looks like `postgres://postgres:…@<id>:5432/postgres`.
4. Under **Backups**, add a schedule (daily is sensible). Add an S3-compatible destination under **Storage** so backups leave the server.

Don't make the database public; the API reaches it on Coolify's internal network.

## 5. Deploy the API

1. **+ New → Application**, choose the repository and the `main` branch.
2. **Build Pack: Dockerfile**.
   - **Base Directory:** `/`
   - **Dockerfile Location:** `/apps/api/Dockerfile`
3. **Domains:** `https://api.rentora.example.com`
4. **Ports Exposes:** `4000`
5. **Environment Variables:**

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the internal Postgres URL from step 4, with `?schema=public` added |
   | `JWT_SECRET` | a long random string, e.g. the output of `openssl rand -hex 32` |
   | `CORS_ORIGINS` | `https://app.rentora.example.com` |

   `NODE_ENV`, `PORT` and `UPLOADS_DIR=/data/uploads` are already set in the image.

6. **Persistent Storage → + Add → Volume**, destination path `/data/uploads`. Tenants' agreements and Aadhaar cards are stored here. Without the volume they are lost on every redeploy.
7. **Deploy.** On start the container runs `prisma migrate deploy`, so the database tables are created on the first deploy and updated on later ones.

Check `https://api.rentora.example.com/health` returns `{"ok":true}`.

## 6. Deploy the web app

1. **+ New → Application**, same repository and branch.
2. **Build Pack: Dockerfile**.
   - **Base Directory:** `/`
   - **Dockerfile Location:** `/apps/web/Dockerfile`
3. **Domains:** `https://app.rentora.example.com`
4. **Ports Exposes:** `3000`
5. **Environment Variables:** `NEXT_PUBLIC_API_URL` = `https://api.rentora.example.com`. Tick **Build Variable**: the address is built into the web app, and the build stops with a message if it is missing. Changing it later needs a redeploy.
6. **Deploy**, then open `https://app.rentora.example.com` and sign up as the owner.

## 7. Point the mobile app at the server

The Android APK has the API address built in. Rebuild it against the hosted API:

```bash
cd apps/mobile
echo 'EXPO_PUBLIC_API_URL=https://api.rentora.example.com' > .env
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease
```

The new APK is at `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` and works on any network. Before publishing on the Play Store, sign it with your own upload key instead of the debug key.

## Updating

Push to `main`. With the GitHub App source, Coolify rebuilds and redeploys automatically; otherwise press **Redeploy**. New Prisma migrations are applied when the API container starts.

## Backups

Two things hold data:

- **PostgreSQL**: covered by the scheduled backups from step 4.
- **The `/data/uploads` volume**: uploaded documents. Coolify doesn't back up volumes, so copy it off the server on a schedule (for example a cron job running `restic` or `rclone` against the volume's folder under `/var/lib/docker/volumes/`).

Test a restore at least once before relying on either.

## Building the images without Coolify

Both Dockerfiles build from the repository root:

```bash
docker build -f apps/api/Dockerfile -t rentora-api .
```

```bash
docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.rentora.example.com -t rentora-web .
```
