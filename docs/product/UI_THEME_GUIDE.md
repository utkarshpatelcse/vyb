# Locked-In UI Theme Guide

Owner: Product and Design System
Last Updated: 2026-05-05
Change Summary: Added the universal Vyb loading state rule alongside the canonical "Locked-In" theme so every web surface inherits the same palette, typography, glass treatment, loading motion, and interaction language.

## Purpose

This document is the single source of truth for Vyb's visual theme.

Every page, feature, modal, sheet, and new component must use this theme instead of introducing local color systems or one-off gradients.

## Canonical Theme

Theme Name: `Locked-In`

Visual Direction: `Cyber-Minimalism`

Core Principles:

- The app should feel focused, premium, and high-energy without becoming noisy.
- Surfaces should feel like translucent glass layered over a rich slate workspace.
- Primary emphasis should come from indigo glow, teal contrast, and restrained emerald success states.
- Visual identity must stay consistent across home, vibes, chats, events, market, profile, comments, sheets, and future features.

## Core Color Palette

- Primary background: `#0F172A`
- Primary accent: `#6366F1`
- Secondary accent: `#14B8A6`
- Success and streak color: `#10B981`
- Glass surface: `#FFFFFF10`
- Primary text: `#E6EEFC`
- Muted text: `#94A3B8`

## Surface Rules

- Cards must use the shared glass surface tokens instead of local hardcoded dark cards.
- Glass surfaces should use a 20px blur.
- Borders should stay soft and low-contrast.
- Shadow language should prefer indigo glow and the shared panel shadow tokens.

## Typography

- Primary font stack: `Plus Jakarta Sans`, `Inter`, `Segoe UI`, `sans-serif`
- Headings should feel compact, bold, and slightly tight.
- Body copy should stay clean and readable, never decorative.

## Motion And Interaction

- Motion should feel deliberate and fast, not playful.
- Hover, active, and focus states should come from theme tokens rather than custom page colors.
- Buttons and interactive pills can use subtle neumorphic indigo glow, but only through shared shadow tokens.

## Universal Loading State

The platform loading state is the animated Vyb logo loader.

- Use `VybLoadingState` from `apps/web/src/components/vyb-loading-mark.tsx` for route-level, page-level, and blocking async loading states.
- Use `VybLoadingMark` from the same module only when a parent surface already provides the loading container and accessible label.
- The loader must stay transparent and centered like a spinner replacement. Do not wrap it in a decorative card, panel, framed scene, progress bar, or separate branded loading page.
- Page-specific skeletons may render behind the universal loader by passing them as the `background` prop to `VybLoadingState`. The Vyb loader remains the primary foreground loading signal.
- The animation must use the canonical logo colors: violet-blue `#4245fd`, teal `#01bbb9`, and the final teal-side cut mask.
- New route `loading.tsx` files should render `VybLoadingState` instead of creating feature-specific spinners or full-page skeleton loaders.
- Skeletons are allowed as background structure for route loaders or as in-place content placeholders after the main route shell is already visible. They should not replace the universal loading state for navigation or blocking page loads.
- Tiny action-level indicators, such as upload progress or search-in-field progress, may remain compact local indicators when the Vyb loader would be too large for the control.
- Keep the screen-reader label intact through `aria-busy`, `aria-live`, and the visually hidden `vyb-loading-status` text.

## Implementation Rules

- Global theme tokens live in `packages/design-tokens/src/theme.css`.
- App-level aliases live in `apps/web/app/globals.css`.
- The universal loading component lives in `apps/web/src/components/vyb-loading-mark.tsx`, and its shared CSS lives in `apps/web/app/styles/base.css`.
- Campus shell surfaces must inherit from `apps/web/app/styles/campus-shell.css`.
- Social sheets and theater surfaces must inherit from `apps/web/app/styles/social-surfaces.css`.
- Chat and message surfaces must inherit from `apps/web/app/styles/messages.css`, but only through the shared theme tokens.

## Non-Negotiable Rules

- Do not create page-specific palettes when the shared theme can be used.
- Do not hardcode alternate brand colors for a single feature unless a documented product decision approves it.
- Do not introduce another loading spinner, route loader, or branded loading page when `VybLoadingState` fits.
- Do not treat `globals.css` as a dumping ground for feature-specific layout rules.
- New surfaces must consume the shared theme tokens first, then expose feature-local aliases only when needed.
- If a feature needs a new color, shadow, or blur treatment, add it to the design tokens package and document it here before shipping.

## Review Checklist

- Does the page use the Locked-In background and glass surfaces?
- Are the primary CTAs using the indigo-led shared gradients?
- Are market or transaction surfaces using the teal accent instead of inventing a new color?
- Are success, streak, and reward moments using emerald?
- Is the font stack using the shared sans token?
- Are shadows, borders, and blur values tokenized instead of hardcoded?
- Do route-level and blocking loading states use `VybLoadingState`?
- Does the page visually match the rest of the system without looking like a separate product?
