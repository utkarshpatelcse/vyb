# Vyb Complete System Test Cases

Owner: QA, Product, Engineering, Security
Generated from current repository routes, UI components, SRS, HLD, chat review docs, API routes, and a Browser smoke pass of `/login` on desktop and mobile.

## 1. Scope

This test suite covers Vyb web, backend, Data Connect-facing APIs, Firebase Auth/Storage boundaries, realtime WebSocket behavior, chat E2EE, PWA/browser behavior, desktop responsive views, and phone responsive views.

Primary surfaces:

- Public: `/`, `/login`, app manifest, icons, service worker.
- Authenticated: `/home`, `/dashboard`, `/create`, `/search`, `/u/[username]`, `/vibes`, `/reels`, `/market`, `/hub`, `/hub/gameshub`, `/hub/gameshub/connect`, `/hub/gameshub/queens`, `/hub/gameshub/scribble`, `/join/scribble`, `/messages`, `/messages/[conversationId]`, `/profile/settings/chat-privacy`, `/settings/security`, `/events`, `/events/host`, `/admin`, `/onboarding`, `/complete-profile`.
- APIs: `/api/auth/session`, `/api/profile`, `/api/profile/username`, `/api/posts/*`, `/api/comments/*`, `/api/stories/*`, `/api/vibes`, `/api/social-media/*`, `/api/story-music`, `/api/search-users`, `/api/follows/*`, `/api/chats/*`, `/api/market/*`, `/api/events/*`, `/api/games/*`, `/api/resources`, `/api/admin/*`.
- Backend modules: identity, campus, social, chat, resources, market, moderation, games.

## 2. Test Environments

Run every applicable test on:

| Dimension | Required Values |
|---|---|
| Desktop viewport | 1440x900, 1280x720, 1024x768 |
| Phone viewport | 390x844, 360x800, 375x667 |
| Browsers | Chrome desktop, Edge desktop, Safari/iOS WebKit, Android Chrome |
| Network | online, slow 3G, intermittent offline, backend down, websocket blocked |
| Session | unauthenticated, verified student incomplete profile, verified student complete profile, admin, moderator, other-tenant user, expired session |
| Data state | empty tenant, seeded tenant, high-volume feed/messages/events/market, deleted/removed content, stale local storage |

## 2.1 Production Two-Account Execution

Use this section for the live production test run on `https://vyb-web.vercel.app`. Do not store account passwords in this file or in screenshots.

| Persona | Login Email | Purpose |
|---|---|---|
| Account A | `utkarsh.2226cse1210@kiet.edu` | Primary creator: create posts/comments/stories/market/events, start chats, host or create rooms. |
| Account B | `ashwani.2226cse1211@kiet.edu` | Second actor: verify visibility, comment/reaction/follow/chat/realtime/game join behavior. |

Two-browser rules:

- Use separate browser profiles or browser contexts for Account A and Account B so cookies, local storage, IndexedDB chat keys, service worker state, and session cookies do not mix.
- Record which context is Account A and which is Account B in the report.
- For chat, comments, anonymous visibility, follow visibility, story visibility, Scribble rooms, and leaderboard/game visibility, execute both sides in parallel and record the observed sync result.
- If a test creates production data, prefix text with `QA <YYYY-MM-DD>` and remove or mark it complete after validation when the UI supports cleanup.
- Do not perform destructive admin, moderation, account, or irreversible data actions on production unless explicitly approved for that run; mark those cases `Blocked - destructive production action`.

Production execution status values:

| Status | Meaning |
|---|---|
| Pass | Tested on production and matched expected behavior. |
| Fail | Tested on production and found a product, UI, data, or security bug. |
| Blocked | Could not execute because of credentials, permissions, destructive risk, missing seed data, browser limitation, or service outage. |
| Not Run | Not attempted in the current execution window. |
| Deferred | Intentionally left for a longer/manual QA cycle with reason documented. |

Two-account priority flows for this run:

| Priority | Flow | Accounts |
|---|---|---|
| P0 | Login, session, route guards, profile completion status | A, B |
| P0 | Home/feed render, post visibility, comment visibility, reaction visibility | A creates, B verifies/responds |
| P0 | Anonymous post/comment visibility and author masking | A creates, B verifies |
| P0 | Chat one-to-one, E2EE setup/restore prompts, realtime send/read/reaction | A and B |
| P0 | Search and follow/unfollow visibility | A and B |
| P1 | Create Studio story/post/vibe route and validation | A |
| P1 | Market create/contact/save visibility | A creates, B contacts/saves |
| P1 | Events create/register/save visibility | A hosts, B registers/saves |
| P1 | Scribble create/join/start/guess realtime | A hosts, B joins |
| P1 | Connect/Queens leaderboard/hint/submit visibility | A and B |
| P1 | Responsive desktop and phone smoke for every main tab | A |
| P2 | Admin/moderation/settings destructive flows | Only if authorized; otherwise blocked |

## 3. Global Test Data Matrix

Use these values in every text, search, caption, comment, title, username, message, event, market, and admin field unless a field-specific rule overrides it.

| Type | Values To Try | Expected |
|---|---|---|
| Empty | empty string, spaces, tabs, newline-only | Required fields block submit; optional fields save as null/empty safely. |
| Normal | `Aarav`, `kiet_student`, `DBMS Notes`, `Central lawn` | Accepted where valid; stored and rendered exactly enough for product needs. |
| Min/max | 1 char, 2 chars, exact min, exact max, max+1, 5,000 chars | Correct validation message; no layout overflow. |
| Unicode | Hindi text, emoji, accented names, RTL text | Render safely; no broken alignment or data corruption. |
| XSS | `<script>alert(1)</script>`, `<img src=x onerror=alert(1)>`, markdown links | Render as text or sanitized content; no script execution. |
| SQL/GraphQL injection | `' OR '1'='1`, `"} mutation {`, `$ne`, `__proto__` | No query breakage; no cross-tenant data. |
| Path traversal | `../secret`, `..\\secret`, `%2e%2e%2f`, null byte | Rejected or treated as inert text; never reads arbitrary files. |
| URL abuse | `javascript:alert(1)`, `data:text/html`, `http://169.254.169.254`, very long URL | Links/media rejected or safely rendered; no SSRF. |
| Race input | double-click submit, back during submit, refresh during upload, two tabs editing same item | Idempotent behavior; no duplicates unless product explicitly allows. |

