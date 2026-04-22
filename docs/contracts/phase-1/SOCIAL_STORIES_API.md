# API Contract

Owner: Architecture Team
Last Updated: 2026-04-22
Change Summary: Updated the live story contract with immersive viewer behavior, own-story lane expectations, music-backed story publishing notes, story reactions, and seen-state companion endpoints.

## Endpoint Definition

- `POST /v1/stories`
- `GET /v1/stories`
- Purpose: publish active stories and read only the stories visible to the current viewer.
- Companion endpoints: `PUT /v1/stories/{storyId}/reactions`, `PUT /v1/stories/{storyId}/seen`
- Related helper: `GET /api/story-music` for royalty-free music search and proxied audio fetch before story publish

## Request Highlights

- auth: verified membership required
- create body: `tenantId`, `mediaType`, `mediaUrl`, optional `caption`
- music note: music-backed stories are exported client-side into a final video file first, then published through the same `POST /v1/stories` contract as a normal `mediaType=video` story
- read query: `tenantId`
- reaction body: story reaction type

## Response Highlights

- story payload includes `id`, `userId`, `username`, `displayName`, `mediaType`, `mediaUrl`, `caption`, `createdAt`, `expiresAt`, `isOwn`, `reactions`, `viewerHasLiked`, and `viewerHasSeen`
- seen writes return a viewer acknowledgement so the story lane can switch from active ring styling to seen styling
- multi-asset note: when the composer selects multiple story assets, the client creates multiple story records by repeating `POST /v1/stories`, one item per asset

## Core Rules

- stories are tenant-scoped
- stories are visible to the author and followed users only
- only active stories inside the expiry window are returned
- story reactions are tenant-safe and exposed as lightweight likes in the current viewer
- story seen writes are idempotent and should be safe to repeat as the viewer advances through the lane
- immersive viewer clients should group consecutive items per author, render segmented progress bars, and support embedded-audio playback with mute or unmute control
