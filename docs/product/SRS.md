# Vyb Software Requirements Specification

Owner: Product Team
Last Updated: 2026-04-19
Change Summary: Added the KIET-first verified auth rollout, profile completion requirements, the authenticated home-feed landing flow for the current Phase 1 web surface, the Phase 1 hosting topology requirement, and the first live social requirements for user IDs, search, follows, stories, and vibes.

## 1. Introduction

### 1.1 Purpose

This SRS defines the functional and non-functional requirements for Vyb. It is a living specification and must stay aligned with the actual product scope.

### 1.2 Scope

Vyb is a verified digital campus platform for students, faculty, and alumni. Phase 1 focuses on identity, communities, social posting, academic resources, and controlled college onboarding.

Phase 1 ships through the web client and one backend runtime. The architecture must remain ready for future native Android and iOS applications and later microservice extraction without forcing that operational complexity today.

### 1.3 Intended Users

- students
- faculty
- alumni
- moderators
- admins
- engineering team
- product team

## 2. Phase 1 Functional Scope

### 2.1 Authentication and Identity

- Users shall sign in through Firebase Auth.
- Users shall verify email-password accounts through Firebase email verification before authenticated app access is granted.
- The system shall map each authenticated account to an internal user record.
- The system shall support domain-based college verification.
- The system shall reject non-college or non-approved domains from the authenticated app flow.
- The initial production rollout shall accept only `@kiet.edu` accounts while the implementation remains extensible for additional approved colleges later.
- The system shall support an onboarding path for colleges where domain verification is not yet configured.
- The system shall support role assignment through tenant memberships.
- Newly authenticated users shall complete a baseline campus profile before entering the main authenticated home feed.
- The baseline campus profile shall capture a unique campus user ID, first name, optional last name, course, stream or specialization, year, section, and optional hostel details.
- After successful profile completion, the authenticated user shall land on the main home feed that prioritizes stories, posts, and short-form discovery surfaces.
- The dashboard route shall remain available as a secondary profile-oriented surface rather than the first post-auth landing screen.
- Authenticated users shall be able to change their campus user ID later from the profile route.

### 2.2 Tenant and Community Management

- The system shall support multiple colleges as isolated tenants.
- The system shall support communities such as batch, branch, hostel, club, and general.
- A verified user shall only access tenant data for the tenant they belong to.
- Admins and moderators shall manage community visibility and membership flows where required.

### 2.3 College Join Requests

- If a user signs in with an unrecognized college domain, the system shall allow submission of a new college join request.
- A college join request shall capture college name, address, website, requester name, requester college email, requester phone number, and one or more requested domains.
- The system shall prevent silent auto-creation of a live college tenant from an unknown domain.
- Platform admins shall be able to approve, reject, or send back a college join request for changes.
- Approval of a college join request shall create or unlock the corresponding college tenant and approved domains.
- The requester shall be able to receive a request status such as pending, approved, rejected, or changes requested.

### 2.4 Campus Square Feed

- Verified users shall create text and image posts.
- Verified users shall create short-form video vibes for the dedicated discovery surface.
- Posts shall belong to a tenant and optionally to a community.
- Users shall browse posts in reverse chronological order initially.
- Users shall comment on posts.
- Users shall react to posts.
- Users shall search other campus profiles by user ID or name.
- Users shall follow or unfollow other campus profiles inside the same tenant.
- Users shall publish time-limited stories and those stories shall be visible to the author plus followed users.
- Reported or unsafe content shall be reviewable by moderators.

### 2.5 Resource Vault

- Verified users shall upload notes and academic files.
- Resources shall be categorized by course or subject metadata.
- Users shall browse and search recent or relevant resources within their tenant.
- Resource access controls shall respect tenant membership.

### 2.6 Moderation

- Users shall report posts, comments, and resources.
- Moderators shall review reports.
- Moderators shall change content status to removed where policy requires.
- Admin actions shall be auditable.

## 3. Deferred Scope

The following are intentionally deferred out of Phase 1:

- anonymous Nook
- wallet
- marketplace
- competitions
- AI roadmaps
- streaks

## 4. Non-Functional Requirements

### 4.1 Security

- All public APIs must pass through the Phase 1 backend entry boundary.
- Authentication and authorization must both be enforced.
- Sensitive actions must be audited.
- Tenant isolation must be enforced consistently.

### 4.2 Scalability

- Phase 1 shall ship as a modular monolith backend.
- Domain boundaries shall be explicit enough for future service extraction.
- Query design shall be index-aware.

### 4.3 Reliability

- User-generated writes shall be durable and traceable.
- Async jobs shall be retry-safe and idempotent.
- Upload failures shall not produce orphaned published content.
- The production backend runtime shall remain deployable as one Cloud Run service for core identity, campus, social, and resources flows.

### 4.4 Performance

- Feed and resource list endpoints shall use pagination.
- Hot queries shall be index-backed.
- Large image uploads should use client-side compression before upload where practical.

### 4.5 Maintainability

- Every feature shall have an LLD before coding.
- Every architecture change shall update the HLD.
- Every new service or dependency shall have an ADR.
- Module ownership shall remain explicit inside the monolith.

### 4.6 Multi-Surface Experience

- The web client shall support both mobile and desktop experiences at production quality.
- The Phase 1 web client shall support PWA installability for compatible mobile browsers.
- New UI features shall define mobile and desktop behavior before implementation.
- Backend APIs shall remain portable across web and future native apps.
- Shared code shall prioritize contracts, validation, and domain logic over forced component sharing.

## 5. External Interfaces

### 5.1 Client Applications

- Next.js web app
- SSR marketing and auth entry surfaces backed by the Phase 1 backend
- authenticated home feed surface for the first post-auth experience
- secondary profile/dashboard surface for account and campus details
- PWA-capable mobile-friendly experience
- future React Native / Expo mobile app for Android and iOS

### 5.2 Backend Runtime

- one modular-monolith Node backend in Phase 1
- production hosting shall support Google Cloud service identity for Firebase Admin and Data Connect access
- future module extraction into services only through approved ADRs

### 5.3 External Systems

- Firebase Auth
- Firebase Data Connect
- Firebase Storage
- Google Cloud Run for the Phase 1 backend host
- Vercel for the Phase 1 web host
- Gemini API in later phases

## 6. Core Data Requirements

- Every tenant-scoped entity shall include `tenant_id`.
- Every user-generated entity shall support soft delete using `deleted_at`.
- Every auditable action shall be traceable in `audit_logs`.
- Relevant engagement signals may be stored in `user_activity`.

## 7. Constraint Summary

- Phase 1 avoids high-legal-risk money flows
- Phase 1 avoids anonymous posting
- Phase 1 avoids short-form video complexity
- Documentation is mandatory and not optional
- Phase 1 backend hosting must not require multiple deployables for core identity, campus, social, and resources flows

## 8. Acceptance Criteria For Phase 1

- A verified student can join the correct college space
- A verified `@kiet.edu` student can complete profile setup before entering the authenticated home feed
- An unknown-domain student can submit a college join request instead of being stranded
- A platform admin can approve, reject, or send back a college join request
- The student can enter relevant communities
- The student lands on the main home feed after successful onboarding instead of being dropped into the profile page first
- The student can create a post and see it in the live feed
- The student can set a campus user ID, search other verified users by that ID, and follow them
- The student can publish a story and followed users can see it in their story lane
- The student can upload a vibe and see it on the dedicated short-form discovery route
- The student can upload and browse academic resources
- A moderator can review a reported item and take action
- The Phase 1 system can run with one backend runtime plus the web client
- All major Phase 1 APIs are documented and tenant-safe
