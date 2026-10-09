# Authenticated staging acceptance test

The complete browser/API/GitHub test is available at:

**https://powerlifting-admin-v2-staging.powerlifting-aze-482.workers.dev/e2e.html**

The account owner opens it while signed into staging and clicks **Sınaqları başlat**. If the session expired, complete the existing GitHub login first and return to this page. No software, terminal, copied code, keys or cookies are required. Keep the tab open until completion. This is necessary because the agent has neither an authenticated administrator browser session nor access to the encrypted runtime secrets; it does not impersonate a user or expose a public mutation endpoint.

## What it actually tests

The runner opens the existing admin interface in a same-origin iframe and operates its actual controls, forms, browser image optimizer and upload handlers. It checks backend persistence by re-reading the real APIs:

- Draft news creation, edits, escaped preview text, 3200×1600 PNG → 1600×800 WebP, image replacement, ready/unready status without public-page rendering.
- Rejection of empty news, stale revisions and SVG uploads without changing Git state.
- Competition creation/editing, both sports and poster upload.
- Competition-linked Powerlifting PDF and Bench Press XLSX protocols, exact downloadable bytes. Fixtures are valid files containing only `STAGING TEST`, not athlete results.
- Two-photo album creation, caption/alt editing and photo removal.
- Editing and restoring one record category, retaining all 80 original entries.
- Record-document CSV upload, edit and PDF replacement/download.
- Actual draft PR creation in the preview repository through the UI, never merging.
- Unchanged ordinary staging draft revision/collections; server verifies that the test PR changes only managed JSON/uploads, protecting all original public files and athletes.

The readiness flags exercised on the disposable branch never enable the renderer or deploy public pages.

## Isolation and cleanup

Each run uses a random UUID and only `v2/content-e2e-<UUID>` in `HafizV1/powerlifting-v1-preview`, based on `v2/staging-base`. The normal `v2/content-staging` branch is untouched. Test scope is accepted only after existing administrator authentication, origin and CSRF checks, and only with the fixed preview repository/base and disabled publishing. There is no local-test login or secret input added to deployed authentication.

On success or failure, the browser calls authenticated cleanup. The server checks the diff allowlist and exact PR head/base/repository/draft status, closes the test PR with a credential-free PASS/FAIL summary, and deletes only that run's branch. Fixtures remain in the **closed PR/Git history** for review, but not in active staging content. Production is never touched. No user-authenticated cleanup route can target `main`, PR #2, other repos or ordinary content branches.

If the browser is interrupted, reopen the same tab and use **Yarımçıq sınağı təmizlə**. If the tab/session storage was lost, the agent can recover the UUID from `v2/content-e2e-...` refs/PRs and remove the isolated run with its existing preview-repository access. A failed diff guard deliberately retains the branch for investigation. Do not force-delete unknown branches or remove real draft content.

The closed PR is the report artifact; the agent can inspect it through existing GitHub access. Only fixed test-step names and PASS/FAIL are stored, never keys, cookies, tokens, raw API responses or administrator credentials.

## Verification completed in cloud tooling

- 27 Node backend/security/GitHub/renderer/preservation tests pass, including authenticated disposable-branch writes, draft creation, diff checks, cleanup, and forbidden scope/report rejection.
- The one-click runner passes all **13 workflow steps** against the actual browser UI/backend with a controlled GitHub API mock, including branch/PR cleanup and unchanged ordinary staging/main state. This does not prove real repository writes.
- The original browser suite still passes, including search/filters, photo workflows, downloads, deletion/logout, and mobile widths 320/375/390/430/768px; no JavaScript errors.
- Original V1 hashes and 208 profiles remain intact.

The **real authenticated run is pending** until the owner authorizes it through the existing session. Deployment smoke tests prove live assets and unauthenticated protections; they cannot replace this acceptance run. Any live failures will be investigated and rerun before declaring those features fully working.

Maintainer checks (cloud tooling only): `npm test --prefix admin`, `python3 admin/tests/browser.py`, `python3 admin/tests/e2e-browser.py`. The latter uses loopback HTTPS, temporary test keys and a controlled GitHub mock; its test login/server are never included in the deployed bundle.
