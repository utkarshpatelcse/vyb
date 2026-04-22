# API Contract

Owner: Architecture Team
Last Updated: 2026-04-22
Change Summary: Updated the live story contract with viewer state, story reactions, and seen-state companion endpoints.

## Endpoint Definition

- `POST /v1/stories`
- `GET /v1/stories`
- Purpose: publish active stories and read only the stories visible to the current viewer.
- Companion endpoints: `PUT /v1/stories/{storyId}/reactions`, `PUT /v1/stories/{storyId}/seen`

## Request Highlights

- auth: verified membership required
- create body: `tenantId`, `mediaType`, `mediaUrl`, optional `caption`
- read query: `tenantId`
- reaction body: story reaction type

## Response Highlights

- story payload includes `id`, `userId`, `username`, `displayName`, `mediaType`, `mediaUrl`, `caption`, `createdAt`, `expiresAt`, `isOwn`, `reactions`, `viewerHasLiked`, and `viewerHasSeen`
- seen writes return a viewer acknowledgement so the story lane can switch from active ring styling to seen styling

## Core Rules

- stories are tenant-scoped
- stories are visible to the author and followed users only
- only active stories inside the expiry window are returned
- story reactions are tenant-safe and exposed as lightweight likes in the current viewer
- story seen writes are idempotent and should be safe to repeat as the viewer advances through the lane
