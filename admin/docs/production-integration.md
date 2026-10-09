# V2 production integration preparation — staging only

No production activation is authorized. PR #2 stays draft and unmerged. The staging Worker remains hard-locked to `HafizV1/powerlifting-v1-preview`, `v2/staging-base`, and `ENABLE_V1_EXPORT=false`. Existing secrets, production DNS, CNAME, homepage, stylesheet/image assets and original 208 athlete profiles are unchanged.

## Audit and decision

V1 uses 24 static HTML pages, embedded `DATA` (351 result rows) in `neticeler.html`, and embedded `ATH` (208 profiles with additional historical entries) in `idmancilar.html`. These two datasets are not interchangeable: regenerating athletes from the result table would lose historical information. V2 previously managed six JSON collections and attached protocol documents without importing results. Its opt-in renderer rebuilt historical details and some original content markup.

The immediate export-on-save path is now rejected even outside staging. Preparation uses `src/release.mjs`: unchanged content makes no page changes; edited news/calendar cards retain other original cards and the page shell; historical competition detail markup stays intact with an explicitly labelled update block. Documents and album links use replaceable managed sections, so reruns do not duplicate them. New detail/gallery pages use existing V1 templates and styles. Records retain all original category identities. Approved results append to `DATA` and to the corresponding `ATH.results`; the original profile fields/history are preserved.

The safest production activation is a **separate, approval-only content PR process** based on the current production SHA, not changing the existing staging Worker to write production. No new publishing service or production permissions are enabled by this change.

## Browser workflow

1. Open the existing staging panel and sign in with the installed GitHub App.
2. Create/select a competition. Upload a protocol in **Nəticələr və protokollar** and choose the correct sport.
3. Choose **Protokolu analiz et**. XLSX and DOCX are extracted on the authenticated Worker; PDF.js extracts text PDFs in the authenticated browser from the same-origin document. PDF.js and its Worker are served locally by the admin service, not a third-party CDN. PDF extraction is explicitly flagged for source comparison.
4. Check each row. Select an existing athlete, explicitly approve a genuinely new athlete, or skip the row. Editable Azerbaijani-labelled fields allow corrections. Supply a review note and check the source-verification acknowledgement. Missing/invalid required fields block approval. A fuzzy match never silently creates a profile. Possible records are warnings, not ratification.
5. Mark the appropriate content **Yayıma hazır**. This is readiness, not public publishing.
6. Choose **Sayt dəyişikliklərini yoxlamaya hazırla**. A new **draft PR** targets `v2/staging-base` in the preview repository. Review its page diff, uploads, manifest and backups. Do not merge it. A normal **Təsdiqə göndər** PR remains JSON/upload review only.

Normal editing continues on `v2/content-staging`. Release candidates use isolated `v2/release-review-UUID` branches. Test fixtures belong only on disposable `v2/content-e2e-UUID` branches and must be removed after validation.

## Protocol validation and matching

- XLSX: bounded OOXML ZIP entries, inline/shared strings, multiple worksheets, sparse cell addresses, cached formula values. Formulas are never evaluated. DOCX: multiple Word tables and paragraph/run text. PDFs: positioned text cells, multi-page extraction; no guesses from scanned images.
- Recognizes Azerbaijani/English column aliases and reordered columns. Nonstandard tables require explicit mapping in the advanced section; an array of mappings supports multiple tables. Unknown tables block partial approval rather than disappearing. Complex merged/multiline headers and unusual PDF positioning need administrator correction or a mapping. This is not a guarantee of automatic extraction from every document layout.
- Captures name, gender/category, age group, weight class, body weight, best lifts, total, place, club, birth date when supplied, GL and equipment. Attempts remain blank if unavailable; best lifts are not fabricated into attempt values.
- Normalized exact names and reversed name order yield suggestions. Ambiguous homonyms, conflicting birth data and near names are flagged. Existing athlete selection is explicit; new profiles require a new-athlete decision and duplicate check.
- Powerlifting requires all three best lifts and a consistent total. Bench Press rejects squat/deadlift/total contamination. Duplicate rows and already-existing competition/name/sport results are blocked rather than overwriting history.
- Approval binds source SHA-256, baseline Git SHA, competition context, review hash, reviewer identity and per-row decisions. Replacing the document or changing its competition/sport invalidates approval. Release preparation rechecks hashes and results before creating a candidate.
- Original record categories are preserved. Results exceeding a recorded value (or its standard when no record exists) are flagged; administrators must separately verify eligibility and update the records collection. Imports cannot ratify records automatically.

