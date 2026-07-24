# Combined Hotfix 6 — QA

## Static validation

- JavaScript syntax: PASS
- Firebase JSON rules parse: PASS
- Service-worker asset inventory: PASS
- Removed Workout History placeholder: PASS
- Cache version updated: PASS

## Acceptance checklist

- Member opens Workout page without starting: no session is created
- Start button creates session; first saved set changes status to in progress
- Zero-set session can be cancelled
- Trainer assigns a saved program; member receives its first workout day
- Removing assignment does not delete the source program
- Weekly update is not reported successful when Firebase save fails
- One weekly check-in is retained per member and week
- Submitted update appears in Waiting Review and Notifications
- Trainer/member check-in views resolve the same persisted record
- Member detail shows “ยังไม่มีข้อมูล” instead of misleading zeroes where data is absent
- Workout History opens and shows completed/partially completed sessions
- Member deletion requires name confirmation and removes linked member data

