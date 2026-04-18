# apps/api-gateway

Public backend entrypoint.

Responsibilities:

- auth guard
- tenant context resolution
- rate limiting
- request validation
- logging and tracing
- routing to internal services
- request IDs and explicit auth boundary for protected routes

Starter routes currently proxied:

- `POST /v1/auth/bootstrap`
- `GET /v1/me`
- `GET /v1/communities/my`
- `GET /v1/feed`
- `POST /v1/posts`
- `POST /v1/posts/:postId/comments`
- `PUT /v1/posts/:postId/reactions`
- `GET /v1/resources`
- `GET /v1/resources/:resourceId`
- `POST /v1/resources`
