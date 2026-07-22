# CLOB v1.0 RC3 — Stabilization

- Fixed Program Builder crashes caused by missing Firebase arrays.
- Program writes and assignments no longer silently report success when Firebase rejects them.
- Fixed member Package assignment persistence and quarterly billing cycle.
- Changed connected-device data priority: Firebase wins; localStorage is fallback only.
- Added Firebase connection warning across data-dependent pages.
- Fixed Firebase status when returning to Landing.
- Added JPEG fallback for older Safari image processing.
- Replaced invalid root database rules file with valid combined rules for CLOB and Workout Tracker.
