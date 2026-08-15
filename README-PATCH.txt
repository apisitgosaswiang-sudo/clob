Morning Warrior UX v3 — Complete Member Experience Patch
Base: clob-main (2).zip

Changed files only:
js/member-today-page.js
js/nutrition-page.js
js/workout.js
js/member-profile-page.js
js/member-progress-page.js
js/progress-photos-page.js
js/firebase.js
css/app.css
css/nutrition.css
firebase/storage.rules

Highlights:
- Home redesigned around one dynamic hero / Today's Mission
- Your Moment social-friendly progress card on Home
- Nutrition label changed to Meals across member bottom navigation
- Meals prioritizes calories remaining, meal slots, sticky Add Meal, macros lower down
- Workout ready screen redesigned with Today's Workout hero and weekly momentum
- Progress simplified into Body / Photos / Check-ins / Records + shareable story card
- Progress Photos: sticky Save, saved-history management, replace/delete single photo, delete set
- Saved-photo replacement updates the original photo set instead of creating a new date/set
- Trainer before/after photos locked to consistent 4:5 frames
- Firebase Storage delete support added; deploy firebase/storage.rules for physical file deletion

Important:
Replace files using the same paths. Do not replace index.html, app.js, or sw.js.
Deploy firebase/storage.rules separately in Firebase for Storage delete permission.
