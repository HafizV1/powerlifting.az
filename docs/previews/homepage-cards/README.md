# Homepage card backgrounds — review candidate

Only the four homepage card backgrounds change. The original Azerbaijani lettering, icons and arrows are carried from the approved image rather than redrawn with a replacement font. The original bitmap is embedded byte-for-byte in a self-contained SVG; the background shapes and foreground clipping are maintained by `scripts/generate-homepage-card-artwork.py` (Python standard library only).

- **Yarışların təqvimi:** competition platform, rack and a knurled barbell.
- **Nəticələr:** restrained metal medals and national-colour ribbons.
- **Azərbaycan Rekordları:** stacked competition plates and a machined sleeve.
- **İdman dərəcələri:** engraved barbell medallion and progression marks.

All four use dark navy, muted metal tones, restrained gold and a left-to-right readability veil. No stock imagery, generated photography, extra runtime scripts, fonts or image services are required. The same SVG is cached and reused by the desktop strip and all four mobile crops. Gzipped SVG is approximately 503 KB versus 495 KB for the original PNG; the modest overhead preserves the approved lettering without a new font dependency. Production hosting should serve SVG with standard gzip/Brotli compression.

Runtime changes: the image URL in `index.html` and its mobile background URL in `assets/css/mobile.css`. Intrinsic dimensions remain 1774 × 232; existing mobile crop percentages remain untouched. Original image remains available for rollback. No admin, gallery, content JSON, athlete or results files change.

Focused comparison at widths 320, 375, 390, 430, 768 and 1440: geometry and links unchanged, no horizontal overflow, and all screenshot pixels outside the card strip identical. The original embedded bitmap and all other homepage/CSS source text are verified unchanged. See verification.json and the before/after screenshots. No completed V2 suites repeated.

Preview: https://hafizv1.github.io/powerlifting-v1-preview/homepage-card-review/review.html
Candidate homepage: https://hafizv1.github.io/powerlifting-v1-preview/homepage-card-review/index.html

This candidate is for review only. No merge or production deployment is authorized.
