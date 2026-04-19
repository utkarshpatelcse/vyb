# API Contract

Owner: Architecture Team
Last Updated: 2026-04-19
Change Summary: Added the user search contract for live campus profile discovery.

## Endpoint Definition

- `GET /v1/users/search`
- Purpose: search verified campus profiles by user ID or name.

## Request Highlights

- auth: verified membership required
- query params: `tenantId`, `q`, optional `limit`

## Response Highlights

- response includes `query` and `items[]`
- each item includes `userId`, `username`, `displayName`, `collegeName`, `course`, `stream`, `isFollowing`, and `stats`

## Core Rules

- search is tenant-scoped
- results exclude the current viewer by default
- follow-state is resolved per result for the current viewer