File matrix:

| File Type | Values To Try | Expected |
|---|---|---|
| Images | jpg, png, webp, gif, heic/heif under limit | Preview, upload, metadata, render, delete/remove work. |
| Bad images | renamed exe, SVG with script, corrupt image, zero-byte file | Rejected with clear error; no publish. |
| Social image limit | just below 4 MB, exactly 4 MB, above 4 MB | Storage/API rules enforce max. |
| Vibe video | mp4, webm, quicktime under 40 MB | Upload, processing, playback variants, publish. |
| Oversize vibe | 40 MB + 1 byte, huge duration, unsupported codec | Rejected before durable publish. |
| Chat image | encrypted blob under 12 MB and over 12 MB | Under limit succeeds; over limit fails; backend sees opaque bytes only. |
| Event/market media | multi-image, video, mixed files, duplicate filenames | Order, preview, remove, upload, edit persistence work. |

## 4. Global UI And Responsive Checks

| ID | Area | Steps | Expected |
|---|---|---|---|
| G-001 | Page identity | Open every route in section 1 at desktop and phone widths. | Correct title, route, primary heading/surface, no blank page. |
| G-002 | Framework errors | Open every route, hard refresh, navigate away/back. | No Next.js/Vite/framework overlay; no visible hydration mismatch. |
| G-003 | Console health | Check browser console during load and main interactions. | No app errors; known warnings are triaged. |
| G-004 | Layout fit | Test desktop and phone first viewport, scrolled middle, scrolled bottom. | No clipped text, overlapping buttons, hidden sticky bars, or horizontal body scroll. |
| G-005 | Tap targets | On phone, tap all nav, action icons, close buttons, carousel dots, game cells. | Minimum usable hit area; no mis-taps or hidden controls. |
| G-006 | Keyboard | Tab through all fields, modals, sheets, nav, game controls where applicable. | Focus visible, logical order, Escape closes modals, Enter submits only intended forms. |
| G-007 | Screen reader labels | Inspect buttons/icons/inputs for accessible names. | Icon-only controls have meaningful `aria-label`; dynamic status uses polite/live regions. |
| G-008 | Loading states | Throttle network and open every page. | Skeleton/loading state is readable and stable; no spinner forever. |
| G-009 | Empty states | Use empty tenant/store for feed, messages, events, market, games. | Helpful empty UI; no broken map/list access. |
| G-010 | Error states | Force API 401, 403, 404, 409, 413, 422, 500, timeout. | User sees actionable error; no raw stack/secrets. |
| G-011 | Back/forward | Navigate across tabs/pages, use browser back/forward. | State restores or resets intentionally; no duplicate route transitions. |
| G-012 | Mobile keyboard | Focus composer/search/forms on phone. | Input remains visible; sticky bottom nav/composer does not cover text or submit button. |
| G-013 | Modal/sheet layering | Open every modal, bottom sheet, lightbox, cropper, detail sheet. | Backdrop, z-index, scroll lock, close, Escape/back behavior correct. |
| G-014 | Double submit | Rapidly click every primary submit/action. | Button disables or server idempotency prevents duplicate writes. |
| G-015 | Offline | Turn offline during page load, submit, upload, chat send, game submit. | Pending state recovers; queued publish only where designed; no data loss. |
| G-016 | PWA | Install prompt, manifest, icons, service worker cleanup/reload. | App is installable; no stale broken assets; service worker does not cache auth incorrectly. |
| G-017 | Theme/local storage | Change theme/profile settings, refresh, sign out/in. | Stored preferences apply to right user only and do not leak across accounts. |

## 5. Routing And Access Control

| ID | Route | Actor | Steps | Expected |
|---|---|---|---|---|
| R-001 | `/` | Unauth | Open landing. | Public landing renders, CTA points to login/register, no auth-only data. |
| R-002 | `/` | Complete student | Open landing. | Redirects to `/home`. |
| R-003 | `/` | Incomplete student | Open landing. | Redirects to `/onboarding`. |
| R-004 | `/` | Admin | Open landing. | Redirects to `/admin`. |
| R-005 | `/login` | Unauth | Open page. | Login form renders: Google, college email, password, forgot password, register switch. |
| R-006 | `/login` | Complete student | Open page. | Redirects to `/home`. |
| R-007 | `/onboarding` | Unauth | Open page. | Redirects to `/login`. |
| R-008 | `/onboarding` | Complete student | Open page. | Redirects to `/home`. |
| R-009 | `/complete-profile` | Student | Open page. | Redirects to `/onboarding` or `/admin` for admin. |
| R-010 | `/home`, `/dashboard`, `/create`, `/hub`, `/messages`, `/market`, `/vibes`, `/search` | Unauth | Open directly. | Redirects to `/login`; no data fetch leaks. |
| R-011 | Auth pages | Incomplete student | Open protected routes. | Redirects to `/onboarding`. |
| R-012 | `/admin` | Student | Open directly. | Redirects to `/home` or returns forbidden; no admin shell. |
| R-013 | `/admin` | Super admin | Open directly. | Admin portal renders all tabs. |
| R-014 | `/u/[username]` | Same user | Open own profile. | Redirects to `/dashboard`. |
| R-015 | `/u/[username]` | Other user same tenant | Open existing username. | Public profile renders only allowed tenant profile data. |
| R-016 | `/u/[username]` | Other tenant | Open known username from another tenant. | 404/forbidden; no cross-tenant profile. |
| R-017 | Legacy redirects | Any | Open `/events`, `/reels`, `/settings/security`, `/scribble`, `/join/scribble?code=ABC12`. | Redirects preserve intended target and query safely. |
| R-018 | Unknown routes | Any | Open random page and bad IDs. | 404 or safe error; no stack trace. |

## 6. Auth, Signup, Login, Session

