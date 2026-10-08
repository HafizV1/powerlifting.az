# Mobile-only V1 redesign

The approved desktop baseline is commit `0fe19a0`. All 23 content pages retain their original inline CSS, scripts, content and URLs verbatim; each only adds the shared mobile stylesheet and script. The athlete alias page is unchanged. Original image files and all 208 athlete records are unchanged.

## Layout

Mobile overrides use the site's existing 820px responsive breakpoint. No V11 styles above 820px are replaced. The tested tablet width of 768px uses these overrides because the original responsive layout overflowed there; larger tablet and desktop views retain their existing layouts.

- Compact logo/organization header with all three federation images.
- Accessible hamburger menu with original parent links and separately expandable submenus, Escape-to-close, focus restoration and keyboard focus containment. Navigation remains visible if JavaScript is unavailable.
- Full original hero artwork with no distortion or cropping of its content. The four existing image-map links use the original artwork as readable mobile cards without altering the asset.
- Single-column competition/news/registration cards with readable spacing and touch targets, preserving section order, text, images, colors and existing destinations.
- Responsive footer, athlete filters and result controls. Wide tables retain every column in keyboard-accessible local horizontal scroll regions.

## Validation

- 115 page/viewport checks: 23 pages at 320, 375, 390, 430 and 768px. No document-level horizontal overflow; no JavaScript errors.
- Mobile menu open/close, all submenus, keyboard focus wrap and Escape behavior checked on every page at every width.
- All 208 athlete records match the original SHA-256 data baseline. All 208 name searches and result expansions passed at every width (1,040 of each), plus sport/gender filters, empty search and the alias redirect.
- Results sport/year/competition/gender/age/weight controls, records sport/gender/weight controls, standards, degree/weight tabs, department tabs and referee tabs passed at every width. Results tables scroll within their own viewport.
- All 69 full-page desktop comparisons matched exactly: 23 pages at 1024, 1440 and 1920px. Evidence is in `mobile-desktop-validation.json`. The final homepage preview was compared again after final styling adjustments.
- HTML invariance check confirmed that removing the two new shared asset imports reproduces each original HTML file exactly.
- Existing page/image/PDF links and new shared assets resolve locally; original external URLs were preserved rather than submitting forms or contacting external sites.
- Final mobile menu/overflow checks and 320px no-JavaScript navigation fallback passed.

The previous source-only screenshot report describes the pre-redesign integration. New screenshots are in `docs/previews/`, including each requested mobile width, the open menu, athlete controls and the unchanged desktop view.

## Repeatable checks

Serve the branch on port 8001 and run `python3 tests/validate_mobile.py` using Python Playwright and `/usr/bin/chromium`. For desktop comparisons, export commit `0fe19a0` to a temporary directory with `git archive` (do not create a worktree), serve that baseline on port 8003, then run `python3 tests/validate_desktop.py`. Serve only local static files; do not deploy for validation.

These changes are for review in PR #1. No merge or deployment is authorized. Mobile publication requires user approval.
