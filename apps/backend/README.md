# apps/backend

Phase 1 backend runtime for Vyb.

Responsibilities:

- modular monolith HTTP server
- auth boundary, request context, and public API handling
- domain modules for identity, campus, social, and resources
- Data Connect access and local fallback orchestration
- future extraction-ready module boundaries without multiple deployables today
- production hosting on Google Cloud Run through the repo root container build