| ID | Case | Steps/Data | Expected |
|---|---|---|---|
| AUTH-001 | Login form render | Open `/login` desktop/phone. | Fields and buttons visible; no console errors; mobile card fits without clipping. |
| AUTH-002 | Register switch | Click `please register first`, then `Sign in`. | Mode toggles without losing layout; confirm password only in register mode. |
| AUTH-003 | Empty login | Submit blank email/password. | Native or app validation blocks; no API request with empty credentials. |
| AUTH-004 | Email normalization | Use uppercase, whitespace, mixed-case approved email. | Email is trimmed/lowercased before auth/session bootstrap. |
| AUTH-005 | Invalid email | `abc`, `a@b`, non-approved domain, personal Gmail. | Friendly college-domain or invalid-email error; Firebase user not left logged in. |
| AUTH-006 | Password boundaries | blank, 1 char, 7 chars, 8 chars, 128 chars. | Weak password rejected; strong accepted in sign-up path. |
| AUTH-007 | Confirm password | mismatch, exact match, whitespace variants. | Mismatch blocks; no account created. |
| AUTH-008 | Duplicate signup | Existing approved college email. | Shows account exists; no duplicate user/internal membership. |
| AUTH-009 | Email verification | Sign up email/password. | Verification link sent; user cannot enter app until verified. |
| AUTH-010 | Unverified login | Login before email verification. | Fresh verification sent, Firebase signed out, no app session cookie. |
| AUTH-011 | Forgot password | Blank email, invalid domain, valid approved email. | Blank/domain errors; valid sends reset link without revealing account existence beyond normal Firebase behavior. |
| AUTH-012 | Google sign-in | Approved college Google account. | Session bootstraps, route goes to `/onboarding` or `/home`. |
| AUTH-013 | Google cancel/blocked | Close popup, block popup. | Friendly error; busy state clears. |
| AUTH-014 | Session CSRF fetch | `GET /api/auth/session`. | Returns CSRF token and sets CSRF cookie. |
| AUTH-015 | Session POST missing token | POST without `idToken`. | 400 `MISSING_TOKEN`. |
| AUTH-016 | Session POST invalid CSRF | Send header/cookie mismatch. | 403 `INVALID_CSRF_TOKEN`. |
| AUTH-017 | Session POST cross-origin | POST with foreign `Origin`. | 403 `INVALID_ORIGIN`. |
| AUTH-018 | Session cookies | Successful session in prod-like config. | Cookies are HttpOnly, SameSite=Lax, Secure in prod, correct max age. |
| AUTH-019 | Expired session | Expire/delete cookies then use protected pages/APIs. | Redirect/401 and local sensitive UI state cleared. |
| AUTH-020 | Sign out | Click sign out from home/profile/login active session. | Session cookies deleted; chat vault cleared by shared secure sign-out path; redirect safe. |
| AUTH-021 | Account switch | User A logs out, User B logs in same browser. | No User A profile, chat keys, cached media, drafts, or local settings leak to User B. |
| AUTH-022 | Backend unavailable | Stop backend during session bootstrap. | Login shows temporary service error; no half-session cookie. |

## 7. Onboarding And Profile Completion

Fields: College read-only, College email read-only, User ID, First name, Last name, Course, Stream, Year, Section, Phone number, Hostel stay toggle, Hostel name.

| ID | Case | Steps/Data | Expected |
|---|---|---|---|
| ONB-001 | Initial render | Incomplete verified student opens `/onboarding`. | Read-only college/email render, suggestions visible, progress preview updates. |
| ONB-002 | User ID valid | `abc`, `a.b`, `a_b`, `a1b2`, max 24 chars. | Accepted and lowercased/sanitized. |
| ONB-003 | User ID invalid | `<3 chars`, `>24`, starts/ends dot, uppercase, spaces, hyphen, emoji. | Field error from username schema; submit blocked. |
| ONB-004 | Duplicate username | Use existing username in same tenant. | Server returns conflict; UI shows clear error. |
| ONB-005 | Cross-tenant username | Same username in different tenant. | Allowed only if tenant-scoped uniqueness is intended; no cross-tenant lookup leak. |
| ONB-006 | Name validation | First name 1 char, 2 chars, Hindi text, emoji, XSS. | First name min 2; unsafe text rendered inert. |
| ONB-007 | Course/stream/year | Change every select option; tamper API with invalid course, stream, year 0/7/NaN. | UI values save; API rejects invalid year and required fields. |
| ONB-008 | Section | lowercase, leading spaces, 12 chars, 13 chars. | Uppercases, trim-starts, max enforced. |
| ONB-009 | Phone optional | empty, `+919999999999`, `123`, letters, very long. | Empty accepted; regex-invalid rejected. |
| ONB-010 | Hostel toggle | Toggle hosteller on/off repeatedly. | Hostel field appears/disappears; turning off clears hostel name. |
| ONB-011 | Hosteller submit blank hostel | Toggle on, leave hostel blank. | Required validation error. |
| ONB-012 | Submit success | Complete valid payload. | `PUT /api/profile` succeeds, profile-complete cookie set, redirect to `/home`. |
| ONB-013 | Submit fail | Force API 500/timeout. | Form remains editable, pending clears, message shown. |
| ONB-014 | Double submit | Double-click `Continue to home`. | One profile write; button pending prevents duplicates. |
| ONB-015 | Responsive | Fill all fields on phone with keyboard. | No fixed action hidden by keyboard; preview/checklist not overlapping form. |

## 8. Home Feed, Stories, Posts, Comments, Realtime

