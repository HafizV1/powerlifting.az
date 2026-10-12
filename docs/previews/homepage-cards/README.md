# Homepage hero cards — photography and HTML typography

Refined on `feature/homepage-card-backgrounds` / Draft PR #5. The user confirmed proceeding with the written direction because no new visual reference was attached. No production deployment is authorized.

The four cards use photographs already supplied by the owner and approved for the website's Kubok 2026 gallery. No third-party stock photos or generated photographs are introduced. Derivatives are optimized separately; gallery originals are untouched.

| Card | Composition | Approved source photograph |
|---|---|---|
| Yarışların təqvimi | Competition platform with a restrained, undated calendar-grid overlay | J38A6173.JPG |
| Nəticələr | Actual competition trophies and awards with the venue behind them | J38A6787.JPG |
| Azərbaycan Rekordları | Actual loaded competition barbell and plates | J38A6112.JPG |
| İdman dərəcələri | Athlete performing a lift; no invented certificates, badges or ranks | J38A6523.JPG |

All backgrounds use a dark navy readability overlay and restrained blue/red/green accents. Titles and descriptions are **actual HTML** with the exact user-provided Azerbaijani text. System fonts with Azerbaijani Latin support use weight 700 for titles and 550 for descriptions. Text is selectable and remains readable without background imagery.

The original gold icons and circle-arrow artwork are extracted from the approved graphic into compact decorative sprites. The chrome/spacer PNG contains no card lettering. Cards keep the original desktop strip's intrinsic dimensions and visual coordinates, original link hit areas, and approved mobile aspect ratio, spacing and rounded corners. The existing mobile stylesheet is unchanged relative to main; new CSS is scoped to `.quick` and loaded only by the homepage.

Assets are 860 × 386 WebP photo derivatives, a small calendar SVG, icon/arrow sprites and the original surrounding strip chrome. Total image bytes are 369,872 versus 495,177 for the live original graphic (about 25% smaller), with no new runtime scripts or font requests. The previous simplistic SVG and its generator are removed from this candidate.

Optional cloud-maintainer regeneration: `python scripts/build-homepage-card-assets.py` using existing Playwright and Chromium. Production consumes only static CSS and images; no build service, account setup or local software is required by the owner.

Focused checks at 320, 375, 390, 430, 768 and 1440 px: unchanged card geometry and links; exact HTML text; weights 700/550; Azerbaijani glyph support; no horizontal overflow, clipping or text/control overlap; screenshot pixels outside the card strip identical. Verification and before/after screenshots are in this directory. Existing V2 suites were not repeated.

Preview: https://hafizv1.github.io/powerlifting-v1-preview/homepage-card-review/review.html?v=3
Homepage: https://hafizv1.github.io/powerlifting-v1-preview/homepage-card-review/index.html?v=3

No admin, gallery, athlete, result, protocol or content-collection changes are included. Existing PRs and earlier preview directories remain untouched.
