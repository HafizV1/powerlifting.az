# Son xəbərlər — contained responsive layout

The previous float and overlapping padding overrides left the news headline, metadata, paragraph and link flush against the card border, with an excessively wide text line after the image. A dedicated homepage-only wrapper now uses an auto-sized image column and `minmax(0,1fr)` text column, bounded text width, consistent row spacing and 18 px internal padding (16 px on mobile). Narrow card containers stack the image above the text. The obsolete float clearfix is removed.

No new clipping/overflow-hiding rules are added. Actual element bounds and scroll widths are checked. Existing text, image/background properties, font family/size/weight/line height, colors, links and mobile tap sizing remain unchanged. The neighboring competition card remains untouched and both desktop panels stretch naturally to the same row height. Saved hero-card artwork and geometry remain unchanged.

Focused checks at 320, 390, 768, 1024 and 1440 px passed. See verification.json and desktop/tablet/mobile before/after screenshots. No V2 or content tests repeated.

Preview: https://hafizv1.github.io/powerlifting-v1-preview/homepage-card-review/index.html?v=4
Comparison: https://hafizv1.github.io/powerlifting-v1-preview/homepage-card-review/news-review.html

Updated on the existing feature/homepage-card-backgrounds branch and Draft PR #5. No production merge/deployment authorized.