| ID | Case | Steps/Data | Expected |
|---|---|---|---|
| HOME-001 | Home render | Complete student opens `/home`. | Desktop sidebar + right rail, mobile top bar + bottom nav, story lane, feed, vibes teaser. |
| HOME-002 | Empty feed | Tenant with no stories/posts/vibes/chats. | Empty states visible; no JS error. |
| HOME-003 | Story lane | Open each story, tap next/previous, pause, close, mute/unmute. | Progress and seen-state update; media maintains aspect; phone viewer full-screen. |
| HOME-004 | Story message/reaction | Send story message, like/unlike story. | API calls scoped to story; counts/UI update once. |
| HOME-005 | Add story | Click story add/create from desktop and phone. | Navigates to `/create?kind=story` or intended create flow. |
| HOME-006 | Post card media | Open image/video post, zoom compatible image, close. | Full-screen viewer works; no background scroll trap. |
| HOME-007 | Reactions | Open reaction tray, choose Like/Fire/Support/Love/Insight/Funny, change/remove reaction. | One active reaction per viewer; counts realtime sync. |
| HOME-008 | Likers sheet | Open likers. | Same-tenant likers only; anonymous authors respected. |
| HOME-009 | Comments | Open comment sheet, add comment, reply, like comment, edit/delete own comment. | Desktop side panel and phone bottom sheet work; keyboard-safe composer. |
| HOME-010 | Anonymous comments | Post with anonymous comments allowed/disabled. | UI and API enforce allowed setting. |
| HOME-011 | Save post | Toggle save from card/actions. | State persists refresh and profile saved tab. |
| HOME-012 | Repost | Direct repost and quote repost with note. | New item appears; duplicate/repost limits enforced if applicable. |
| HOME-013 | Edit own post | Edit caption/location/anonymous comment setting. | Only author can edit; sanitization and layout OK. |
| HOME-014 | Delete own post | Delete from actions. | Soft delete; removed from feed; direct URL no longer exposes content. |
| HOME-015 | Report post/comment/story | Submit reasons: blank, normal, XSS, very long. | Report creates moderation record, no duplicate spam on double-click. |
| HOME-016 | Copy/share link | Copy post/story link. | Clipboard works with permission; fallback visible if denied. |
| HOME-017 | Follow from suggestions/profile | Follow/unfollow suggested users. | Counts and buttons update; own profile cannot be followed. |
| HOME-018 | Social websocket | Two browsers same tenant: react/comment/delete. | Other active client updates through `/ws/social`; fallback refresh catches missed events. |
| HOME-019 | Cursor/pagination | Scroll long feed, refresh, back from detail. | No duplicate/missing cards; scroll restoration sane. |
| HOME-020 | Content safety | Render XSS captions/comments/locations/usernames. | No script execution; no broken layout. |
| HOME-021 | Tenant isolation | User from tenant B attempts post/comment/reaction on tenant A post via API. | 403/404; no side effect. |

## 9. Create Studio: Story, Post, Vibe

| ID | Case | Steps/Data | Expected |
|---|---|---|---|
| CREATE-001 | Route render | Open `/create` desktop/phone. | Creation Studio opens with mode select Story/Post/Vibe, close/back works. |
| CREATE-002 | Mode select | Switch Story, Post, Vibe repeatedly. | Draft state is preserved or reset intentionally; no stale invalid submit. |
| CREATE-003 | Post caption | Blank, normal, hashtags, mentions, XSS, 5,000 chars. | Validation and render safe; hashtags/mentions do not break. |
| CREATE-004 | Post location | Blank, normal, long, XSS. | Optional location safe. |
| CREATE-005 | Post image | Add/remove image, multiple images, invalid file, oversize. | Preview, remove, storage rules, publish metadata correct. |
| CREATE-006 | Post privacy | Toggle anonymous post and anonymous comments. | Backend receives intended flags; UI reflects after publish. |
| CREATE-007 | Story media | Add/remove one story asset image/video. | Preview, replace/remove, safe publish. |
| CREATE-008 | Story caption | Values matrix. | Caption saved/rendered safely. |
| CREATE-009 | Story music search | Search normal, empty, emoji, XSS, very long. | Openverse search proxied safely; no raw errors. |
| CREATE-010 | Story music stream | Track stream redirects 0-3, >3 redirects, unsupported content type, >24 MB. | Allowed streams work; blocked streams fail safely. |
| CREATE-011 | Music clip | Select 15/30/45/60 seconds, drag sticker/clip controls. | Export preview and final muxed MP4 align with selection. |
| CREATE-012 | Vibe video upload | Valid mp4/webm/quicktime below 40 MB. | Upload, processing, variant metadata, publish success. |
| CREATE-013 | Vibe oversize | >40 MB, corrupt video, unsupported MIME, renamed file. | Rejected before durable publish; no orphaned post. |
| CREATE-014 | Background publish | Start upload, navigate away, refresh, go offline/online. | Queue persists only intended task; retry and final toast accurate. |
| CREATE-015 | Storage metadata | Inspect uploaded social files. | `tenant_id`, `uploader_id`, `upload_intent`, `origin_module=social` set; path contains correct tenant/user. |
| CREATE-016 | Double publish | Double-click publish during upload. | One final post/story/vibe. |
| CREATE-017 | Mobile UX | Upload/caption/music controls on 390x844. | No overlap with bottom nav; media controls usable. |

## 10. Vibes/Reels

| ID | Case | Steps/Data | Expected |
|---|---|---|---|
| VIBE-001 | Route render | Open `/vibes`; open `/reels`. | `/reels` redirects to `/vibes`; theater/mobile immersive layout. |
| VIBE-002 | Playback | First video autoplay, tap pause/resume, hold 2x, swipe/scroll next. | Audio default behavior follows browser policy; UI state accurate. |
| VIBE-003 | Engagement | Like, react, comment, repost, share, save, report. | Same behavior as feed; counts sync realtime. |
| VIBE-004 | Empty/error | No vibes, failed fetch, media 404. | Empty/error states; no infinite blank. |
| VIBE-005 | Performance | 20+ videos; slow network. | Only needed media plays/preloads; no memory spike or multiple audio streams. |
| VIBE-006 | Security | Malicious captions/media URLs/storage paths in API payload. | Sanitized, safe path validation blocks foreign tenant/user paths. |

## 11. Search And Public/Profile Surfaces

