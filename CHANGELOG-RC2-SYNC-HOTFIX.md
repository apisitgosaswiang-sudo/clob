# CLOB RC2 Sync Hotfix — 2026-07-25

## Fixed
- Program drafts are saved locally before opening the builder.
- Remote empty/stale program data no longer overwrites newer local drafts.
- Member program queue entries receive stable IDs and `extras` immediately.
- Check-in save/delete now verifies Firebase success before updating local UI.
- Weekly check-in delete and coach review now verify Firebase success.
- Package edits save locally first and retry pending Firebase synchronization.
- Removed obsolete `memberActivity` deletion path.
- Updated service-worker cache version to prevent mixed old/new assets.
- Added UI error handling for failed check-in, weekly check-in, review, and delete operations.

## Validation
- JavaScript syntax checked for every file in `js/` and `sw.js`.
- Import/export references for the added program draft helper verified.
