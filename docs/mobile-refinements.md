# Final mobile refinements

These refinements follow user approval of the mobile layout. Only mobile submenu spacing and small-text typography changed; all rules remain inside the existing max-width:820px block. No HTML, JavaScript, image assets, colors, content, links, section order or athlete records changed in this refinement.

- Submenu vertical padding: 13px → 10px. Single-line items are 44px high rather than 47px; multiline items retain sufficient height and every link keeps a minimum 44px tap target.
- Competition metadata: 16px (previously 15px).
- Homepage news metadata: 14px; news-page dates: 14px (previously 13px).
- Footer tagline: 12px (previously 10px), links: 15px (previously 14px), copyright: 14px (previously 12px).

## Validation

The existing mobile suite checks all 23 content pages at 320, 375, 390, 430 and 768px, menu buttons/submenus, keyboard focus and Escape, all 208 name searches and results expansions, sport/gender filters, results/records/degree controls and tab buttons. The original athlete-data digest must match at every width. The full suite passed at all five widths, including 1,040 athlete searches and 1,040 results expansions, with no JavaScript runtime errors. Added typography and tap-target assertions retain these expectations for future runs; focused checks also passed for every submenu tap target at every width.

All 69 desktop screenshots match commit 0fe19a0 exactly at 1024, 1440 and 1920px. The news page was rechecked at all three widths after its final date-text adjustment. Final overflow checks passed on all 115 mobile page/viewport combinations, with no JavaScript errors. Focused typography checks confirmed the expected sizes at every requested width. Screenshot capture also checked menu behavior at each width and no-JavaScript navigation fallback at 320px.

Updated previews are under docs/previews/: desktop.png remains unchanged; mobile-320.png, mobile-375.png, mobile-390.png, mobile-430.png and mobile-768.png show the final homepage, mobile-menu.png shows compact submenus, and mobile-footer.png/mobile-news.png provide close views of the improved small text.

Run python3 tests/validate_mobile.py against the local site on port 8001. For desktop equality, serve the unchanged baseline on port 8003 and run python3 tests/validate_desktop.py. No merge or deployment is authorized.