| ID | Case | Steps/Data | Expected |
|---|---|---|---|
| SEARCH-001 | Search render | Open `/search`. | Search field, trending profiles, back to feed visible. |
| SEARCH-002 | Query values | Empty, 1 char, normal name, username, roll-like, emoji, XSS, SQL-like. | Debounce/result list correct; no query breakage. |
| SEARCH-003 | No results | Search impossible query. | Helpful empty state. |
| SEARCH-004 | Profile open | Click result avatar/name. | Navigates to `/u/[username]`, preserves back origin. |
| SEARCH-005 | Follow from result | Follow/unfollow button. | State persists; no duplicate follow. |
| PROF-001 | Own profile | Open `/dashboard`. | Posts/Vibes/Saved tabs, edit profile, settings, avatar controls. |
| PROF-002 | Other profile | Open `/u/[username]`. | Follow button, public data, no private settings. |
| PROF-003 | Profile tabs | Switch Posts/Vibes/Saved. | Correct content; empty states; phone tabs fit. |
| PROF-004 | Edit profile fields | Username, first/last, course, stream, year, section, phone, hosteller, hostel. | Same validation as onboarding; profile updates visible after refresh. |
| PROF-005 | Avatar crop | Upload valid/invalid/huge image, crop, reset, save, cancel. | Cropper accessible; saved image displays; invalid rejected. |
| PROF-006 | Social links | Add long, invalid, `javascript:`, normal URLs/emails. | Unsafe links rejected or rendered inert; no XSS/open redirect. |
| PROF-007 | Notification/privacy toggles | Toggle all settings, refresh. | Stored per user; no cross-account leak. |
| PROF-008 | Export data | Click export. | JSON download contains only current user's data, no secrets/private keys unless intentionally exported. |
| PROF-009 | Block/mute | Add/remove usernames, invalid values. | UI persists; blocked/muted behavior enforced where implemented. |
| PROF-010 | Connections sheet | Open followers/following, action menu. | Same-tenant users only; close/back work. |

## 12. Messages, Chat, E2EE, Device Security

| ID | Case | Steps/Data | Expected |
|---|---|---|---|
| CHAT-001 | Inbox render | Open `/messages` desktop/phone. | Desktop split pane; phone conversation-first flow; E2EE status visible. |
| CHAT-002 | Inbox tabs/search | Switch chat/search tabs; search by name/handle. | Existing chats and campus profiles appear correctly; clear search works. |
| CHAT-003 | Start chat | Start one-to-one chat with same tenant profile. | Conversation created once; peer summary correct. |
| CHAT-004 | Self/other tenant chat | Try self, blocked user, other-tenant user via UI/API. | Rejected without data leak. |
| CHAT-005 | Key setup | First chat open with no local identity. | ECDH keypair generated, public key published, local key stored in IndexedDB-first vault. |
| CHAT-006 | PIN backup create | Create 6-digit PIN, confirm mismatch, non-numeric, short, valid. | Invalid blocked; valid backup created with PBKDF2/AES-GCM metadata. |
| CHAT-007 | Recovery phrase | View/copy phrase, hide, reload. | Phrase reveal requires PIN; clipboard action intentional; no phrase in logs. |
| CHAT-008 | Restore new device | Clear local key, keep cloud backup, enter PIN/phrase. | Correct key restored; public key matches backend identity. |
| CHAT-009 | PIN brute force | Enter wrong PIN 5 times. | Lockout for 1 hour; phrase route still works if designed. |
| CHAT-010 | Incompatible key | Attempt to publish different public key for existing account. | Backend rejects; UI prompts restore not regenerate. |
| CHAT-011 | Text send | Send empty, normal, long, emoji, XSS, RTL, newline. | Empty blocked; ciphertext stored; decrypted render safe. |
| CHAT-012 | No plaintext persistence | Inspect API payload/backend store/logs for text message. | Backend stores ciphertext only; logs do not contain plaintext. |
| CHAT-013 | Read receipts | User A sends, User B opens. | Read status updates via API/WebSocket. |
| CHAT-014 | Typing | Type in composer, stop typing, blur tab. | Typing indicator appears/disappears, scoped to conversation. |
| CHAT-015 | Reactions | React with allowed emojis and unsupported emoji via API. | Allowed works; unsupported rejected. |
| CHAT-016 | Reply | Reply to same conversation message; tamper reply target from another conversation. | Same conversation works; cross-conversation rejected. |
| CHAT-017 | Edit | Edit own message, old message, XSS text. | Only allowed owner/window; ciphertext updated safely. |
| CHAT-018 | Delete for self | Delete incoming/outgoing for self. | Hidden only for current user; peer still sees message. |
| CHAT-019 | Delete for everyone | Sender deletes within 30 min and after 30 min. | Within window marker appears; after window rejected. |
| CHAT-020 | Star/save/TTL | Star, save, set expiry instant/1h/24h/7d/30d/90d. | Indicators persist; expired unstarred/unsaved messages hidden after janitor. |
| CHAT-021 | Attachment send | Select valid image, invalid file, >12 MB encrypted image. | Valid encrypts/uploads/sends; invalid blocked; backend receives octet-stream. |
| CHAT-022 | View-once media | Send/open/close view-once media. | Opens once per rules; cannot re-open if consumed. |
| CHAT-023 | Voice recording | Start/stop/cancel/send voice note; deny mic permission. | Permission errors friendly; no stuck recording state. |
| CHAT-024 | Share menu | Share vibe card/deal card where wired. | If unsupported, UI must not claim successful send; supported cards encrypted. |
| CHAT-025 | WebSocket auth | Tamper socket token, conversationId, tenantId, expiry. | Upgrade rejected; no messages leak. |
| CHAT-026 | WebSocket realtime | Two browsers in same chat send/read/react/type. | Active peer updates quickly; polling fallback recovers missed events. |
| CHAT-027 | Network drops | Disconnect websocket, go offline, resume online, visibility change. | Reconnect backoff and reconciliation work; no duplicate messages. |
| CHAT-028 | Account switch | Switch account while chat open. | UI blocks actions with session-switched warning; no wrong-user send/decrypt. |
| CHAT-029 | Sign-out cleanup | Sign out from main app. | Chat vault and legacy key storage cleared according to current v2 behavior. |
| CHAT-030 | Screenshot suspicion | Press PrintScreen, hide page. | Encrypted system notice generated only as designed; false positives acceptable but not spammy. |
| CHAT-031 | Phone composer | Keyboard, attachments strip, reply/edit bars, emoji/actions on 390x844. | Composer stays visible; no overlap with bottom safe area. |

## 13. Chat Privacy/Security Settings

