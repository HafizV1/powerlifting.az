# Approved V1 preparation

Prepared on `chore/prepare-approved-v1`; no commit, push or deployment. Uploaded HTML and PDF files are the source of truth. The unavailable ZIP was not used.

## Changes

Integrated 24 supplied HTML pages and the original Azerbaijani IPF rules PDF. Extracted embedded images into shared SHA-256-named assets without recompression. CSS, scripts and athlete records are preserved. Two trailing spaces in homepage CSS were removed. Restored `cempionat-2026.jpg`, `kubok-2026.png` and `kubok-2025.jpg` from the identical image bytes embedded in the approved competition page, retaining existing links.

Homepage: 9,143,491 bytes → 17,289 bytes. Combined HTML: 138,285,686 → 642,062 bytes (99.54% reduction). Image files are retained separately and cached across pages; these percentages describe HTML, not total first-load network traffic.

## Validation

- All 23 supplied content pages matched original full-page Chromium screenshots at 1440px and 390px after image decoding. The athlete redirect is tested separately. See `visual-validation.json`.
- All 208 athlete records match the original data exactly. All name searches, gender/sport filters, results expansion, empty search, redirect, department tabs, degree filters and refereeing tab clicks passed.
- Results: 38 filter states; records: 32; standards: 4. Rendered output matched original pages in every tested state.
- No JavaScript errors in tested interactions. Extracted images load successfully.
- Existing championship and cup poster URLs restored from approved embedded bytes.
- `git diff --check` passes.

## Link audit

All 38 referenced local page, image and PDF targets resolve with HTTP 200 and exact file bytes. No missing local resources remain. Original document labels and controls without handlers are preserved as supplied; their presence does not imply additional functionality.

## Local development and repeatable smoke test

Serve with:

```sh
python3 -m http.server 8001 --directory /workspace/powerlifting.az
```

With Python Playwright and `/usr/bin/chromium` available, run in another terminal:

```sh
cd /workspace/powerlifting.az
python3 tests/validate_v1.py
```

The source-based screenshot comparisons were run during integration against unmodified uploaded copies outside the repository. The saved smoke test checks the original athlete-data digest and essential interactions without needing those copies. Static hosting needs no build or runtime dependencies. The `CNAME` file is retained; no GitHub Pages deployment was enabled or triggered.
