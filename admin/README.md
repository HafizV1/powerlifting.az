# V2 — Azərbaycan Pauerliftinq Bölməsi idarəetmə paneli

This is an implemented CMS on `feature/v2-admin-panel`, not a deployed service. The approved V1 files, designs, embedded results, CNAME and all 208 athlete profiles are unchanged. No production deployment or merge is part of this work.

For the separate preview-only online environment, follow [staging setup and verification](docs/staging.md). Staging is prepared but not deployed: Cloudflare authentication and GitHub App account configuration are unavailable in this workspace.

**No local software required:** the owner can activate the existing panel through [Cloudflare's browser editor and encrypted Secret fields](docs/browser-deploy/README.md). A ready-to-paste Worker bundle is provided; no terminal, key conversion or Git integration is needed. Its server-only session-key derivation removes the need for manually generating a session secret.

For an already deployed staging Worker, [connect automated Cloudflare Builds once](docs/automatic-staging.md) instead of copying code. The prepared deployment target is staging only; existing encrypted runtime secrets are retained.

## Safe local testing

Requires Node.js 22 or newer; application/backend tests have no npm dependencies.

```sh
cd /workspace/powerlifting.az/admin
npm start
```

Open `http://127.0.0.1:8787` on the same machine and select **Yerli test rejiminə daxil ol**. This is a local-only test identity, not a production login. The server binds only to `127.0.0.1`; the test-login API requires an in-process local store and a loopback origin. It is unavailable on a deployed Worker. Do not tunnel or expose this development server publicly.

Local changes and uploaded files live in a newly created directory under `/tmp/powerlifting-admin-*`, not in the repository. The terminal prints its location. Set `LOCAL_DATA_DIR` to an existing **external** directory to reuse local test data. Paths inside the repository, including symlinks into it, are rejected. Restarting without that variable starts a clean test copy. Closing the process stops the local server.

The panel is in Azerbaijani. Try the dashboard, news editor, competition editor, protocols, albums and records. File/record tests are clearly named test fixtures and never enter committed source data. Publishing/unpublishing changes content readiness; it never bypasses review or deploys V1.

## What is implemented

- Azerbaijani mobile-friendly dashboard, section navigation, search/status/sport filters, validation, loading/error states, confirmation dialogs and previews.
- News create/edit/readiness/unpublish/delete, plain-text article paragraphs and replacement images.
- Competitions: names, date ranges, venue, description, Powerlifting/Bench Press selection, poster and readiness.
- Protocols: competition association, sport grouping, PDF/XLSX/XLS/UTF-8 CSV/DOCX replacement and download, readiness and deletion. Existing embedded V1 result rows are not edited or replaced.
- Albums: optional competition association, multi-image upload (up to 20), photo alt text/captions and removal.
- Records: all 80 original categories imported without changing their data; editing standard, athlete, value, event and existing record status. Duplicate categories and category deletion are blocked. The 208 athlete profiles are never editable.
- Record documents: uploaded/replaced documents, title/description/readiness/delete.
- Browser image optimization: JPEG/PNG/WebP → metadata-free WebP, longest edge at most 1600px, quality 0.82, transparency retained. Original V1 image files are never recompressed. Source images over 12 MB or 25 MP are rejected; accepted server image size is at most 3 MB.
- Atomic GitHub Git-tree commits for JSON + uploads + optional generated public pages, optimistic revision checking, non-force branch updates and a reusable **draft** review PR. No merge or default-branch write API exists.
- Review-only static exporter, retaining original styles/scripts and numeric result/athlete data. It generates managed news/calendar/detail pages, records, grouped protocol links and a new gallery. `index.html` and athlete pages are never generated or changed; homepage featured content remains frozen at V1.

## Architecture decision

GitHub Pages is static and cannot securely store OAuth secrets or issue server-side repository writes. A token embedded in a browser, or an unauthenticated public write proxy, is unacceptable.

A GitHub OAuth App alone generally requires user-scoped repository credentials and leaves a nontechnical administrator responsible for repository permissions. A GitHub App gives explicit installation permissions on selected repositories and one-hour server-only installation tokens. This implementation uses a GitHub App both for user sign-in and repository-scoped installation access, with a small Fetch/WebCrypto serverless backend. Installation private keys, OAuth client secrets and installation/user tokens stay on the server. The browser receives only identity claims in a signed HttpOnly cookie and a CSRF nonce.

Cloudflare Workers with static assets is the provided deployment target; low-volume administration can use its free allowance, subject to current quotas. No service, account, credential, Worker or custom domain was created. An existing suitable HTTPS serverless account is required; if none exists, an external hosting account must be configured. GitHub Pages alone cannot provide secure authentication. No paid dependency is required by the application.

The admin service is hosted at its own HTTPS origin (for example a Worker URL or, later, a separately approved admin subdomain), not at the production website's Pages origin. The UI and API share that origin: no CORS allowance or browser GitHub credentials are needed. V1 remains on GitHub Pages.

## Required GitHub App setup (not performed)

In your existing GitHub account, create a GitHub App and install it only on the repository intended for testing. Prefer the separate preview repository first, with this feature branch/data copied there. Never install it on unrelated repositories.

Repository permissions:

- **Contents: Read and write**
- **Pull requests: Read and write**
- Metadata read (GitHub's baseline permission)

No Actions, Workflows or Administration permission is needed. Disable webhooks if unused. Set the App's user-authorization callback to the admin service's exact `https://YOUR-ADMIN-ORIGIN/api/auth/callback`. Generate its client secret and private key. The implementation does not request a broad OAuth `repo` scope. Allow only administrators' immutable numeric GitHub user IDs, not mutable usernames. Find your numeric ID through GitHub's authenticated user API or account metadata; do not paste credentials into chat.

## Server configuration

`wrangler.toml` is a deployment template with no secrets. Before activation, set the following on the backend, not in browser files:

| Setting | Purpose |
| --- | --- |
| `PUBLIC_ORIGIN` | Exact HTTPS admin origin, no path; must match incoming requests |
| `ADMIN_USER_IDS` | Comma-separated numeric GitHub IDs; empty means deny everyone |
| `GITHUB_REPOSITORY` | Selected `owner/repository`; defaults to this repo in the template |
| `GITHUB_APP_ID` | GitHub App identifier |
| `GITHUB_INSTALLATION_ID` | Installation for that selected repository |
| `GITHUB_CLIENT_ID` | App user-authorization client identifier |
| `BASE_BRANCH` | Branch containing V2 data/templates, initially `feature/v2-admin-panel` |
| `DATA_BRANCH` | Dedicated branch matching `v2/content-...`, default `v2/content-drafts` |
| `ENABLE_V1_EXPORT` | `false` initially; enable `true` only after reviewing generated output |

Supply these using the hosting service's encrypted secret mechanism:

- `GITHUB_APP_PRIVATE_KEY`: **PKCS1 or PKCS8 PEM** RSA private key. GitHub's downloaded key is accepted directly; WebCrypto conversion happens on the server. Keep key files outside Git.
- `GITHUB_CLIENT_SECRET`.
- `SESSION_SECRET`: high-entropy random secret of at least 32 bytes; generate securely locally. Rotate it to invalidate all sessions.

Never commit keys, tokens or real `.env` files. Never supply secrets in chat. CLI setup later can use `wrangler secret put NAME` secure stdin/prompt. IDs/origin/branch names are non-secret configuration.

Wrangler **4.148.0** was used for a successful `deploy --dry-run` packaging check. No deployment ran. Activation requires separate user approval and authenticated access to the selected hosting account. `run_worker_first = true` ensures every admin response gets the security headers.

## Git/review/publication behavior

Initial seed files under `content/v2/` contain only existing news, three existing competitions and 80 record entries. Protocols, albums and record-document collections start empty because no such managed objects were present; no competition results or news were invented.

The backend reads the managed draft branch or its configured base, saves to **only** `v2/content-...`, and refuses the repository default branch, `main`, `master` and `gh-pages`. The live Pages branch is never updated. Same-file edits use a revision precondition, and reference updates are non-force fast-forwards; concurrent changes produce a conflict message rather than silent overwrites. File uploads use generated IDs, organized under `assets/uploads/{kind}/{item-id}/`. Unreferenced managed uploads are removed from the draft tree but remain recoverable in Git history. Original source images cannot be deleted by the panel.

**Təsdiqə göndər** opens/reuses a draft content PR targeting `BASE_BRANCH`. Initially that is the V2 feature branch, keeping even the review target away from production. An authorized reviewer handles any later merge manually; no auto-merge or deploy route exists. Protect the production branch with required reviews separately. After a reviewed content PR is merged, use a new `v2/content-...` branch for the next editing cycle, based on the new reviewed base; the backend does not reset branches or discard historical edits.

With `ENABLE_V1_EXPORT=false`, edits affect JSON/uploads only and the panel explicitly says public-page export is inactive. With `true`, affected managed public pages are generated in the **same draft commit**, preserving V11 styles and the original results dataset. This is an implemented connection, but intentionally not activated remotely yet. Existing links to historical competition detail pages are retained; deleting a calendar entry does not erase its historic HTML URL. The new gallery receives a link from associated competition detail pages when a published album exists. V1's fixed homepage is deliberately not an editable CMS surface.

Do not enable this on production until the feature PR, renderer output and hosting configuration have been reviewed. The default branch still needs a deliberate reviewed merge to affect GitHub Pages.

## Review-only export without deploying

```sh
# Export committed V2 data into an external directory, leaving V1 untouched:
node admin/scripts/export-site.mjs /tmp/powerlifting-v2-review

# Or use a local test session's state/uploads:
V2_DATA_DIR=/tmp/powerlifting-admin-YOUR-DIRECTORY \
  node admin/scripts/export-site.mjs /tmp/powerlifting-v2-review
```

Serve that directory locally for review. Output excludes CNAME; it is not deployed, and the exporter refuses any path inside the original repository. Do not publish test fixture content.

## Tests and limits

```sh
npm test --prefix admin
python3 admin/tests/browser.py
```

The browser test additionally needs Python Playwright, Pillow and system Chromium (`/usr/bin/chromium`). It starts/terminates its own loopback server with a fresh temporary data directory. It refuses non-loopback URLs. It exercises news/image optimization, editing, publish/unpublish, album uploads/metadata/removal, protocol attachment, records filters, mobile layout, deletion and logout. Automated security tests cover CSRF, signed/tampered/expired cookies, OAuth state/admin allowlist, upload signatures/types/sizes, traversal, stale revisions, GitHub branch protection and scoped JWT signing. GitHub/OAuth exchanges are mocked; actual end-to-end sign-in and remote writes require the above configuration and have not been tested with real credentials.

Content is plain text, not arbitrary administrator HTML. File validation uses type, size and signature checks; it is not malware scanning or a full PDF/Excel semantic parser. Uploaded results are downloadable protocols, not automatic spreadsheet-to-athlete-database imports. The existing numeric result/athlete database is read-only. Large media libraries can encounter GitHub/hosting quotas; this is a small-volume, repository-backed CMS, not unlimited media storage.

Sessions expire after two hours. Logout clears the browser's cookie; copied stateless session cookies remain valid until expiry. Remove a user ID from the allowlist or rotate `SESSION_SECRET` for immediate administrative revocation. There is no password or token stored in localStorage/sessionStorage, no administrator self-registration and no browser PAT field.

Not yet active: deployed HTTPS backend, real GitHub App sign-in, actual remote content writes, and reviewed activation of public-page rendering. These are setup/approval requirements, not insecure fallbacks. Production V1 is unchanged.
