# Production activation — owner authorization only

The user authorized V2 production activation on 2026-10-09. Public V1 pages, design, all original 208 athletes and historical results remain unchanged. Production administration uses a separate Worker and separate GitHub App; staging retains its preview-only App and repository lock.

Production admin URL (only working after the authorization below):
`https://powerlifting-admin-v2-production.powerlifting-aze-482.workers.dev`

The available Codex GitHub connection cannot create/configure GitHub Apps (403 for repository administration), and this execution environment has no Cloudflare API token, account login or Cloudflare connector. These steps require the account owner. No local software or terminal is needed. Never send any secret to ChatGPT/Codex.

## 1. Authorize the production GitHub App

Open [GitHub → New GitHub App](https://github.com/settings/apps/new).

- Name: **powerlifting-v2-production-admin**.
- Homepage: **https://powerlifting-admin-v2-production.powerlifting-aze-482.workers.dev**.
- Callback: **https://powerlifting-admin-v2-production.powerlifting-aze-482.workers.dev/api/auth/callback**.
- Webhook: disable **Active**. Leave OAuth-during-installation unchecked; login occurs after the Worker is configured.
- Repository permissions: **Contents → Read and write**, **Pull requests → Read and write**. **Metadata → Read-only** is automatic. No other repository/account/organization permissions and no event subscriptions.
- Set installation scope to **Only on this account**, create the App, then **Install App → HafizV1 → Only select repositories → powerlifting.az → Install**.
- In the App settings, generate a **Client secret** and **Private key**. Keep the generated values/key securely. The numeric **App ID** is also on that page.

Client ID and installation ID are discovered securely by the backend; no manual copying of those IDs is required. The staging App must remain restricted to powerlifting-v1-preview.

## 2. Authorize the separate Cloudflare Worker

Open [Cloudflare → Workers & Pages](https://dash.cloudflare.com/4826254f274c34291b9926a3711d07b9/workers-and-pages).

Choose **Create application → Import a repository** (Workers), select existing **HafizV1/powerlifting.az**, and set:

| Field | Exact value |
|---|---|
| Worker name | `powerlifting-admin-v2-production` |
| Production branch | `main` |
| Root directory | `/admin` |
| Build command | `npm run build:production` |
| Deploy command | `npm run deploy:production` |
| Preview builds | Disabled |

Connect/deploy. In **powerlifting-admin-v2-production → Settings → Variables and Secrets → Add**, choose **Secret** for each of these **three** names:

- `GITHUB_APP_ID`: the production App's numeric App ID.
- `GITHUB_CLIENT_SECRET`: the newly generated production client secret.
- `GITHUB_APP_PRIVATE_KEY`: the complete downloaded production private-key PEM.

Save/deploy the secret changes. Do not edit powerlifting-admin-v2-staging, its secrets, production DNS or the website's custom domain. No Cloudflare routing to powerlifting.az is required.

Open the production admin URL and authorize GitHub login. That browser authorization is the only way to verify the real account login; an automated GitHub/App check is not a substitute for user OAuth.

## Active publishing workflow

The production backend only edits `v2/content-production`, never main directly. News/competitions/documents/albums and imported results are prepared using the already-tested adapters. **Sayt dəyişikliklərini yoxlamaya hazırla** produces a draft `v2/release-production-...` PR targeting **main** with the exact public changes, referenced uploads, manifest and original-page backups. Review/approve the changes in GitHub and merge manually to publish through existing GitHub Pages. Readiness alone does not publish, imports cannot replace historical results, and possible records still require review. There is no automatic merge or bypass of GitHub review.

After a later approved release, preserve the manifest/source commit and use the existing hash-checked `prepareRollback` to prepare a reviewed restore. Never overwrite later changes blindly.

## Verification

Only new production boundary tests are added: fixed scope/origin, wrong-repository denial, production PR target/backups, draft-only writes, canonical App OAuth, server-side installation discovery and session isolation. The previously passed 47 tests/browser suites need no manual rerun. Initial deployment can succeed without secrets but remains fail-closed; deployment success alone is not successful login or publishing.
