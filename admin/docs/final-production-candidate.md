# Final production integration candidate

The preview uses the current live V1 commit `e54f21ef3f7ad2005724f690d33e80c7bf6d5b6a` and the V2 code on Draft PR #2. No original website file is changed by the proposed integration: all changes are additions under `admin/` and `content/v2/`. The current six managed collections match the approved seeds; no new news, competitions, results or athlete profiles are invented for the preview.

- [Candidate review and manifest](https://hafizv1.github.io/powerlifting-v1-preview/v2-production-candidate/review.html)
- [Complete candidate website](https://hafizv1.github.io/powerlifting-v1-preview/v2-production-candidate/index.html)
- [Secure isolated admin / protocol import](https://powerlifting-admin-v2-staging.powerlifting-aze-482.workers.dev)

The preview website is a byte-for-byte snapshot of the public V1 files, including the desktop/mobile design, 208 athlete profiles, 351 result-table rows, athlete historical entries, images and PDFs. CNAME is omitted. The added review page is outside the website's existing navigation. The admin link deliberately opens the authenticated staging Worker; GitHub Pages does not provide a backend and no static authentication mock is substituted.

The production integration candidate adds the already-tested content-management and protocol-import code, six seed collections, review-only release preparation and hash-checked rollback safeguards. Public-page publishing remains disabled. The existing staging Worker is not reconfigured to access the production repository.

`integration-manifest.json` pins live/code/content Git SHAs, every preview file hash, the exact proposed code additions, unchanged profile/result counts and the original rollback source commit. Since no public page changes are proposed, no public-page restore is necessary. Future approved content releases retain the existing per-page backups and manifest/current/backup hash checks. No production merge, publishing or rollback operation is performed.

Cloud maintainer command: `node admin/scripts/prepare-production-candidate.mjs LIVE_SHA CODE_SHA CONTENT_SHA`. It checks the actual live main and staging-content refs, verifies that all six managed collection blobs equal the approved seed, reads V1 files from the pinned live commit, rejects public-site changes in the code diff, and writes an external `/tmp` artifact. It never pushes or deploys. Hosting its snapshot in the existing preview repository is a separate explicit preview-only step.

No completed test suite needs repeating for this artifact. Candidate-specific checks cover source/content SHA freshness, copied file hashes, exact V1 preservation, 208 profiles/351 results, no CNAME, preview-folder isolation and GitHub Pages deployment.

No owner decision is needed to review this preview. Production activation is intentionally pending explicit approval and separate least-privilege production GitHub App authorization; the existing staging App is restricted to the preview repository. The new import/release controls' full live administrator-session acceptance remains outstanding as documented previously. Scanned PDFs still require OCR and unfamiliar layouts require mapping/correction.
