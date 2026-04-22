# API Contract

Owner: Architecture Team
Last Updated: 2026-04-22
Change Summary: Updated the live vibes contract for backend-backed short-form discovery with immersive playback consumers and shared engagement metadata.

## Endpoint Definition

- `GET /v1/vibes`
- Purpose: return published vibe posts for the authenticated tenant.
- Surface note: the response feeds the dedicated immersive `/vibes` route and the smaller teaser surface inside `/home`.

## Request Highlights

- auth: verified membership required
- query params: `tenantId`, optional `limit`

## Response Highlights

- response shape matches feed-style items, filtered to vibe placement
- each item preserves author identity, reaction counts, comment counts, viewer reaction state, media URL, and copy needed for the immersive vibe overlay

## Core Rules

- vibes are tenant-scoped
- only published vibe items appear in the public list
- the same author and reaction metadata model as the main feed is preserved
- likes, comments, reposts, edit/delete, and report flows use the shared post interaction endpoints
