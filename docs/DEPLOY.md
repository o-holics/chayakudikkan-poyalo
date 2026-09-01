# Deploying chayakudikkanpoyalo

Vercel's native Git integration is **not** used (org / plan restriction). The
`.github/workflows/deploy.yml` action builds with the Vercel CLI and deploys the
prebuilt output. This needs no Pro plan.

## One-time setup

### 1. Create the Vercel project

From a machine with the repo checked out:

```bash
npm i -g vercel
vercel login
vercel link          # pick / create the project; writes .vercel/project.json
cat .vercel/project.json   # note "orgId" and "projectId"
```

In the Vercel dashboard → the project → **Settings → Git**: disconnect the Git
repository if it's connected. Deploys now come only from the Action.

### 2. GitHub repository secrets

Settings → Secrets and variables → Actions → **Secrets**:

| Secret | Value |
| --- | --- |
| `VERCEL_TOKEN` | Account Settings → Tokens → create one |
| `VERCEL_ORG_ID` | `orgId` from `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | `projectId` from `.vercel/project.json` |
| `CRON_SECRET` | same random string as the Vercel env var below |

And a **Variable** (not secret):

| Variable | Value |
| --- | --- |
| `APP_HOST` | deployed host, e.g. `chayakudikkanpoyalo.in` |

### 3. Vercel environment variables

Vercel project → Settings → Environment Variables (Production):

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_SERVICE_ACCOUNT_KEY     # service-account JSON, one line
CRON_SECRET                      # matches the GitHub secret
```

### 4. Firebase

- **Auth → Settings → Authorized domains**: add the deployed domain(s)
  (`chayakudikkanpoyalo.in`, the `*.vercel.app` URL).
- Deploy Firestore rules + indexes (once, and after any change):
  ```bash
  firebase deploy --only firestore
  ```

## Deploying

- **Automatic:** push to `main`.
- **Manual:** Actions → *Deploy to Vercel* → Run workflow.

## Matchmaker tick

`.github/workflows/cron-tick.yml` POSTs `/api/cron/tick` every ~5 min (GitHub's
floor; timing is best-effort). It's only a backstop — clients drive matching in
real time. For tighter timing, point an external scheduler
(cron-job.org, 1-min interval) at the same endpoint with the
`Authorization: Bearer <CRON_SECRET>` header instead.
