# Fotoqalereya: competition-specific publishing

`qalereya.html` is the top-level index. Each competition has a stable page:
`fotoqalereya-<competitionId>.html`. The publisher selects only published
albums matching that exact ID. Missing/unpublished albums never fall back to
another competition. Multiple albums for one competition share its page.

The two original assignments remain unchanged: kubok-2026-haqqinda (19 photos)
and kubok-2025-haqqinda (13 photos). Original assets are retained byte-for-byte.
Competition detail pages and Yarışlar contain no gallery content or action;
the shared header is the sole entrance to the dedicated section.

V2 requires a competition ID. The selector shows name, date and ID. An existing
album cannot be reassigned. Its photos must live under its own upload directory;
shared paths and invalid IDs fail before saving or rendering. New browser
uploads use SHA-256 identifiers and reject repeated bytes. Existing upload,
metadata editing and removal remain; ↑/↓ controls persist photo ordering.

Codex ZIP jobs use the existing GitHubStore integration and validation, specifying
`kind: albums`, the album ID and `fields.competitionId`. An incorrect association
fails validation; no personal session or additional credentials are required.
Do not infer a competition from a filename or reuse another album as fallback.

All writes stay on the isolated content branch. releaseReview generates a draft
PR with page hashes, backups and preserved athlete/result counts. Publishing
requires explicit approval of the exact release; no automatic merges are added.
Rollback uses the existing manifest and backups. For this structural migration,
backups and a bound manifest also cover navigation changes and new gallery pages.
