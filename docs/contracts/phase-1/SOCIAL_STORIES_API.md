# API Contract

Owner: Architecture Team
Last Updated: 2026-04-19
Change Summary: Added the live story create and read contract for the current campus-social flow.

## Endpoint Definition

- `POST /v1/stories`
- `GET /v1/stories`
- Purpose: publish active stories and read only the stories visible to the current viewer.

## Request Highlights

- auth: verified membership required
- create body: `tenantId`, `mediaType`, `mediaUrl`, optional `caption`
- read query: `tenantId`

## Response Highlights

- story payload includes `id`, `userId`, `username`, `displayName`, `mediaType`, `mediaUrl`, `caption`, `createdAt`, `expiresAt`, `isOwn`

## Core Rules

- stories are tenant-scoped
- stories are visible to the author and followed users only
- only active stories inside the expiry window are returned
