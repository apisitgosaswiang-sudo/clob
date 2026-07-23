# CLOB v2 Roadmap

## Stabilization Gate

### Patch-010 — Coach Security Stabilization

- Coach ID then Security PIN
- PBKDF2 + Salt
- generic credential errors
- five failed attempts / fifteen-minute lockout
- persistent Coach session until manual logout
- no automatic session timeout
- no Member authentication changes

## Phase A — Foundation

### D-001 — CLOB Design System

- colors and semantic roles
- typography
- spacing, radius and elevation
- cards, hero and CTA
- progress and rings
- motion
- empty, loading, success, warning and error states
- Emotion Design rules
- Daily Mission foundation

Implementation should be incremental:

1. Design audit and tokens
2. Reusable core components
3. Member Home reference screen
4. Daily Mission and Emotion Design pilot

Reference implementation:

- Patch-011R resets the unshipped first Patch-011 direction.
- Member Today is the first reference screen.
- Nutrition does not begin until the Product Owner accepts the reference
  direction.

## Phase B — Nutrition

Nutrition is coaching, not a calorie tracker.

1. N-002 Data Layer / Trainer Targets
2. N-003 Trainer Targets UI
3. N-004 Member Home Nutrition Card
4. N-005 Manual Food Log
5. N-006 Photo Upload
6. N-007 AI Estimation
7. N-008 Trainer Review
8. N-009 Stabilization

All Nutrition UI must use D-001 components.

## Phase C — Progress

Unify trends, streaks, personal records and small wins under the CLOB v2 design
language.

## Phase D — Coach Experience

- Coach Dashboard
- actionable analytics
- feedback workflows
- AI assistance

Coach views must prioritize the next coaching action, not passive reporting.
