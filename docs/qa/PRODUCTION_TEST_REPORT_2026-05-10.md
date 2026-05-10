# Vyb Production System QA Report - 2026-05-10

Target: `https://vyb-web.vercel.app`
Execution date: 2026-05-10
Scope source: `docs/qa/SYSTEM_TEST_CASES.md`
Report type: Live production black-box QA with security and authorization checks.

Passwords supplied for the run were used for login only and are intentionally not stored in this report.

## 1. Result Summary

| Area | Status | Notes |
|---|---|---|
| Login and authenticated shell | Pass | Both supplied accounts logged in and reached `/home`. |
| Desktop route smoke | Pass | Main authenticated routes rendered meaningful content without framework error overlays. |
| Mobile route smoke | Pass | `/home` rendered at phone viewport `390x844` with usable feed content. |
| Post creation and visibility | Pass | Account A created normal and anonymous posts; Account B saw them. |
| Comments and reactions | Pass | Account B reacted and commented; counts and comment payloads updated. |
| Anonymous visibility | Pass | Anonymous post/comment masked author identity from Account B. |
| Market | Pass | Account A created listing through API; Account B saw and contacted it. |
| Scribble lobby | Pass | Account A created a room; Account B joined same room and both users appeared. |
| Games APIs | Pass | Connect and Queens daily APIs returned authenticated level/session data. |
| Chat send/read | Blocked | Browser context was not trusted for E2EE chat. App required device pairing/recovery flow. |
| Events create/register | Fail | Event create with media failed in production due serverless temp directory error. |
| Two different browser engines | Partial | Browser plugin smoke ran in Codex in-app Browser; two-account parallel flow ran in isolated Playwright Chromium contexts because Browser input automation failed on email field. |
| Security/authz spot checks | Mixed | Unauthenticated access blocked correctly; ownership delete denial worked but returned wrong HTTP classification. |

## 2. Environment And Tooling

| Dimension | Value |
|---|---|
| Production URL | `https://vyb-web.vercel.app` |
| Account A | `utkarsh.2226cse1210@kiet.edu` |
| Account B | `ashwani.2226cse1211@kiet.edu` |
| Browser plugin | Used for live visual smoke of `/login`. |
| Browser limitation | Plugin failed while typing into `type=email` login input with `setRangeText` unsupported for email input. |
| Fallback | Playwright `1.59.1` with isolated authenticated browser contexts. |
| Desktop viewport | Chromium desktop context, production pages. |
| Phone viewport | Chromium mobile context `390x844`. |
| Security lens | Authenticated/unauthenticated API access, cross-user visibility, anonymous masking, ownership denial, chat E2EE gating. |

## 3. Test Case Updates

`docs/qa/SYSTEM_TEST_CASES.md` was extended with a production two-account execution section:

- Added Account A and Account B personas without storing passwords.
- Added two-browser/profile rules for cookies, local storage, IndexedDB, service worker, and chat key isolation.
- Added production status values: Pass, Fail, Blocked, Not Run, Deferred.
- Added priority two-account flows for login, posts, anonymous visibility, chat, follow/search, market, events, Scribble, Connect/Queens, responsive smoke, and destructive admin blocking.

## 4. High Priority Findings

### F-001 - Event Creation Fails On Production

Severity: P1
Status: Open
Area: Events, media upload, serverless runtime

Reproduction:

1. Log in as Account A.
2. POST event creation data with media to `/api/events`.
3. Submit a future event with normal title, description, venue, date/time, and image.

Observed:

```json
{
  "error": {
    "code": "EVENT_CREATE_FAILED",
    "message": "ENOENT: no such file or directory, mkdir '/var/task/apps/web/.tmp'"
  }
}
```

The create request returned `400`. In the same run, `GET /api/events` returned `500` with empty body.

Expected:

- Event creation should succeed or fail with a user-actionable validation error.
- Production serverless code must not depend on creating a non-existent or non-writable app-local temp directory.
- Event listing API should remain healthy even after a failed create attempt.

