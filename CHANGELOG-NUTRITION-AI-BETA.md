# Morning Warrior v2 — Nutrition + AI Food Estimate Beta

## Added

- Member Nutrition page with daily date selection.
- Daily Calories, Protein, Carbs and Fat totals.
- Manual meal add, edit and soft delete.
- Recent confirmed foods for quick reuse.
- Trainer Calories and Protein targets with effective dates.
- Trainer seven-day adherence, 14-day meal review, meal correction and feedback.
- Member meal timeline displays trainer feedback against the reviewed meal.
- Calories Remaining on Dynamic Home.
- Five-tab member navigation: Home / Workout / Nutrition / Progress / Profile.
- Firebase AI Logic food-photo estimation with editable structured output.
- Client-side image compression and SHA-256 result cache.
- AI quota transaction: 3 calls/member/day and 60 calls/project/day.
- Failed AI analysis releases its reserved app quota.
- Manual fallback for setup, App Check, quota, network and model errors.
- Hotfix 5 uses `gemini-3.1-flash-lite` first and automatically retries
  `gemini-3.5-flash` for provider 429/capacity/unavailable errors without
  charging a second Morning Warrior app quota.
- Failed provider requests now show that the app quota was returned instead of
  warning that the retry already used another quota.

## Cost and privacy

- No Cloud Functions.
- No permanent meal-photo upload in this beta.
- No Gemini API key in browser source.
- No automatic AI calls on page load, photo selection, save or review.
- App Check site key is required before a new AI request.

## Data safety

New data is additive under:

- `clob/nutritionTargets`
- `clob/nutritionLogs`
- `clob/personalFoodLibrary`
- `clob/nutritionFeedback`
- `clob/aiFoodUsage`
- `clob/aiFoodCache`

Workout, Programs, Packages, Progress, Check-ins, Photos and security paths are
not renamed, moved or deleted.

## Brand migration

- App product name is Morning Warrior under the CLOB master brand.
- Browser title, install name, iOS title, visible wordmarks, icon and exported
  member-data filename now use Morning Warrior.
- Hotfix 4 supersedes the original endorsement treatment: visible logo lockups
  now use the larger `Morning Warrior` name without `by CLOB`.
- Hotfix 5 preserves that lockup while replacing only the AI recovery flow and
  PWA cache version.
- Manifest `id`, Firebase root `clob`, local/session storage keys, browser event
  names and CSS namespaces remain unchanged to preserve installed-app identity
  and existing member data.
