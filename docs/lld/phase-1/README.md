# Phase 1 LLD Index

Owner: Architecture Team
Last Updated: 2026-04-19
Change Summary: Updated the Phase 1 LLD set to reflect backend modules inside a modular monolith runtime.

## Module LLDs

- `IDENTITY_SERVICE_LLD.md`
- `CAMPUS_SERVICE_LLD.md`
- `SOCIAL_SERVICE_LLD.md`
- `RESOURCES_SERVICE_LLD.md`

## Build Order

1. Identity Module
2. Campus Module
3. Social Module
4. Resources Module

This order is intentional because authentication and membership context are prerequisites for all downstream modules.