Impact:

- Hosts cannot complete event creation with media on production.
- Account B registration/save visibility could not be validated because no event was created.
- The raw server path in the error message exposes implementation detail.

Recommendation:

- Use Vercel-compatible temp storage such as `/tmp` only for short-lived processing, or stream media directly to durable storage.
- Normalize user-facing and API errors so filesystem paths are not returned.
- Add a production-like integration test for event media upload.

### F-002 - Cross-User Delete Is Blocked But Returns Wrong Error Class

Severity: P2
Status: Open
Area: Authorization, posts API, error handling

Reproduction:

1. Account A creates post `2c5ef172-b4cd-49b3-a3a6-52619b5dd10c`.
2. Account B sends `DELETE /api/posts/2c5ef172-b4cd-49b3-a3a6-52619b5dd10c`.

Observed:

```json
{
  "error": {
    "code": "BACKEND_UNAVAILABLE",
    "message": "Only the post author can delete this post."
  }
}
```

HTTP status observed: `502`.

Expected:

- The denial should return `403 Forbidden` with an authorization-specific code such as `FORBIDDEN`.
- It should not be classified as backend unavailability.

Impact:

- The ownership control itself appears to work because Account B could not delete Account A's post.
- Clients, alerts, and QA dashboards can misclassify normal authorization denial as production outage.
- Security monitoring loses a clean signal for unauthorized access attempts.

Recommendation:

- Map ownership denials to `403`.
- Reserve `502/BACKEND_UNAVAILABLE` for real upstream/runtime failures.
- Add regression tests for non-owner edit/delete on posts, comments, market listings, and events.

## 5. Passed Functional Coverage

| ID | Flow | Result | Evidence |
|---|---|---|---|
| QA-LOGIN-A | Account A login | Pass | Login reached `/home`; feed rendered and session bootstrap completed. |
| QA-LOGIN-B | Account B login | Pass | Login reached `/home`; profile name `ASHWANI BAGHEL @ashwanibaghel` appeared. |
| QA-ROUTE-001 | `/home` | Pass | Feed rendered QA posts, reactions, comments, and composer actions. |
| QA-ROUTE-002 | `/create` | Pass | Create Studio rendered Post/Story/Post/Vibe choices, anonymous toggle, add photo, publish controls. |
| QA-ROUTE-003 | `/search` | Pass | Trending profiles and discovery feed rendered. |
| QA-ROUTE-004 | `/messages` | Pass with blocked send | Inbox rendered; secure chat asked to pair this browser. |
| QA-ROUTE-005 | `/market` | Pass | Items, Requests, Lend tabs, filters, listings, and right rail rendered. |
| QA-ROUTE-006 | `/hub` | Pass | Games Hub, Events Hub, leaderboard, Daily Zip Connect, Scribble, Queens rendered. |
| QA-ROUTE-007 | `/hub/gameshub/scribble` | Pass | Public rooms and create/join controls rendered. |
| QA-ROUTE-008 | `/hub/gameshub/queens` | Pass | Board, timer, reset, queens count, hint, and leaderboard rendered. |
| QA-ROUTE-009 | `/vibes` | Pass | Campus vibes list, reactions, share, repost, and more controls rendered. |
| QA-ROUTE-010 | `/dashboard` | Pass | Own profile, posts, vibes, saved, settings, and activity rendered. |
| QA-ROUTE-011 | `/profile/settings/chat-privacy` | Pass | Identity Vault rendered with `Needs pairing`, `Cloud synced`, and trusted devices state. |
| QA-MOBILE-001 | `/home` at `390x844` | Pass | Authenticated mobile feed rendered without blank page or framework overlay. |

## 6. Two-Account Social Flow Results

### Normal Post

Created by Account A:

- Post ID: `2c5ef172-b4cd-49b3-a3a6-52619b5dd10c`
- Text: `QA 2026-05-10 normal visibility post - automated test`
- API status: `201`
- Author shown as `UTKARSH PATEL @utkarshpatel`
- `isAnonymous`: `false`
- `allowAnonymousComments`: `true`

