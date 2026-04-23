# packages/design-tokens

Shared design language.

The canonical Vyb theme is the `Locked-In` theme. It is the default design system for every web surface and should be treated as the only approved palette unless a documented product decision says otherwise.

Contains:

- colors
- spacing
- type scale
- radii
- motion tokens

## Locked-In Theme

Core palette:

- Background: `#0F172A`
- Primary accent: `#6366F1`
- Secondary accent: `#14B8A6`
- Success: `#10B981`
- Glass surface: `#FFFFFF10`

Primary implementation file:

- `packages/design-tokens/src/theme.css`

Consumers:

- `apps/web/app/globals.css` exposes app-level aliases
- `apps/web/app/styles/campus-shell.css` maps campus surfaces
- `apps/web/app/styles/social-surfaces.css` maps stories, comments, and vibes surfaces
- `apps/web/app/styles/messages.css` maps chat surfaces

Rules:

- Add new shared visual tokens here first instead of hardcoding feature-specific colors.
- Prefer token aliases inside feature CSS rather than raw hex values.
- Any user-facing theme change must also update `docs/product/UI_THEME_GUIDE.md`.
