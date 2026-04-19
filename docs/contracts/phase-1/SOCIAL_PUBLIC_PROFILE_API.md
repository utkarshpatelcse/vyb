# API Contract

Owner: Architecture Team
Last Updated: 2026-04-19
Change Summary: Added the public campus-profile contract for user-ID based profile views.

## Endpoint Definition

- `GET /v1/users/{username}`
- Purpose: return a tenant-scoped public profile, follow state, stats, and recent posts.

## Request Highlights

- auth: verified membership required
- query params: `tenantId`

## Response Highlights

- response includes `profile`, `stats`, `isFollowing`, `isViewerProfile`, and `posts`

## Core Rules

- public profile reads stay inside the viewer tenant
- campus user IDs are the primary lookup key
- recent posts are included so the profile page can render without extra round trips
