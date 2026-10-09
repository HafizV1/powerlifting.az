# Secure online staging — preparation and account handoff

**Current owner workflow:** [browser-only Cloudflare activation](browser-deploy/README.md). No installation, terminal or private-key conversion is required. The terminal instructions below are optional reference; the prepared Worker file already contains the required staging configuration.

For the already deployed Worker, prefer [one-time automatic Cloudflare Builds connection](automatic-staging.md). It uses the existing runtime secrets and removes manual Worker-code copying.

Status checked on **9 October 2026**: not deployed; no working staging URL exists yet. The owner confirms Workers availability and GitHub App installation restricted to the preview repository. Wrangler remains unauthenticated in this workspace, and App credentials are securely held by the owner. Account resources and real integration cannot yet be inspected here. GitHub write access was used to create both isolated branches; preview main is unchanged at `69f5b97c215202060365e5a8ebac932ccbb63385`.

The configured URL is `https://powerlifting-admin-v2-staging.powerlifting-aze-482.workers.dev`. It is **not yet deployed or verified accessible**. No domain routes, custom domains, DNS records, production branch changes or paid subscriptions are needed by this configuration.

## Short handoff for the existing installed App

The App is `powerlifting-v2-staging-admin`. Public App metadata and the installation ID could not be retrieved with the available GitHub token; the owner must read these non-secret identifiers from its settings. No new App is needed.

