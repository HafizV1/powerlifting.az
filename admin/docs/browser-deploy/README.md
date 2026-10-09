# Browser-only staging activation

No installation or terminal is needed. Existing V2 code/UI is bundled in [worker.mjs](worker.mjs) for Cloudflare's browser editor. It contains no credentials. The repository, branches, allowed owner ID and disabled publishing are already fixed to isolated staging. Do not use this file for production.

## Only the account owner needs to do these actions

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com/) → your account → **Workers & Pages → Create application → Start with Hello World** (or **Create Worker**). Name it **powerlifting-admin-v2-staging**, click **Deploy**, then **Edit code**. Replace the default code with the entire [prepared Worker file](https://raw.githubusercontent.com/HafizV1/powerlifting.az/feature/v2-admin-panel/admin/docs/browser-deploy/worker.mjs) and click **Deploy**. If this Worker already exists, open it and use **Edit code**; do not create a second Worker. This uses only workers.dev, no production domain or DNS changes. No Git connection, build settings or terminal commands are needed.

2. In this Worker's **Settings → Variables and Secrets → Add**, select **Secret** for each of the following names, enter its value privately, and save/deploy the changes. Some dashboard versions label this **Variables → Add variable → Encrypt**. Never enter values into GitHub files or chat.

   | Name | Value from your existing App |
   | --- | --- |
   | `GITHUB_APP_ID` | App **General → App ID** |
   | `GITHUB_CLIENT_ID` | App **General → Client ID** |
   | `GITHUB_INSTALLATION_ID` | Numeric ID at the end of **Install App → Configure** URL |
   | `GITHUB_CLIENT_SECRET` | Your securely saved client secret |
   | `GITHUB_APP_PRIVATE_KEY` | Complete downloaded PEM key, including BEGIN/END lines |

   Direct GitHub key format is supported: no conversion is needed. App IDs are not confidential, but storing all five in Secret fields simplifies this setup. No separate session-secret entry is required for this browser bundle: its backend derives a separate stable signing key with HKDF-SHA256 from the encrypted client secret, using the staging origin and a session-specific context. Rotating that client secret invalidates sessions. An optional encrypted `SESSION_SECRET` of at least 32 bytes overrides this behavior. Keys/tokens/session signing secrets never enter browser source or browser storage. Missing credentials fail closed.

3. Open [GitHub App settings](https://github.com/settings/apps) → **powerlifting-v2-staging-admin → General**. Confirm **Callback URL** is exactly `https://powerlifting-admin-v2-staging.powerlifting-aze-482.workers.dev/api/auth/callback`, save if needed. Keep installation restricted to the preview repository. Open **https://powerlifting-admin-v2-staging.powerlifting-aze-482.workers.dev** and choose **GitHub ilə daxil ol** as `HafizV1`.

The first login needs your browser's GitHub approval. It cannot be completed or verified by the cloud agent without access to your session. Report only whether it succeeded, never OAuth codes, cookies, keys, tokens or raw logs. The real integration checklist is in [staging.md](../staging.md). Leave all test content as drafts and do not merge its content PR or PR #2.

## Status and maintainer notes

The bundle passes offline asset/authentication-boundary tests and GitHub PKCS1 signing tests. It is not deployed by this commit. A live URL, real OAuth and real photo/news writes remain unverified until the owner completes the dashboard actions. Cloudflare account authentication and a browser-control integration are unavailable in this workspace; GitHub access alone cannot authorize Cloudflare deployment. No anonymous hosting or public credential proxy is used as a workaround.

This is a generated distribution of the existing Worker, with embedded copies of the three existing admin assets; it does not rebuild the panel or change V1. The source entry is `admin/scripts/browser-worker-entry.mjs`. Maintainers can regenerate it in cloud tooling with `node admin/scripts/build-browser-worker.mjs`, then run `npm test --prefix admin`. Rebuild whenever backend or admin assets change. The dashboard bundle uses no external dependencies, network-loaded scripts or ASSETS binding. Its configuration ignores attempts to override the repository, branch targets, publishing or allowed user via dashboard variables. Additional administrators require a reviewed code change.
