# API Contract

Owner: Architecture Team
Last Updated: 2026-04-19
Change Summary: Added the follow and unfollow contract for the live campus-social graph.

## Endpoint Definition

- `PUT /v1/users/{username}/follow`
- `DELETE /v1/users/{username}/follow`
- Purpose: create or remove a tenant-scoped follow relationship.

## Request Highlights

- auth: verified membership required
- query params: `tenantId`

## Response Highlights

- response includes target `username`, `isFollowing`, and follow `stats`

## Core Rules

- follow relationships are tenant-scoped
- users cannot follow themselves
- duplicate follow writes collapse into one active relationship