Limits: 10 MB input; 32 MB ZIP expansion; 1,500 archive entries; 5,000 extracted rows; 100 PDF pages; 100 KB authenticated JSON request limit. Large/complex imports may need smaller documents or batches and must be evaluated against the account's Cloudflare CPU limits. XML DTD/entities and unsafe archive paths are rejected. Encrypted, scanned or textless PDFs require external OCR/manual transcription; no OCR service has been provisioned. Legacy XLS/CSV are still attachments, not automated imports.

## Review, backup and rollback

Each candidate includes `content/v2/releases/UUID/manifest.json` and exact backups of changed existing pages. The manifest binds source/content revisions, changed page hashes, protocol source hashes, import counts/reviewer metadata and before/after athlete/result counts. Referenced uploads are copied by existing Git blob SHA; original images/documents are untouched. The draft PR records the bundle hash. Source/content head changes prevent candidate preparation; no force push or automatic merge exists.

`prepareRollback` verifies the manifest hash, current page hashes and backup hashes. It prepares exact restores and removal of newly created pages, requires review, and refuses to overwrite later edits. Git history additionally retains every source commit and uploaded blob. No rollback endpoint can publish or modify main.

Cloud maintainer tooling: `npm ci`, `npm run build`, `npm run prepare:release -- /tmp/staging-state.json`. A staging-state file requires `collections`, `sourceRevision` and `contentRevision` Git SHAs. Source/content commits must be available to the checkout; fetch the preview branch through existing cloud GitHub access as needed. The command creates a fresh `/tmp/powerlifting-release-*` artifact, candidate pages, backups and an unapproved approval example. It does not push, merge or deploy. The older static preview exporter now uses selective preparation and refuses an existing output directory.

## Verified evidence and limits

- Node suite: 47 tests passed at this preparation stage, including real ZIP/XML and PDF parsing, authenticated import routes, approval/duplicate/history guards, selective adapters, release PR construction, backup/rollback and all V1 baseline checks.
- Real Chromium loopback workflows passed for XLSX, DOCX and text PDF upload → extraction → explicit row approval at 320/375/390/430/768px. The existing admin browser suite and 13-step controlled suite also passed, with no JavaScript errors.
- Actual preview-repository integration candidate: [closed, unmerged PR #3](https://github.com/HafizV1/powerlifting-v1-preview/pull/3). Real GitHub writes, uploaded blobs, candidate pages, all original 208 profiles/351 results, links, backups and homepage preservation were checked. Both temporary branches were deleted; only main, v2/staging-base and v2/content-staging remain. These tests used the existing cloud GitHub proxy, not a fresh administrator OAuth session.
- The earlier 13 live administrator workflows remain verified in [the previous staging report](e2e-testing.md). They are not evidence that the newly added import/release controls have been exercised through the live OAuth session. Cloudflare Builds post-deploy smoke checks can verify the new served assets, App configuration and access boundaries; full new owner-session acceptance remains outstanding.

## Future production authorization — not requested now

Before production activation, obtain explicit approval for the candidate and architecture, configure a separate least-privilege production GitHub App installation, protect main with required reviews/no automatic merges, establish the current live SHA as the source, and verify the candidate on an isolated preview. Approval metadata alone is not permission to publish: a future publisher must check GitHub's actual authorized PR reviews and current candidate/source SHA. The current release endpoint intentionally refuses production repositories. No new secret or account-owner action is needed for staging preparation.

The homepage is intentionally outside the CMS publishing surface. Historical detail edits are appended as labelled updates rather than rewriting approved historical paragraphs. Full automatic OCR, arbitrary-layout reconstruction and automatic record ratification are not implemented.