Account B validation:

- Saw the post on `/home`.
- Reacted with `fire`.
- Added visible comment: `QA 2026-05-10 B visible comment`.
- `GET /api/posts/{postId}/comments` returned the visible Account B comment.
- Feed counts updated to `1 reactions / 1 comments`.

Result: Pass.

### Anonymous Post

Created by Account A:

- Post ID: `75542632-39af-42bf-8fc1-72f1622ca9a0`
- Text: `QA 2026-05-10 anonymous visibility post - automated test`
- API status: `201`
- `isAnonymous`: `true`
- Author shown as `Anonymous Vyber`
- Returned author `userId`: `null`
- Returned author `membershipId`: `null`

Account B validation:

- Saw the anonymous post on `/home`.
- Added anonymous comment: `QA 2026-05-10 anonymous B comment`.
- `GET /api/posts/{postId}/comments` returned the comment with author masked as `Anonymous Vyber`.
- Feed count updated to `0 reactions / 1 comments`.

Result: Pass.

## 7. Chat And E2EE

| Check | Result | Notes |
|---|---|---|
| `/messages` route renders | Pass | Inbox rendered for authenticated account. |
| Chat trust gate | Pass | UI blocked untrusted context and showed `Pair this browser from settings`. |
| Chat privacy settings render | Pass | Identity Vault showed `Needs pairing`, cloud sync state, and trusted devices. |
| Send Account A to Account B | Blocked | Current automated browser context was not a trusted chat device. |
| Realtime read/reaction/typing | Blocked | Requires chat device pairing, recovery phrase, PIN, or trusted device approval. |

Security interpretation:

- The chat gate is behaving defensively for a fresh browser context.
- Full message send/read tests need a trusted-device setup procedure or a test-only account with recovery material available to QA.

## 8. Market Results

Created by Account A through authenticated API:

- Listing ID: `listing-1d62c43e-cfed-4d9b-8cfc-388669b03d7e`
- Title: `QA 2026-05-10 Market item`
- Category: `Tech`
- Price: `123`

Account B validation:

- `GET /api/market` returned `200`.
- Listing title was visible in returned dashboard data.
- `POST /api/market/contact` returned `200`.
- Listing `inquiryCount` updated to `1`.

Result: Pass.

Coverage note:

- Route UI was smoke-tested.
- The create/contact assertions above were API-level. Full UI composer submission should be repeated in a longer manual pass.

## 9. Games And Leaderboards

| Flow | Result | Evidence |
|---|---|---|
| Connect daily API | Pass | Authenticated `GET /api/games/connect/daily` returned `200` with level/session/leaderboard structure. |
| Queens daily API | Pass | Authenticated `GET /api/games/queens/daily` returned `200` with level/session/leaderboard structure. |
| Queens UI | Pass | Board, timer, reset, queen counter, hint, and leaderboard rendered. |
| Hub leaderboard empty state | Pass | UI displayed `No valid solve yet today` when no solve existed. |
| Connect UI route | Needs follow-up | One route-smoke pass showed loading text while API was healthy. Needs repeat with longer wait and solve attempt. |
| Full solve and leaderboard rank | Deferred | Puzzle solving/score submission needs a longer focused run. |

## 10. Scribble Two-Account Results

Account A:

- Opened `/hub/gameshub/scribble`.
- Created a room with the `Launch Scribble Room` control.
- Room code observed in run: `ZNOR5L`.

Account B:

- Opened `/join/scribble?code=ZNOR5L`.
- Joined the same room.

Observed in both contexts:

- Room code `ZNOR5L`.
- Player count `2/8`.
- Account A displayed as host.
- Account B displayed in player list.
- Account B saw `Waiting for host to start`.

Result: Pass for room create/join/realtime lobby visibility.

Deferred:

- Host start, drawing canvas, guessing, score, round timer, disconnect/reconnect, and leaderboard were not completed in this run.