| ID | Case | Steps/Data | Expected |
|---|---|---|---|
| CPS-001 | Route redirect | Open `/settings/security`. | Redirects to `/profile/settings/chat-privacy`. |
| CPS-002 | Main render | Open privacy page with no identity, identity/no backup, backup. | Correct status cards and primary actions. |
| CPS-003 | Create secure session | Click create identity/session. | Key identity created once; busy states correct. |
| CPS-004 | Create/change PIN | Current PIN, new PIN, confirm PIN with invalid/valid values. | Current PIN required for change; mismatches blocked. |
| CPS-005 | View phrase | Enter wrong/right PIN. | Wrong counts attempts; right reveals phrase; copy works. |
| CPS-006 | Restore | Enter PIN or 24-word phrase in restore input. | Correct restore; wrong values safe error. |
| CPS-007 | Device list | Refresh trusted devices, revoke current/other device. | Current device handling safe; revoked device cannot use pairing/backup if applicable. |
| CPS-008 | Pairing QR/code | Generate pairing, copy link, scan/load code, approve, claim. | Codes normalize, expire, cannot be claimed by attacker/other tenant. |
| CPS-009 | Mobile scanner | Camera denied/unavailable. | Error state; manual code entry remains usable. |
| CPS-010 | Secrets in storage | Inspect local/session storage after actions. | Private keys in intended vault only; temporary pairing private key removed after claim. |

## 14. Market

| ID | Case | Steps/Data | Expected |
|---|---|---|---|
| MKT-001 | Route render | Open `/market`. | Sale/Buying/Lend tabs, filters, cards, right rail, composer FAB. |
| MKT-002 | Tabs | Switch List item, Request item, Borrow/lend. | Cards, placeholders, composer mode, filters update. |
| MKT-003 | Search/filter/sort | Search item/seller/category, filter every category, sort every mode. | Results stable, no layout shift, query XSS inert. |
| MKT-004 | Composer title/category | Blank, normal, long, invalid category tamper. | Required validation; server rejects invalid/tampered values. |
| MKT-005 | Sale fields | Condition, price `0`, `1`, huge, letters, notes, meetup. | Digits sanitized; price/bounds enforced. |
| MKT-006 | Buying/lend fields | Budget, rental fee, urgency/need notes. | Optional/required behavior correct by mode. |
| MKT-007 | Media upload | Add/remove/reorder multiple images/videos, invalid/oversize. | Preview and server storage safe; no orphan media on failed submit. |
| MKT-008 | Create/edit/delete | Owner creates, edits, deletes listing/request. | Only owner allowed; list/detail updates. |
| MKT-009 | Save | Save/unsave listing/request. | Persists refresh; no duplicate save rows. |
| MKT-010 | Sold | Owner marks sold; non-owner tries via API. | Owner succeeds; non-owner 403. |
| MKT-011 | Contact | Send blank, normal, XSS, long message. | Blank blocked; message creates intended contact/chat seed safely. |
| MKT-012 | Detail/media viewer | Open details, carousel thumbs, next/previous, close. | No background scroll leak; phone full view usable. |
| MKT-013 | Resize sidebars | Drag left/right resize on desktop, refresh. | Width clamps and persists; no mobile resize handles. |
| MKT-014 | Tenant isolation | Access other tenant listing/request/media path. | 403/404; no cross-tenant media. |

## 15. Events And Event Host

| ID | Case | Steps/Data | Expected |
|---|---|---|---|
| EVT-001 | Events route | Open `/hub` events surface and `/events` redirect. | Events list renders; `/events` redirects to `/hub`. |
| EVT-002 | Scope tabs | Upcoming, Saved, Ended. | Counts and list match data; empty states work. |
| EVT-003 | Search/category | Search clubs/nights/workshops/venues; category chips. | Results update; input values safe. |
| EVT-004 | Event detail | Open detail, save, interest, share, close. | Actions persist; no duplicate interest/save. |
| EVT-005 | Register individual | Fill custom fields, notes, attachments, submit. | Required fields enforced; registration appears. |
| EVT-006 | Register team | Team name, members name/username/email/role, min/max boundaries. | Team size rules enforced; invalid emails blocked. |
| EVT-007 | Registration field types | Short, long, select, email, phone, number, required/optional. | UI type and validation match host config. |
| EVT-008 | Registration attachments | Valid/invalid/oversize attachments. | Upload and remove safe. |
| EVT-009 | Cancel registration | Registered user cancels. | Status updates; capacity frees if designed. |
| EVT-010 | Host export | Host exports registrations; non-host tries. | Host gets correct tenant/event CSV; non-host denied. |
| EVT-011 | Host route | Open `/events/host` from authenticated complete student. | Host form renders, edit mode by event query if owner. |
| HOST-001 | Basic fields | Title, club, type, category, location, startsAt, endsAt. | Required validation; end after start. |
| HOST-002 | Pass/capacity | Pass type/label, capacity blank/0/1/huge/letters. | Numeric sanitization and bounds. |
| HOST-003 | Registration mode | Interest, Register, Apply. | Relevant extra fields appear/disappear; stale values handled. |
| HOST-004 | Entry mode | Individual/team, min/max `1/2/4`, min>max. | Validation catches impossible team size. |
| HOST-005 | Custom questions | Add/remove fields, select options <2, duplicate options, required toggle. | Validation catches invalid config; order persists. |
| HOST-006 | Attachments/media | Allow attachments label, event media files. | Required label when enabled; media preview/remove works. |
| HOST-007 | Publish/edit/delete | Create event, edit event, delete event. | Owner-only; detail/list sync; soft delete excludes event. |
| HOST-008 | Mobile host form | Complete long form on phone. | No field/action overlap; live preview does not hide submit. |

## 16. Hub And Games

