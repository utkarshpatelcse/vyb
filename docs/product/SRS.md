# Vyb Software Requirements Specification

Owner: Product Team
Last Updated: 2026-04-18
Change Summary: Renamed the product to Vyb and added the admin-reviewed college join-request workflow for unknown domains.

## 1. Introduction

### 1.1 Purpose

This SRS defines the functional and non-functional requirements for Vyb. It is a living specification and must stay aligned with the actual product scope.

### 1.2 Scope

Vyb is a verified digital campus platform for students, faculty, and alumni. Phase 1 focuses on identity, communities, social posting, academic resources, and controlled college onboarding.

Phase 1 ships through the web client, but the system architecture and shared code strategy must support future native Android and iOS applications without major backend redesign.

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
- The system shall map each authenticated account to an internal user record.
- The system shall support domain-based college verification.
- The system shall support an onboarding path for colleges where domain verification is not yet configured.
- The system shall support role assignment through tenant memberships.

### 2.2 Tenant and Community Management

- The system shall support multiple colleges as isolated tenants.
- The system shall support communities such as batch, branch, hostel, club, and general.
- A verified user shall only access tenant data for the tenant they belong to.
- Admins and moderators shall manage community visibility and membership flows where required.

### 2.3 College Join Requests

- If a user signs in with an unrecognized college domain, the system shall allow submission of a new college join request.
- A college join request shall capture college name, address, website, requester name, requester college email, requester phone number, and one or more requested domains.
- The system shall prevent silent auto-creation of a live college tenant from an unknown domain.
- Platform admins shall be able to approve, reject, or revert a college join request for more details.
- Approval of a college join request shall create or unlock the corresponding college tenant and approved domains.
- The requester shall be able to receive a request status such as pending, approved, rejected, or changes requested.

### 2.4 Campus Square Feed

- Verified users shall create text and image posts.
- Posts shall belong to a tenant and optionally to a community.
- Users shall browse posts in reverse chronological order initially.
- Users shall comment on posts.
- Users shall react to posts.
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

- reels
- anonymous Nook
- wallet
- marketplace
- competitions
- AI roadmaps
- streaks

## 4. Non-Functional Requirements

### 4.1 Security

- All public APIs must pass through the API Gateway.
- Authentication and authorization must both be enforced.
- Sensitive actions must be audited.
- Tenant isolation must be enforced consistently.

### 4.2 Scalability

- The architecture shall be service-oriented from the start.
- Services shall have explicit ownership and independently evolvable contracts.
- Query design shall be index-aware.

### 4.3 Reliability

- User-generated writes shall be durable and traceable.
- Async jobs shall be retry-safe and idempotent.
- Upload failures shall not produce orphaned published content.

### 4.4 Performance

- Feed and resource list endpoints shall use pagination.
- Hot queries shall be index-backed.
- Large image uploads should use client-side compression before upload where practical.

### 4.5 Maintainability

- Every feature shall have an LLD before coding.
- Every architecture change shall update the HLD.
- Every new service or dependency shall have an ADR.

### 4.6 Multi-Surface Experience

- The web client shall support both mobile and desktop experiences at production quality.
- The Phase 1 web client shall support PWA installability for compatible mobile browsers.
- New UI features shall define mobile and desktop behavior before implementation.
- Backend APIs shall remain portable across web and future native apps.
- Shared code shall prioritize contracts, validation, and domain logic over forced component sharing.

## 5. External Interfaces

### 5.1 Client Applications

- Next.js web app
- PWA-capable mobile-friendly experience
- future React Native / Expo mobile app for Android and iOS

### 5.2 External Systems

- Firebase Auth
- Firebase Data Connect
- Firebase Storage
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

## 8. Acceptance Criteria For Phase 1

- A verified student can join the correct college space
- An unknown-domain student can submit a college join request instead of being stranded
- A platform admin can approve, reject, or send back a college join request
- The student can enter relevant communities
- The student can create a post and see it in the feed
- The student can upload and browse academic resources
- A moderator can review a reported item and take action
- All major Phase 1 APIs are documented and tenant-safe
