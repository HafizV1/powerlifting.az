# Automatic deployment of the existing staging Worker

This connects **only** `powerlifting-admin-v2-staging` to the V2 feature branch. It does not deploy production, merge PRs, alter DNS, publish public pages or grant the staging GitHub App access to the original repository. Cloudflare's separate Git integration reads code from the original repository; the runtime App remains restricted to the preview repository.

Cloudflare account authorization is unavailable in the agent workspace. The owner must connect the existing Worker through its browser dashboard once; no local software, API token in chat, extra account or copied Worker code is required. A GitHub repository token cannot authorize access to Cloudflare.

## One-time owner action

Open [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages → powerlifting-admin-v2-staging → Settings → Builds → Connect** (Git repository). Authorize Cloudflare's GitHub integration for **HafizV1/powerlifting.az only**, then use these prepared settings:

| Field | Value |
| --- | --- |
| Repository | `HafizV1/powerlifting.az` |
| Production branch (for this staging Worker only) | `feature/v2-admin-panel` |
| Root directory | `admin` |
| Build command | `npm run build` |
| Deploy command | `npm run deploy` |
| Build variable `NODE_VERSION` (if needed) | `22` |
| Non-production branch builds | Disabled |

Save and trigger the first build (**Deploy/Retry build** if it does not start automatically). Keep the five existing **runtime** encrypted App values on the Worker; do not copy them into build variables or GitHub. Cloudflare Builds provides its own deployment authorization; no new Cloudflare API token is requested in chat. Do not use default commands that deploy `wrangler.toml` without the browser configuration: the staging browser entry preserves the existing five-secret session setup and includes its assets.

The connected dashboard uses root `/admin`, build `npm run build` and deploy `npm run deploy`. Those aliases call the explicit staging scripts; they never select the original `wrangler.toml`. The `build:staging` and `deploy:staging` names remain available for maintainers.

After deploying, the deploy script runs read-only live smoke checks from Cloudflare Builds: exact homepage/JS/CSS contents and build fingerprint, unauthenticated session/content denial, real App identity verification and a secure GitHub authorization redirect. It prints `STAGING_SMOKE_OK` only if all pass; it logs no cookies, tokens or response bodies. It does not complete the owner's GitHub authorization, test authenticated CRUD or write content. A failed smoke check fails the build **after** deployment; it does not automatically roll back. `npm run deploy -- --dry-run` packages without live smoke requests. Other arguments are rejected to prevent changing the staging target.

Subsequent pushes to the feature branch rebuild and test in Cloudflare, then update only the staging Worker. Other branches must not trigger deployment. The deploy configuration has the same staging name in the default and staging environments and no custom domain or routes. The original repository's GitHub Pages main and the runtime App's preview main are not deployment targets. No Actions workflow, auto-merge or production hook is added.

If the dashboard does not offer Git connection for this existing Worker/account, stop and report that exact UI limitation. Do not create a second Worker, change production settings, or expand App permissions as a workaround.

## Verifying the actual deployed code and OAuth issue

- `/api/health` identifies the module with a deterministic source hash. Every regular response includes `X-Admin-Build`. Compare this with the bundled build fingerprint in the committed Worker to prove which code is active; a 404 at this path means this exact module was not reached, rather than proving an OAuth fault.
- `/api/auth/check` performs authenticated App identity verification on Cloudflare, returning only safe status flags and expected callback. It does **not** inspect the registered callback settings or authenticate the owner.
- The actual browser request chain remains the required evidence: staging `/api/auth/github` status and `Location`, GitHub authorization status, and the hostname/path where 404 occurs. Share only hostname/path, public Client ID/redirect URI if necessary and the safe check response. Never share a full HAR, cookies, OAuth code/state, tokens or raw request logs.

Current evidence: the cloud workspace cannot reach staging because its network proxy rejects CONNECT with HTTP 403 (no upstream response is received). GitHub's available token reports only the Codex connector installation, not the staging App. Consequently the actual hosted 404 source, installed App configuration, registered callback and full login have **not been verified**. OAuth logic is not being changed again without that evidence. The build fingerprint is diagnostic instrumentation, not a claimed fix.

## Latest account-access check

The owner connected Workers Builds and reports that the panel and GitHub login work. The safe push `d4b7ce4` triggered a successful automatic deployment. Commit `fcc574f` then triggered a successful deployment including the read-only smoke checks described above (Cloudflare build `30f0c82c-f761-4a25-8b13-e0a61dac4615`, Worker version `0cc88eec-5b60-4074-af9f-4197f8ce9cc4`). GitHub's Cloudflare check confirms both builds succeeded. Direct Cloudflare credentials/browser access remain unavailable in the agent workspace; no account action or API token is needed for subsequent feature-branch pushes.

The two npm commands above build/test and target only the named staging Worker, without uploading/removing secrets. The successful Cloudflare deployment command includes the live checks, proving the expected build/assets are serving, App identity is verified and login redirects securely. The tests do not complete an authenticated user session or test real photo/news writes; those remain separate administrator acceptance tests. Production main and all original V1 files remain unchanged. Do not treat a manual deploy or a passing dry-run alone as proof of automatic deployment.
