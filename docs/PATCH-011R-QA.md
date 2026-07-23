# Patch-011R QA — D-001 Redesign

## Install

1. Confirm Patch-010 is already installed.
2. Copy Patch-011R files into the same project paths.
3. Keep the existing Firebase files and rules.
4. Publish the updated files.
5. Close and reopen the installed PWA once to activate the new cache.

## Member Today

- [ ] Member login still opens Member Today.
- [ ] The greeting reflects morning, afternoon or evening.
- [ ] Today’s Mission is the strongest visual element.
- [ ] No more than three missions appear.
- [ ] Only one rose primary action appears in the mission hero.
- [ ] Start Workout opens the existing workout flow.
- [ ] Continue Workout resumes an in-progress workout.
- [ ] A completed workout shows its mission as completed and disabled.
- [ ] Weekly Goal opens the existing weekly flow.
- [ ] A generic mission can be marked complete.
- [ ] Completing a mission refreshes the progress ring and message.
- [ ] A day without missions shows recovery copy and no fake action.

## Supporting Content

- [ ] Workout title, duration, exercise count and coach note use existing data.
- [ ] Water, Steps, Sleep and Cardio controls still save.
- [ ] Weekly Check-in and Progress links still open.
- [ ] Profile avatar opens Member Profile.
- [ ] Bottom navigation works.

## Responsive / PWA

- [ ] Test at 320 px, 375 px, 390 px and 430 px widths.
- [ ] No horizontal scroll appears.
- [ ] The primary mission action is visible without searching.
- [ ] Bottom navigation does not cover the final content.
- [ ] Reduced-motion preference removes non-essential animation.
- [ ] Reopen the PWA and confirm the new design remains cached.

## Regression

- [ ] Member PIN flow is unchanged.
- [ ] Coach ID and PIN flow is unchanged.
- [ ] Coach session persists until manual Logout.
- [ ] Programs still open.
- [ ] Packages can still be created, edited and assigned.
- [ ] Firebase paths and rules are unchanged.
