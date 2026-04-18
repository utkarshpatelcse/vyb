# Phase 1 LLD Index

Owner: Architecture Team
Last Updated: 2026-04-18
Change Summary: Initial execution-ready LLD set for Phase 1 core services.

## Service LLDs

- `IDENTITY_SERVICE_LLD.md`
- `CAMPUS_SERVICE_LLD.md`
- `SOCIAL_SERVICE_LLD.md`
- `RESOURCES_SERVICE_LLD.md`

## Build Order

1. Identity Service
2. Campus Service
3. Social Service
4. Resources Service

This order is intentional because authentication and membership context are prerequisites for all downstream services.