| ID | Case | Steps/Data | Expected |
|---|---|---|---|
| HUB-001 | Hub route | Open `/hub`, `/hub/gameshub`. | Routes to selected events/games tab based on query; nav works. |
| GAME-001 | Connect daily load | Open `/hub/gameshub/connect`. | Board loads, leaderboard preference, settings. |
| GAME-002 | Connect play | Draw route valid/invalid, reset, submit, solve, share. | Valid submit succeeds; invalid route rejected; no UI stuck state. |
| GAME-003 | Connect hint | Request hint repeatedly/cooldown/offline. | Cooldown enforced; errors clear. |
| GAME-004 | Queens daily load | Open `/hub/gameshub/queens`. | Board renders responsive; region/cell labels accessible. |
| GAME-005 | Queens play | Place/remove queens, undo, reset, submit, invite/share. | Rule feedback correct; solved state persists if intended. |
| GAME-006 | Queens hint | Request hint/cooldown/offline. | Cooldown and retry behavior safe. |
| SCR-001 | Scribble room entry | Open `/hub/gameshub/scribble`; input room code `8B2X9`, invalid/long/XSS. | Code normalized/validated; invalid safe. |
| SCR-002 | Create room | Create room, copy/share invite, join second browser. | Room code works, second player appears realtime. |
| SCR-003 | Room settings | Rounds, draw time, max players, word mode, public toggle. | Bounds enforced; only host can apply. |
| SCR-004 | Start game | Start with insufficient/enough players. | Correct guard; turn order visible. |
| SCR-005 | Drawing | Choose word, draw, colors, width slider, eraser, clear, skip. | Canvas works desktop mouse and phone touch. |
| SCR-006 | Guessing | Guess empty, wrong, close, exact, duplicate, drawer tries. | Scoring and locks correct. |
| SCR-007 | Results/share | End game, share results, open post composer. | Result modal stable; share target safe. |
| SCR-008 | Realtime security | Tamper socket token/roomId/userId. | Unauthorized connection/action rejected. |

## 17. Admin And Moderation

Tabs: Command Center, User Vault, Arena Master, Content Jail, Campus Hub, Settings.

| ID | Case | Steps/Data | Expected |
|---|---|---|---|
| ADM-001 | Access | Student/moderator/admin open `/admin`. | Only super admin allowed; others redirected/forbidden. |
| ADM-002 | Command center | Load metrics/activity. | No PII beyond intended admin scope; errors handled. |
| ADM-003 | User vault search | Search email, username, tenant, name, XSS. | Results safe; no cross-tenant accidental actions without admin authority. |
| ADM-004 | User control | Change role/status/shadow ban/suspend if present. | Action audited; UI confirms; cannot demote last super admin if applicable. |
| ADM-005 | Arena master | Daily level, difficulty min/max 5-9, hint cooldown, leaderboard toggle. | Bounds enforced; update persists. |
| ADM-006 | Content jail | Review reports/posts/comments, remove/restore. | Moderator decisions apply to feed; audit log created. |
| ADM-007 | Keywords | Add/remove keyword or regex, invalid regex, XSS. | Invalid regex rejected; keywords do not break moderation scan. |
| ADM-008 | Campus hub | Review join requests, approve/reject/send changes. | Unknown domain never auto-creates tenant; decision audited. |
| ADM-009 | Maintenance | Toggle maintenance, message text. | Public maintenance gate works; admins retain access if designed. |
| ADM-010 | Notices | Create notice title/body; long/XSS. | Notice safe and dismissible. |
| ADM-011 | Backup trigger | Trigger backup. | Audit entry; no secrets in response; disabled state prevents repeat spam. |
| ADM-012 | Admin API direct | Call `/api/admin/portal` as unauth/student/admin. | 401/403/admin success respectively. |

## 18. Resources And Academic Vault

| ID | Case | Steps/Data | Expected |
|---|---|---|---|
| RES-001 | Courses API | `GET /api/courses` unauth/auth. | Auth behavior as designed; no cross-tenant courses. |
| RES-002 | Resource list | `GET /api/resources` with tenant/limit/cursor variants. | Requires auth; tenant match; limit 1-50. |
| RES-003 | Create resource metadata | Type notes/PYQ/guide, title, course ID, description. | Required fields validated; record appears in vault. |
| RES-004 | Invalid resource input | Missing tenant, mismatched tenant, invalid limit, XSS. | 400/403; content safe. |
| RES-005 | Resource permissions | Other tenant user opens detail/download. | Denied. |
| RES-006 | Soft delete/moderation | Report/remove resource. | Removed resource hidden; audit trail preserved. |

## 19. API Security Matrix

Run this matrix against every API route listed in section 1.

| ID | Attack/Class | Steps | Expected |
|---|---|---|---|
| API-001 | Unauthenticated access | Call every protected API without cookies/bearer. | 401, no data. |
| API-002 | Wrong role | Call admin/moderator/host/owner routes as student. | 403, no side effect. |
| API-003 | Cross-tenant | Use valid session from tenant B against tenant A IDs/storage paths. | 403/404, no data leak. |
| API-004 | Object ownership | Edit/delete/sold/export another user's content. | 403/404, no side effect. |
| API-005 | Participant-only chat | Read/send/react/delete message in non-participant conversation. | 403/404. |
| API-006 | Host-only events | Export registrations/edit/delete event as non-host. | 403. |
| API-007 | Content type | Send wrong `content-type`, invalid JSON, invalid multipart boundary. | 400 safe error. |
| API-008 | Oversize payload | Very large JSON/multipart/body/file. | 413 or safe 400; server remains healthy. |
| API-009 | ID fuzzing | Empty ID, huge ID, UUID-like foreign ID, traversal, encoded slashes. | Safe 400/404; no route confusion. |
| API-010 | Limit/cursor | limit 0, -1, 51, huge, NaN; invalid cursor base64. | Validated, no unbounded query. |
| API-011 | Replay/double-click | Repeat same POST/PATCH/PUT rapidly. | Idempotent where required; duplicates controlled. |
| API-012 | CSRF | Cross-site POST to mutating APIs with cookies. | Sensitive session route blocks; other mutating APIs should have CSRF strategy or SameSite protection verified. |
| API-013 | CORS | OPTIONS and cross-origin requests. | Only allowed origins/methods; no wildcard credentials. |
| API-014 | XSS persistence | Store script payload in every user content field. | Rendered safely everywhere. |
| API-015 | SSRF | Story music URL/redirects and media proxy paths target internal IP/metadata. | Blocked by allowlist/content-type/size/redirect rules. |
| API-016 | Storage path spoofing | Submit media paths for another tenant/user. | Safe path validators reject. |
| API-017 | MIME spoofing | Upload file with allowed extension but disallowed MIME/body. | Rejected or safely handled. |
| API-018 | Header spoofing | Forge user/role/tenant headers. | Ignored; auth context from verified session only. |
| API-019 | Logging | Trigger validation and server errors with sensitive values. | No tokens, passwords, private keys, recovery phrases, plaintext chat messages in logs. |
| API-020 | Error shape | Force every expected failure. | JSON error `{ code, message, details? }` without stack/secrets. |

