# apps/social-service

Owns:

- posts
- comments
- reactions
- feed read models
- local JSON-backed persistence for dev mode

Starter endpoints:

- `GET /health`
- `GET /v1/feed`
- `POST /v1/posts`
- `POST /v1/posts/:postId/comments`
- `PUT /v1/posts/:postId/reactions`
