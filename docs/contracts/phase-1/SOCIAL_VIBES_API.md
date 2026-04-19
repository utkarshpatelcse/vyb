# API Contract

Owner: Architecture Team
Last Updated: 2026-04-19
Change Summary: Added the live vibes contract for backend-backed short-form video discovery.

## Endpoint Definition

- `GET /v1/vibes`
- Purpose: return published vibe posts for the authenticated tenant.

## Request Highlights

- auth: verified membership required
- query params: `tenantId`, optional `limit`

## Response Highlights

- response shape matches feed-style items, filtered to vibe placement

## Core Rules

- vibes are tenant-scoped
- only published vibe items appear in the public list
- the same author and reaction metadata model as the main feed is preserved
