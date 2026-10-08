# V2 validation — 2026-10-08

Validated on `feature/v2-admin-panel`, without merging or deploying.

- `npm test --prefix admin`: 16 tests passed, zero failures. Covers authentication, OAuth state and administrator allowlist, CSRF, upload validation, revision conflicts, scoped GitHub App signing, atomic draft commits, protected-branch guards, public renderer escaping and V1 preservation.
- `python3 admin/tests/browser.py`: all workflow groups passed; no JavaScript errors. Exercises news creation/editing/preview/publish/unpublish/deletion, image optimization to 1600×800 WebP, bulk album uploads and photo metadata/removal, PDF protocol attachment, competition editing, record search/filters/editing, and logout. All fixtures remain in temporary local storage.
- Mobile checks at 320, 375, 390, 430 and 768 pixels: all seven sections and the editor fit the viewport without page horizontal overflow. Form controls have accessible labels.
- Wrangler 4.148.0 `deploy --dry-run`: Worker and static assets packaged successfully. This command did not deploy anything.
- Every original tracked V1 file matches the deployed main baseline `e54f21ef3f7ad2005724f690d33e80c7bf6d5b6a` by SHA-256, including all 208 athlete profiles. All 80 imported record entries match the original dataset. No existing public file or production configuration changed.

GitHub API and OAuth tests use controlled mocks, including actual cryptographic JWT signing. Real GitHub App sign-in, remote repository writes and hosted sessions still require the configuration in [the setup guide](../README.md) and have not been verified against a real installation. Public-page generation is implemented and tested, but disabled by default pending review.

Screenshots show the locally running panel with existing seed content, without synthetic articles or results:

- [Desktop dashboard](previews/dashboard-desktop.png)
- [Mobile dashboard](previews/dashboard-mobile.png)
- [Mobile news editor](previews/news-editor-mobile.png)
