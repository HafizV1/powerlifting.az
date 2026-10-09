# Delegated Codex content automation

This cloud-maintainer command reuses the existing Codex GitHub connection. It does not use a browser session, production App secrets, private keys, PATs, or a new public authentication endpoint. GitHub enforces the connection's repository permissions. Remove the connection's access to revoke automation.

`node admin/scripts/codex-content.mjs /path/job.json` validates a job read-only.
Add `--apply` to save to `v2/content-production` and create a **draft** production release PR using the existing `GitHubStore.save`, validation, backups, manifests and `releaseReview` pipeline.

Example photo job (paths relative to the job JSON):

```json
{
  "kind": "albums",
  "id": "kubok-2026-photos",
  "fields": {
    "title": "Pauerliftinq və Benç-press üzrə Azərbaycan Kuboku 2026",
    "competitionId": "kubok-2026-haqqinda"
  },
  "files": ["photos/01.jpg", "photos/02.jpg"],
  "reviewReady": true
}
```

Always look up an existing album for the competition before selecting an album ID. Competition references must exist; this job never creates a competition. Images must be optimized before upload when necessary and remain within existing 3 MB limits. Unsupported formats and incorrect file signatures are rejected. SHA256 image IDs prevent repeated uploads to the same album from adding duplicates. All files are read and validated before any mutation. Review all candidate changes: releaseReview includes other pending content from the shared content branch too.

Other existing content kinds: news, competitions, protocols, records and recordDocuments. Supply only fields accepted by existing V2 validation. Use `requireExisting: true` for edits that must not create new entries. One upload is permitted for news, competitions, protocols or documents; albums support up to 100 files. Protocol import approvals still use the existing review mechanism; uploading a protocol does not approve extracted athlete results or possible records.

`reviewReady` marks an item eligible for the PR candidate; it does **not** publish it. The transport rejects direct main ref updates, force pushes, merge calls, branch deletion, and non-draft PRs. No merge command exists. GitHub connection permissions may be broader than this script's allowlist; this is a trusted maintainer tool, not a sandbox for arbitrary code. Public publication requires separate explicit user approval and manual reviewed merge.

Failures may leave a saved draft on the content branch if PR generation fails; inspect/retry against the current revision rather than force-overwriting. Original pages are backed up by the release pipeline. No Worker configuration, staging secret or production website change is needed to enable this tooling.

## First gallery task

Target competition confirmed: `kubok-2026-haqqinda`. The managed album collection was empty during inspection. The 21 inline chat images are visible to the assistant but no downloadable image attachments or file IDs were supplied to the execution workspace. Upload cannot run until the original files are provided (one ZIP is sufficient). Do not substitute generated images or claim the gallery PR exists before uploading the actual files.