1. On your trusted computer, check out the latest `feature/v2-admin-panel`. In [GitHub Apps settings](https://github.com/settings/apps), click **powerlifting-v2-staging-admin → General**. Set **Callback URL** to `https://powerlifting-admin-v2-staging.powerlifting-aze-482.workers.dev/api/auth/callback`. Note **App ID** and **Client ID**. Click **Install App → Configure** for the existing installation; note the numeric ID at the end of the installation URL. Keep access restricted to the preview repository.
2. In your private terminal run:

   ```sh
   cd powerlifting.az/admin
   npx --yes wrangler@4.148.0 login
   # In the opened browser, sign into the existing Cloudflare account and click Allow.
   python3 scripts/configure-staging.py
   ```

   Enter the three IDs, client secret and **path** to your downloaded private key only in the terminal prompts. IDs, secret and path prompts are hidden. The helper converts the key in memory, generates a session secret, uploads encrypted secrets via stdin and deploys only `--env staging`. It creates no credential files and prints no captured tool output. Keep the key outside Git; do not run in a recorded/shared terminal. If multiple Cloudflare accounts exist, provide the account ID from **Cloudflare account overview** when prompted. You need Node 22+, Python 3.11+ and OpenSSL. It first creates the named Worker with login unavailable, then uploads secrets and redeploys. Rerunning rotates the session secret and logs out existing sessions. Do not rerun merely to update code; use the explicit staging deployment command instead.
3. Open the configured URL, sign in as `HafizV1` and complete the integration checklist below. Real OAuth and uploads are still unverified until this succeeds. If setup stops, do not paste secrets or raw logs into chat; report only which step failed. No auto-deploy connection, production route or merge is needed.

Both `v2/staging-base` and `v2/content-staging` now point to `ab383fd60daa284c1c39d64b56f4dbbbd403df80`, a commit containing only the six approved V2 JSON seeds on top of preview main. The backend still creates only draft review PRs targeting `v2/staging-base`; none has been created from test edits yet. The longer instructions below are reference for manual setup, not steps to repeat for the existing App/branches.

## Prepared safeguards

`admin/wrangler.toml` has an explicit `staging` environment. Always pass **`--env staging`** to deployment and secret commands. It uses only `HafizV1/powerlifting-v1-preview`, review target `v2/staging-base`, edit branch `v2/content-staging` and `ENABLE_V1_EXPORT=false`. The server rejects a staging configuration that targets the original repository, changes the review target or enables public-page rendering, before making a GitHub API request. The existing non-default branch guard remains in force.

The App must be installed on **only the preview repository**. Its repository-scoped installation token requests only Contents write and Pull requests write (plus GitHub's implicit Metadata read). There is no merge endpoint, default-branch write endpoint or GitHub Actions workflow added by this work. Do not enable auto-merge, connect Cloudflare automatic Git builds, or add a Worker custom domain/route. Uploaded images in a public GitHub repository can be read publicly: use harmless staging test photos only, never confidential files.

## Numbered account setup

Stop when an account requires authorization you cannot provide. These steps are for the account owner; never send credentials, private keys, OAuth codes or tokens in chat.

1. **Check Cloudflare hosting access.** Open [Cloudflare Dashboard](https://dash.cloudflare.com/), sign in with your existing account and choose the account. Click **Workers & Pages**. Confirm Workers are available and check the account's **workers.dev subdomain** in the overview/settings. Record the non-secret subdomain and Account ID from the account overview. Do not open the `powerlifting.az` zone's DNS settings. If Workers are unavailable or Cloudflare asks for a paid plan, stop; the account must be assessed before proceeding. On your own trusted terminal, from `admin/`, run `npx --yes wrangler@4.148.0 login`; in the browser review and approve Cloudflare authorization. This logs in that terminal only, not this remote workspace. Do not paste its credentials here.

2. **Prepare the isolated content base with existing GitHub access.** In the preview repository, create `v2/staging-base` from its existing `main` and copy the six tracked `content/v2/*.json` files from the V2 feature branch into it. Do not change preview `main` or copy CNAME. A maintainer can do this with a temporary Git checkout:

   ```sh
   # Run outside the production checkout, on a trusted machine with GitHub access.
   gh repo clone HafizV1/powerlifting-v1-preview /tmp/powerlifting-admin-staging-seed
   cd /tmp/powerlifting-admin-staging-seed
   git switch -c v2/staging-base origin/main
   mkdir -p content/v2
   # Copy all six content/v2/*.json files from feature/v2-admin-panel here.
   git add content/v2
   git commit -m "Seed approved V2 content for isolated staging"
   git push origin HEAD:refs/heads/v2/staging-base
   ```

   If the branch already exists, inspect it before modifying it; never force-push. Keep Pages configured on the preview's existing branch. Since public rendering is disabled, the backend needs only these JSON files plus the preview's existing V1 assets for initial editing tests.

3. **Create the staging GitHub App.** Open [GitHub → Settings → Developer settings → GitHub Apps](https://github.com/settings/apps), click **New GitHub App**. Use an available name such as `powerlifting-v2-staging-admin`; use the preview repository URL as **Homepage URL**. Set **Callback URL** to `https://powerlifting-admin-v2-staging.<YOUR-WORKERS-SUBDOMAIN>.workers.dev/api/auth/callback`. Leave device flow disabled. Uncheck **Active** under Webhook. Under **Repository permissions**, set **Contents → Read and write**, **Pull requests → Read and write**; leave all other configurable repository, organization and account permissions at **No access**. Metadata read is automatic. Choose **Only on this account**, then click **Create GitHub App**. Record the non-secret App ID and Client ID. Do not grant Actions, Workflows or Administration access.

4. **Install and generate server credentials.** In the App settings sidebar, click **Install App → Install** for your account, choose **Only select repositories**, select **powerlifting-v1-preview only**, then click **Install**. The installation URL ends with its numeric installation ID; record that non-secret ID. Return to the App's **General** page, click **Generate a new client secret** and save it in your password manager. Under **Private keys**, click **Generate a private key** and keep the downloaded file outside any Git checkout. Convert GitHub's key to PKCS8 on your trusted machine:

   ```sh
   openssl pkcs8 -topk8 -nocrypt -in /PRIVATE/PATH/app-key.pem -out /PRIVATE/PATH/app-key-pkcs8.pem
   ```

5. **Set non-secret staging configuration.** In `[env.staging.vars]`, add `PUBLIC_ORIGIN` with the exact HTTPS Worker origin, `GITHUB_APP_ID`, `GITHUB_INSTALLATION_ID`, `GITHUB_CLIENT_ID` and `ADMIN_USER_IDS`. The verified numeric ID for `HafizV1` is `335450583`; add other approved administrators by numeric ID only. Keep the prepared repository, branches, staging flag and export flag unchanged. Set `CLOUDFLARE_ACCOUNT_ID` in your terminal if you have multiple Cloudflare accounts. Do not put secrets in TOML or browser files.

6. **Upload secrets and publish only the staging Worker.** From `admin/`, on the Cloudflare-authorized terminal, use secure prompts/stdin:

   ```sh
   npx --yes wrangler@4.148.0 secret put GITHUB_APP_PRIVATE_KEY --env staging < /PRIVATE/PATH/app-key-pkcs8.pem
   npx --yes wrangler@4.148.0 secret put GITHUB_CLIENT_SECRET --env staging
   # Paste the client secret only into Wrangler's hidden prompt.
   # Pipe a random secret without printing it or putting it in shell history:
   openssl rand -base64 48 | npx --yes wrangler@4.148.0 secret put SESSION_SECRET --env staging
   npx --yes wrangler@4.148.0 deploy --env staging
   ```

   If Wrangler asks to create the named Worker when uploading its first secret, create only `powerlifting-admin-v2-staging`. No production deployment is authorized. Alternatively use **Workers & Pages → powerlifting-admin-v2-staging → Settings → Variables and Secrets → Add** and select **Secret** for each of the three secrets, never **Text**. Do not enable request/body logging or log tokens. Remove temporary key copies after safe storage. Open the URL printed by Wrangler and confirm it exactly matches `PUBLIC_ORIGIN` and the GitHub callback. Do not use temporary anonymous Worker accounts as a credential workaround.

7. **Verify real workflows (still pending).** Follow the checklist below in a normal browser. Keep any fixture titled `STAGING TEST — ...` in draft status; use harmless photos. Report only the URL and pass/fail observations, never cookies or authorization codes. If any credential/permission error occurs, stop and fix the configuration securely; do not broaden App permissions beyond the two required permissions.

## Required real integration checklist

- Open the HTTPS staging URL. Confirm no local-test login is offered; unauthenticated `/api/content` is denied. Complete **GitHub ilə daxil ol** as the allowlisted administrator. Confirm an unapproved GitHub account cannot enter. Verify the session cookie is Secure, HttpOnly and SameSite=Strict.
- Create a draft news item, edit it and reload. Upload a harmless photo; verify the optimized image is visible after reload. Create an album and upload two images; edit metadata and remove one image. Check mobile navigation and form validation.
- Inspect preview Git history: writes go only to `v2/content-staging`; files are under `content/v2/` and `assets/uploads/`. Verify no public HTML, athlete data or original images changed. Keep all staging test items unpublished.
- Click **Təsdiqə göndər**. Confirm a **draft** PR exists in `HafizV1/powerlifting-v1-preview`, with base **v2/staging-base**, no auto-merge and no public deployment. Do not merge it. Check the original repository's main SHA and production website are unchanged.
- Log out and verify protected APIs deny access. Remove the test fixtures through the panel (Git history retains them) and record test outcomes. Do not treat local/mocked tests as evidence of these real workflows.

## Validation performed without account access

The staging packaging dry-run and staging-policy automated tests can be run without authentication. Automated backend/GitHub tests use mocks; browser workflows use loopback temporary storage. They cannot prove Cloudflare hosting, real OAuth or remote photo/content commits. No staging URL, real administrator login, real upload or real content PR has been verified yet.
