# Vyb Cloud Run Backend Deployment

Owner: Platform and Engineering
Last Updated: 2026-04-19
Change Summary: Added the repo-specific Cloud Run deployment guide for the Phase 1 backend monolith.

## 1. Purpose

This guide explains how to deploy the current `apps/backend` modular-monolith runtime to Google Cloud Run for the `vybnet-e2242` Firebase and Data Connect project.

## 2. Current Assumptions

- Firebase project: `vybnet-e2242`
- Data Connect service: `vyb`
- Data Connect location: `asia-south1`
- current first-onboarded college domain: `kiet.edu`
- frontend hosting: Vercel
- backend hosting: Cloud Run

## 3. Repo Assets Added For Deployment

- root [Dockerfile](/e:/CAMPUS%20LOOP/Dockerfile:1) for the backend container
- root [.dockerignore](/e:/CAMPUS%20LOOP/.dockerignore:1)
- root [.gcloudignore](/e:/CAMPUS%20LOOP/.gcloudignore:1)
- Cloud Run env template at [deploy/cloudrun/backend.env.example](/e:/CAMPUS%20LOOP/deploy/cloudrun/backend.env.example:1)

## 4. What The Backend Needs In Production

The backend code reads these production values:

- `FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `FIREBASE_DATACONNECT_SERVICE_ID`
- `FIREBASE_DATACONNECT_LOCATION`
- `VYB_DEFAULT_TENANT_SLUG`
- `VYB_DEFAULT_TENANT_DOMAIN`
- `VYB_INTERNAL_API_KEY`

Important:

- Do not set `GOOGLE_APPLICATION_CREDENTIALS` on Cloud Run.
- This repo uses Firebase Admin `applicationDefault()`, so production should rely on the Cloud Run service identity.

## 5. One-Time Google Cloud Setup

Run these commands in Cloud Shell or any terminal that has `gcloud` installed and authenticated:

```bash
gcloud config set project vybnet-e2242
gcloud config set run/region asia-south1
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com firebase.googleapis.com firebasedataconnect.googleapis.com
```

Create a backend service account:

```bash
gcloud iam service-accounts create vyb-backend --display-name="VYB backend"
```

Grant a simple starting role set:

```bash
gcloud projects add-iam-policy-binding vybnet-e2242 \
  --member="serviceAccount:vyb-backend@vybnet-e2242.iam.gserviceaccount.com" \
  --role="roles/firebase.admin"
```

## 6. Prepare The Backend Env File

Copy the example file and fill the real values:

```bash
cp deploy/cloudrun/backend.env.example deploy/cloudrun/backend.env
```

Recommended current rollout values:

- `FIREBASE_PROJECT_ID=vybnet-e2242`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=vybnet-e2242.firebasestorage.app`
- `FIREBASE_DATACONNECT_SERVICE_ID=vyb`
- `FIREBASE_DATACONNECT_LOCATION=asia-south1`
- `VYB_DEFAULT_TENANT_SLUG` and `VYB_DEFAULT_TENANT_DOMAIN` should point to the first onboarded college for the environment you are deploying
- `VYB_DEFAULT_TENANT_SLUG=kiet`
- `VYB_DEFAULT_TENANT_DOMAIN=kiet.edu`
- `VYB_INTERNAL_API_KEY=<long-random-secret>`

## 7. Deploy The Backend

From the repo root:

```bash
gcloud run deploy vyb-backend \
  --source . \
  --allow-unauthenticated \
  --service-account vyb-backend@vybnet-e2242.iam.gserviceaccount.com \
  --env-vars-file deploy/cloudrun/backend.env
```

This deploy uses the repo root `Dockerfile` and starts the backend through:

```bash
pnpm --filter @vyb/backend start
```

## 8. Verify The Service

After deploy, open the generated `run.app` URL and verify:

- `GET /health` returns `status: ok`
- `GET /v1/client-shell` returns the current tenant shell payload

## 9. Data Connect And Tenant Bootstrap

If the live tenant scaffold for the current first-college rollout is not already prepared, run:

```bash
pnpm dc:deploy
pnpm bootstrap:tenant -- --tenant-name "KIET Group of Institutions Delhi-NCR" --tenant-slug kiet --domain kiet.edu
```

Run those commands from a machine or Cloud Shell session that has Firebase CLI or the repo dependencies available and is authenticated to the same Google project.

## 10. Wire Vercel To The Hosted Backend

In Vercel, set:

- `NEXT_PUBLIC_API_BASE_URL=https://<cloud-run-url>`
- `VYB_API_BASE_URL=https://<cloud-run-url>`
- `VYB_INTERNAL_API_KEY=<same-secret-used-on-cloud-run>`
- the same public Firebase web config values already used locally
- for market/social uploads and DataConnect-backed game routes that still pass through the Next.js server runtime, set `FIREBASE_ADMIN_CREDENTIALS_JSON` or `FIREBASE_ADMIN_CREDENTIALS_BASE64` with a Firebase service account because Vercel does not provide Cloud Run-style service identity

Redeploy Vercel after changing the environment variables.

## 11. First Production Smoke Test

Verify these flows:

1. `/` renders
2. `/login` renders
3. Google login with an account from the currently approved college domain succeeds
4. new user reaches `/onboarding`
5. onboarding submit succeeds
6. user lands on `/home`

## 12. Rollback Notes

- roll back Cloud Run to the previous revision if backend changes break auth or profile flows
- roll back the previous Vercel deployment if frontend env changes break the web shell
- restore the previous `VYB_INTERNAL_API_KEY` in both systems if a secret mismatch caused failures

## 13. Optional Auto Deployment From GitHub

If you want the backend to redeploy automatically whenever `main` changes, use the root [cloudbuild.backend.yaml](/e:/CAMPUS%20LOOP/cloudbuild.backend.yaml:1).

One-time preparation:

```bash
gcloud artifacts repositories create vyb \
  --repository-format=docker \
  --location=asia-south1
```

If the repository already exists, Google Cloud will report that and you can continue.

Get the project number:

```bash
PROJECT_NUMBER="$(gcloud projects describe vybnet-e2242 --format='value(projectNumber)')"
echo "$PROJECT_NUMBER"
```

Grant the default Cloud Build service account the minimum launch roles:

```bash
gcloud projects add-iam-policy-binding vybnet-e2242 \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding vybnet-e2242 \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud iam service-accounts add-iam-policy-binding vyb-backend@vybnet-e2242.iam.gserviceaccount.com \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

Then create a GitHub trigger in Google Cloud:

1. Open Google Cloud Console.
2. Go to `Cloud Build -> Triggers`.
3. Click `Create trigger`.
4. Connect the GitHub repository `utkarshpatelcse/vyb` if asked.
5. Name the trigger `vyb-backend-main`.
6. Choose event `Push to a branch`.
7. Set branch to `^main$`.
8. Choose configuration type `Cloud Build configuration file`.
9. Set location to `Repository`.
10. Set config path to `cloudbuild.backend.yaml`.
11. Create the trigger.

After that, each push to `main` builds the backend image and deploys a new Cloud Run revision automatically.

The repo's trigger config uses `CLOUD_LOGGING_ONLY` so user-specified trigger service accounts can run without requiring a custom logs bucket.