## 11. Security Checks

| Check | Result | Evidence |
|---|---|---|
| Unauthenticated `GET /api/profile` | Pass | Returned `401 UNAUTHENTICATED`. |
| Unauthenticated `POST /api/posts` | Pass | Returned `401 UNAUTHENTICATED`. |
| Account B sees Account A normal post | Pass | Expected public/feed visibility. |
| Account B sees Account A anonymous post | Pass | Author remained masked. |
| Account B comments on Account A post | Pass | Allowed by post settings and visible in comments API. |
| Account B anonymous comment masking | Pass | Author masked and identity fields not exposed. |
| Account B deletes Account A post | Fail in error mapping | Delete blocked, but returned `502 BACKEND_UNAVAILABLE` instead of `403 FORBIDDEN`. |
| Chat untrusted browser | Pass | Message access blocked until pairing. |
| Event error leakage | Fail | API returned server filesystem path `/var/task/apps/web/.tmp`. |

## 12. Console And UI Health

Observed:

- Login page rendered with title `Vyb`.
- Production login page showed expected controls: Google login, college email, password, forgot password, sign in, register switch.
- Authenticated pages did not show framework error overlays during smoke passes.
- Repeated CSS preload warnings appeared during route smoke. They did not block the tested flows.

Tooling note:

- An old localhost HMR warning was present in Browser plugin logs from an existing tab; it was not treated as production evidence.

## 13. Blocked, Deferred, Or Not Run

| Area | Status | Reason |
|---|---|---|
| Chat send/read/reaction/typing | Blocked | Fresh automated context was not a trusted E2EE device. |
| Event register/save by Account B | Blocked | Account A event creation failed. |
| Full story media upload | Deferred | Needs dedicated media matrix and cleanup window. |
| Full vibe video upload/playback | Deferred | Needs video asset matrix and processing observation. |
| Full Scribble gameplay | Deferred | Lobby verified; start/draw/guess/scoring needs focused run. |
| Connect/Queens solve submission | Deferred | APIs and UI rendered; leaderboard rank needs successful solve. |
| Admin/moderation destructive actions | Blocked | Destructive production action not approved. |
| True Chrome plus Edge/Safari engine comparison | Partial | Current automated run used Browser smoke plus Playwright Chromium contexts. |
| Accessibility screen reader pass | Deferred | Not covered by this execution window. |
| Offline/slow 3G/websocket blocked matrix | Deferred | Not covered by this execution window. |

## 14. Production Data Created

The following QA data was intentionally left in production for auditability unless manually cleaned later:

| Type | ID | Created By | Purpose |
|---|---|---|---|
| Normal post | `2c5ef172-b4cd-49b3-a3a6-52619b5dd10c` | Account A | Visibility, reaction, visible comment, ownership denial. |
| Anonymous post | `75542632-39af-42bf-8fc1-72f1622ca9a0` | Account A | Anonymous visibility and anonymous comment masking. |
| Market listing | `listing-1d62c43e-cfed-4d9b-8cfc-388669b03d7e` | Account A | Account B listing visibility and contact flow. |
| Scribble room | `ZNOR5L` | Account A | Account B join and lobby visibility. |

## 15. Recommendations

1. Fix event media handling for Vercel/serverless runtime and retest event create/register/save end to end.
2. Correct API error mapping for ownership denials from `502 BACKEND_UNAVAILABLE` to `403 FORBIDDEN`.
3. Create a QA-only chat recovery flow or seed trusted-device state for automated E2EE chat testing.
4. Add production-safe cleanup tooling for QA posts, comments, market listings, event drafts, and game rooms.
5. Add automated two-user regression tests for post visibility, anonymous masking, comments, reactions, market contact, and Scribble lobby.
6. Run a second pass with real Chrome plus Edge/Safari/WebKit browser engines and a mobile device or device farm.
7. Repeat deferred media, offline, accessibility, websocket disruption, and leaderboard solve tests in a longer QA window.
