# packages/dataconnect

Firebase Data Connect service source for Vyb.

This directory is mapped from [firebase.json](/e:/CAMPUS%20LOOP/firebase.json) and follows the official Firebase Data Connect structure:

- `dataconnect.yaml` for service-level configuration
- `schema/` for the GraphQL schema
- service-owned connector directories such as `identity/`, `campus/`, `social/`, and `resources/`
- generated admin SDK packages such as `identity-admin-sdk/`, `campus-admin-sdk/`, `social-admin-sdk/`, and `resources-admin-sdk/` after CLI generation

The current schema uses synthetic unique key columns such as `tenantMembershipKey` and `reactionKey` to preserve application-level uniqueness while keeping UUID primary keys consistent with the HLD.

Reference:
- Firebase Data Connect config uses `firebase.json` `dataconnect.source` and `dataconnect.yaml` with `schema.source` and `connectorDirs`.