## 20. Storage Rules And Media Security

| ID | Case | Steps/Data | Expected |
|---|---|---|---|
| STOR-001 | Social create unauth | Upload to `social/{tenant}/{assetType}/{placement}/{user}/{file}` unauth. | Denied. |
| STOR-002 | Wrong owner | Auth UID not equal path `userId`. | Denied. |
| STOR-003 | Asset path | Invalid assetType/placement. | Denied. |
| STOR-004 | Social image size | Image <=4 MB and >4 MB. | <= allowed with metadata; > denied. |
| STOR-005 | Social video size | Video <=40 MB and >40 MB. | <= allowed with metadata; > denied. |
| STOR-006 | Required metadata | Missing/wrong tenant_id/uploader_id/upload_intent/origin_module. | Denied. |
| STOR-007 | Update/delete | Try update/delete social media object. | Denied. |
| STOR-008 | Public read | Read social object. | Allowed only if current product intends public social media; verify no private chat/event resource uses this path. |
| STOR-009 | Chat media | Download encrypted chat attachment via `/api/chats/messages/[id]/media`. | Participant-only, `application/octet-stream`, `x-content-type-options: nosniff`. |

## 21. Realtime And Database Sync

| ID | Case | Steps | Expected |
|---|---|---|---|
| SYNC-001 | Multi-tab same user | Open two tabs, edit profile/post/settings. | State reconciles; no stale destructive overwrite. |
| SYNC-002 | Two users same tenant | User A posts/comments/messages/registers; User B views. | Realtime or refresh shows updates. |
| SYNC-003 | Two tenants | Same actions across tenants. | No cross-tenant visibility. |
| SYNC-004 | Offline write | Start write then go offline. | UI rolls back or queues intentionally; no phantom success. |
| SYNC-005 | Backend down | Backend 500/timeout during write. | User sees failure; no half-published content. |
| SYNC-006 | Storage success, DB fail | Upload succeeds but metadata registration fails. | Published content not visible; orphan cleanup path/audit exists. |
| SYNC-007 | DB success, realtime fail | Durable write succeeds but socket blocked. | Refresh/polling catches state; user not told failure if durable write ok. |
| SYNC-008 | Soft delete | Delete post/comment/message/event/market/resource. | Deleted item excluded from normal queries; audit/state retained. |
| SYNC-009 | Pagination consistency | Create/delete while paginating feed/vibes/resources/events. | No duplicates, cursor still valid or safe reset. |
| SYNC-010 | Janitor | Run `pnpm chat:janitor`. | Expired chat messages and blobs cleared; starred/saved preserved. |
| SYNC-011 | Data Connect compile | Run `pnpm dc:compile`. | Schema/operations compile. |
| SYNC-012 | Typecheck/build | Run `pnpm --filter @vyb/web check`, `pnpm build`. | No TypeScript/build regressions. |

## 22. Performance, Reliability, Observability

| ID | Case | Steps | Expected |
|---|---|---|---|
| NFR-001 | First load | Cold load public, login, home, messages, market, events. | Acceptable LCP; no huge blocking bundle on public/auth. |
| NFR-002 | Long lists | 100+ posts/messages/events/market items. | Virtualization/pagination keeps UI responsive. |
| NFR-003 | Upload progress | Large valid uploads. | Progress accurate, cancel/remove works, no memory leak. |
| NFR-004 | Video memory | Scroll many vibes/stories. | Only active media plays; previous media paused/released. |
| NFR-005 | WebSocket scale | Many active clients in chat/social/scribble. | Server stable; unauthorized clients rejected cheaply. |
| NFR-006 | Auditability | Admin/moderation/sensitive actions. | Request ID, actor, action, target, result stored/logged without secrets. |
| NFR-007 | Health | `GET /health` backend. | Module health returns identity/campus/social/chat/resources/market/moderation/games. |
| NFR-008 | Recovery | Restart backend/web during active app. | UI recovers or asks refresh; no corrupt local state. |

## 23. Automation Checklist

Minimum automated coverage to add or maintain:

- Playwright public smoke: `/`, `/login` desktop + mobile.
- Playwright auth route guards using generated signed dev cookies or test auth helper.
- Playwright onboarding form validation and successful redirect.
- Playwright home navigation smoke for Home, Hub, Chats, Vibes, Market, Profile.
- Playwright create studio smoke for Story/Post/Vibe mode switching.
- Playwright messages smoke for inbox search, empty/error, and one mocked conversation.
- Playwright market/events composer validation.
- API integration tests for 401/403/400/409/413/500 shapes.
- API security tests for tenant mismatch on posts, comments, chats, market, events, resources.
- WebSocket tests for token tamper, conversation mismatch, unauthorized room, reconnect.
- Storage emulator tests for social path owner/content-type/size/metadata rules.
- Chat crypto unit tests for encrypt/decrypt, backup wrap/restore, wrong PIN lockout, incompatible key.
- Data sync tests for double-submit/idempotency and soft delete exclusion.

## 24. Manual Release Gate

Before release, QA signs off only when:

- Every route has passed desktop and phone smoke.
- Login/signup/onboarding/session guard cases pass.
- Chat E2EE cases `CHAT-001` through `CHAT-031` are either passed or explicitly deferred with product approval.
- Tenant isolation API cases pass for social, chat, market, events, resources, and admin.
- Upload/storage size, MIME, metadata, and path-spoof tests pass.
- No high severity UI overlap exists on 390x844 and 1280x720.
- No known XSS/CSRF/authz issue remains open.
- `pnpm --filter @vyb/web check`, `pnpm test:e2e`, and relevant security validation scripts pass or have documented blockers.
