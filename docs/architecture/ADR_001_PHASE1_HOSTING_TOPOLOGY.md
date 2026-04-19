# Vyb ADR 001: Phase 1 Hosting Topology

Owner: Architecture Team
Last Updated: 2026-04-19
Change Summary: Accepted the Phase 1 hosting split of Vercel for the web client and Cloud Run for the modular-monolith backend.

## 1. Metadata

- ADR ID: ADR-001
- Title: Phase 1 Hosting Topology
- Status: Accepted
- Date: 2026-04-19
- Owner: Architecture Team

## 2. Context

- Vyb Phase 1 ships as one responsive web client plus one modular-monolith backend.
- The web client is a Next.js App Router application that already matches Vercel's operating model well.
- The backend is a standalone Node HTTP server that listens on `PORT` and owns identity, campus, social, and resources routes.
- Firebase Admin and Data Connect calls must stay in a trusted server runtime with service-account-backed access.
- The engineering rulebook requires an ADR for any new external cloud component.

## 3. Decision

- Host `apps/web` on Vercel.
- Host `apps/backend` on Google Cloud Run as a single public backend service.
- Use a Cloud Run service identity instead of `GOOGLE_APPLICATION_CREDENTIALS` in production.
- Keep the backend as one deployable service in Phase 1 and avoid premature service splitting.

## 4. Alternatives Considered

- Option A: Host both web and backend on Vercel.
- Option B: Host both web and backend on Google Cloud Run.
- Option C: Host the web app on Vercel and the backend on Google Cloud Run.

## 5. Why This Decision

- benefits
  - Vercel remains the simplest fit for the Next.js web surface.
  - Cloud Run fits the current backend shape without rewriting the monolith into function-style handlers.
  - Firebase Admin and Data Connect access can use Cloud Run service identity cleanly.
  - The deployment topology still preserves one backend deployable for Phase 1.
- tradeoffs
  - The system now spans two hosting platforms in production.
  - Cross-platform environment management becomes part of the deployment checklist.
- operational impact
- Frontend deploys continue through Vercel.
- Backend deploys move through Cloud Run using the repo root container build.
- Continuous backend deployment can be layered on top through a Cloud Build trigger without changing the single-backend-service topology.
- Shared secrets such as `VYB_INTERNAL_API_KEY` must stay aligned across both platforms.
- cost impact
  - Cloud Run introduces backend hosting cost, but keeps ops overhead lower than a self-managed VM or Kubernetes path.

## 6. Security and Reliability Impact

- security implications
  - Production backend credentials must come from Cloud Run service identity, not checked-in keys.
  - Backend-only secrets remain outside the frontend and should be stored in Cloud Run or Secret Manager.
  - Internal backend proxying from the web app depends on a shared `VYB_INTERNAL_API_KEY`.
- failure modes
  - Cloud Run backend outage breaks authenticated flows that depend on the backend edge.
  - Misaligned environment variables between Vercel and Cloud Run can break session bootstrap or profile writes.
  - Missing tenant bootstrap or Data Connect access will cause onboarding and membership flows to fail after deploy.
- rollback path
  - Roll back the Cloud Run service to the last known-good revision.
  - Keep the previous Vercel deployment available for instant frontend rollback.
  - Revert the backend env file or Cloud Run revision if a bad config deploy caused the outage.

## 7. Documentation Impact

- HLD sections to update: Phase 1 deployables and hosting topology notes
- SRS sections to update: backend runtime and deployment constraints
- LLDs affected: Identity service deployment and auth bootstrap notes

## 8. Rollout Plan

- step 1: add Cloud Run deployment assets to the repo
- step 2: create backend service identity, environment variables, and tenant bootstrap data
- step 3: deploy backend to Cloud Run and point Vercel env vars at the live backend URL

## 9. Exit Criteria

- the backend monolith is reachable on a public Cloud Run URL
- the web app in Vercel can complete session bootstrap against the Cloud Run backend
- onboarding, profile save, and authenticated `/home` landing work against the hosted backend
