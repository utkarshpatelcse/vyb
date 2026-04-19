# Vyb Client Platform Strategy

Owner: Architecture Team
Last Updated: 2026-04-19
Change Summary: Synced the client strategy with the Phase 1 modular monolith backend and the public-landing plus authenticated-home-feed web flow.

## 1. Purpose

This document defines how Vyb should support:

- responsive web for mobile browsers
- high-quality desktop web
- future native Android and iOS apps

The goal is to avoid painting the system into a web-only corner while also avoiding premature over-sharing of UI that hurts product quality.

## 2. Platform Strategy

### Phase 1

- ship `apps/web` using Next.js and PWA capabilities
- design every core flow to work well on mobile and desktop browsers
- keep backend contracts client-agnostic through one backend runtime
- provide installable mobile web behavior where browser support allows it
- send authenticated users to a useful `/home` feed first while keeping profile details on a separate route

### Future Native

- introduce `apps/mobile` using React Native / Expo
- reuse backend APIs, validation, contracts, and domain flow logic
- keep native presentation separate from web presentation

## 3. What Must Be Shared

- API contracts
- validation schemas
- domain-level business flow helpers
- design tokens
- analytics event names

## 4. What Must Not Be Forced To Be Shared

- page layouts
- navigation shells
- responsive CSS
- gesture interactions
- DOM-specific behavior
- native-only device integrations

## 5. UX Principles

- responsive web is mandatory, not optional
- no screen may ship with mobile-only assumptions
- no screen may ship with desktop-broken spacing, hierarchy, or navigation
- critical journeys must support keyboard and mouse on web
- mobile and desktop should feel like the same product, not the same exact layout
- mobile web should feel app-like through shell navigation, motion, spacing, and PWA install support
- logged-in users should land on useful campus content first, not on a profile management screen

## 6. Recommended Repo Allocation

### apps/web

- Next.js routes
- web-only page composition
- SSR and PWA behavior
- installability, manifest, service worker registration, and app-shell UX

### apps/backend

- public HTTP entry for Phase 1
- modular domain handlers for identity, campus, social, and resources
- client-agnostic API contracts

### apps/mobile

- React Native / Expo navigation
- native gestures and native packaging

### packages/contracts

- API request and response contracts

### packages/validation

- shared schemas and guards

### packages/app-core

- domain helpers and client-safe business-flow logic

### packages/design-tokens

- colors
- spacing
- typography scale
- radii
- motion tokens
- theme values

### packages/ui-web

- web primitives and layout components

### packages/ui-native

- native primitives and layout components

## 7. UI System Rules

- Design tokens are the single source of truth for visual language.
- Web components may use CSS and browser semantics.
- Native components may use React Native primitives and mobile gestures.
- Shared tokens must be versioned and documented.
- Dark mode can exist, but contrast and readability are more important than style trend.

## 8. API Design Implications

- APIs must not assume browser-only consumers.
- File upload registration flows must work for both web and native.
- Auth flows must support web sessions and future mobile token refresh patterns.
- Response shapes must be stable and portable across surfaces.

## 9. Definition Of Ready For UI Work

Before any UI implementation starts, the LLD must state:

- mobile behavior
- tablet or small desktop behavior where relevant
- large desktop behavior
- shared tokens touched
- whether the logic is shared or surface-specific

## 10. Anti-Patterns

- building only for mobile and hoping desktop works later
- putting DOM code into shared domain packages
- forcing web component reuse inside native app code
- adding hidden API coupling to a specific client
