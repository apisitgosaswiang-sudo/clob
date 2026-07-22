# CLOB Nutrition Module v1.0

Status: Approved design baseline  
Patch: N-001 (Design only — no production code)  
Architecture: HTML/CSS/JavaScript + Firebase Realtime Database + Firebase Storage

## 1. Product goal

CLOB Nutrition helps the member answer one question immediately:

> วันนี้ยังทานได้อีกเท่าไร?

It helps the trainer answer:

> ลูกเทรนทำตามเป้าหมายโภชนาการได้สม่ำเสมอแค่ไหน?

CLOB is not intended to become a full food encyclopedia or a MyFitnessPal clone. The system stores only foods and meals actually used by members.

## 2. Core UX rules

1. One screen has one main purpose.
2. One primary action per screen.
3. Frequently used actions should finish within 1–3 taps.
4. The member home shows only the most important information first.
5. Calories remaining is the main number; consumed calories is secondary.
6. Protein is shown as supporting information.
7. Carb and fat are stored when available but are not emphasized in v1.
8. Advanced details remain behind a detail screen.
9. AI suggestions must always be editable before confirmation.
10. No large manually maintained food database is required.

## 3. v1 scope

### Trainer

- Set daily calorie target.
- Set daily protein target.
- Choose the effective start date.
- View a member's daily meals.
- View calories and protein adherence.
- Add a short comment to a meal.

### Member

- See calories remaining on the Today screen.
- See today's workout on the same screen.
- Add a meal manually.
- Add a meal from a recent food.
- Upload or take a meal photo.
- Review and edit AI-estimated nutrition before saving.
- Edit or delete their own meal.
- View today's meal timeline.

### Not included in v1

- Recipe builder.
- Public social feed.
- Challenges and rankings.
- Large global food catalogue stored in Firebase.
- Micronutrient dashboard.
- Barcode scanning.
- Meal plans with prescribed menus.
- Automated medical recommendations.

## 4. Member navigation

Target member navigation:

- Home
- Workout
- Nutrition
- Progress
- Profile

Home remains the first screen after login.

## 5. Member Home information hierarchy

The existing `member-today-page.js` will remain the Home entry point.

Recommended order:

1. Greeting.
2. Nutrition summary card.
3. Today's workout card.
4. Other coaching tasks or habits.
5. Progress shortcuts.

### Nutrition card

Primary information:

- Remaining calories.

Secondary information:

- Consumed / target calories.
- Protein consumed / target.

Primary action:

- `เพิ่มอาหาร`

Example:

```text
วันนี้ยังทานได้
1,240 kcal

ทานแล้ว 760 / 2,000 kcal
โปรตีน 62 / 140 g

[ เพิ่มอาหาร ]
```

States:

- No target: `เทรนเนอร์ยังไม่ได้ตั้งเป้าหมาย`
- No meals: show full target as remaining.
- Near target: neutral warning, no alarming language.
- Over target: `เกินเป้าหมาย 120 kcal`
- Loading: skeleton card, not a blank panel.

## 6. Add meal flow

The first release should keep the entry screen simple.

```text
เพิ่มอาหาร

[ ถ่ายหรือเลือกรูป ]
[ เลือกจากรายการล่าสุด ]
[ กรอกเอง ]
```

### Manual entry

Required:

- Food name.
- Calories.

Optional:

- Protein.
- Carb.
- Fat.
- Meal type.
- Photo.

Primary action:

- `บันทึกอาหาร`

### Photo + AI entry

```text
Choose or take photo
→ Upload compressed image
→ Server-side AI estimation
→ Member reviews result
→ Member confirms final values
→ Save meal
```

The AI result is never written directly as the final nutrition value without confirmation.

## 7. Nutrition calculation rules

```text
consumedCalories = sum(meals.final.calories for selected date)
remainingCalories = dailyTarget.calories - consumedCalories
consumedProtein = sum(meals.final.protein for selected date)
remainingProtein = max(0, dailyTarget.protein - consumedProtein)
```

Rules:

- Remaining calories may be negative.
- Remaining protein displayed to members should not be negative.
- Daily totals are calculated from meal records and are not the authoritative stored value.
- Editing or deleting a meal must update totals immediately.
- Historical days must use the target effective on that day.
- Changing today's target must not rewrite historical meal records.

## 8. Firebase data model

All new nutrition data stays under the existing `clob` root and does not restructure Workout, Programs, Packages, Progress, or PIN Security.

### 8.1 Nutrition targets

```text
clob/nutritionTargets/{memberCode}/{targetId}
```

```json
{
  "calories": 2000,
  "protein": 140,
  "carbs": null,
  "fat": null,
  "effectiveFrom": "2026-07-22",
  "effectiveTo": null,
  "status": "active",
  "createdAt": 1784736000000,
  "createdBy": "trainer",
  "updatedAt": 1784736000000
}
```

Notes:

- Keep target history.
- Do not overwrite the previous target when a new plan begins.
- Only one target should resolve as active for a given date.

### 8.2 Daily meal logs

```text
clob/nutritionLogs/{memberCode}/{date}/{mealId}
```

```json
{
  "name": "ข้าวกะเพราไก่ไข่ดาว",
  "mealType": "lunch",
  "imageUrl": "https://...",
  "imageStoragePath": "nutrition/{memberCode}/{date}/{mealId}.webp",
  "source": "ai",
  "ai": {
    "calories": 720,
    "protein": 30,
    "carbs": 78,
    "fat": 28,
    "confidence": 0.72,
    "model": "provider-model-name",
    "estimatedAt": 1784736000000
  },
  "final": {
    "calories": 700,
    "protein": 32,
    "carbs": 75,
    "fat": 26
  },
  "portion": 1,
  "createdAt": 1784736000000,
  "updatedAt": 1784736000000,
  "createdBy": "member",
  "status": "active"
}
```

Rules:

- `final` is authoritative for calculations.
- `ai` is retained for traceability only.
- Deleted meals should use soft delete initially: `status: "deleted"`.
- Daily calculations ignore deleted meals.

### 8.3 Personal food library

```text
clob/personalFoodLibrary/{memberCode}/{foodId}
```

```json
{
  "name": "เวย์ 1 Scoop",
  "defaultPortion": 1,
  "nutrition": {
    "calories": 130,
    "protein": 25,
    "carbs": 4,
    "fat": 2
  },
  "source": "confirmedMeal",
  "usageCount": 8,
  "lastUsedAt": 1784736000000,
  "createdAt": 1784000000000,
  "status": "active"
}
```

Creation rule:

- A confirmed meal may be saved to recent foods automatically.
- The system should avoid duplicate food records with the same normalized name and similar nutrition.
- v1 can rank by `lastUsedAt` and `usageCount`.

### 8.4 Trainer feedback

```text
clob/nutritionFeedback/{memberCode}/{date}/{feedbackId}
```

```json
{
  "mealId": "meal_001",
  "type": "comment",
  "message": "มื้อนี้ดีครับ เพิ่มผักอีกเล็กน้อย",
  "createdAt": 1784736000000,
  "createdBy": "trainer"
}
```

## 9. Firebase Storage

Meal images:

```text
nutrition/{memberCode}/{date}/{mealId}.webp
```

Image rules:

- Compress on the client before upload.
- Recommended long edge: 1280 px maximum.
- Recommended target size: approximately 150–350 KB.
- Save both download URL and storage path.
- Deleting a meal does not need to immediately delete the image in v1; cleanup can be a later scheduled process.

## 10. AI architecture

The browser must not contain an AI provider secret.

```text
PWA
→ protected server endpoint / Firebase callable function
→ AI vision provider
→ normalized JSON response
→ member confirms
→ Firebase save
```

Expected normalized AI response:

```json
{
  "name": "ข้าวกะเพราไก่ไข่ดาว",
  "calories": 720,
  "protein": 30,
  "carbs": 78,
  "fat": 28,
  "confidence": 0.72,
  "notes": "Estimated from one plate; oil amount is uncertain."
}
```

Fallbacks:

- AI unavailable → allow manual entry.
- Low confidence → show `ค่าประมาณ กรุณาตรวจสอบ`.
- Invalid response → do not save; preserve photo and allow manual values.
- Slow network → show upload/analysis progress and allow retry.

## 11. Trainer screen design

Nutrition belongs inside the existing member detail workflow rather than creating a crowded new top-level trainer menu in v1.

### Trainer member nutrition section

Display:

- Current calories target.
- Current protein target.
- Edit target button.
- Today's consumed calories.
- Today's protein.
- Seven-day adherence summary.
- Recent meals.

Only one primary action:

- `ตั้งเป้าหมาย` or `แก้เป้าหมาย`

## 12. Permissions baseline

v1 application-level intent:

- Member may read their own target and their own nutrition data.
- Member may create/edit/delete their own meal logs.
- Trainer may read and manage nutrition data for assigned members.
- Trainer may create targets and feedback.
- AI endpoints must validate a signed-in Firebase user and member access.

Important limitation:

The current app uses anonymous Firebase Authentication plus a member code/PIN layer. Before public launch, production Firebase Rules must be reviewed carefully because a client-side PIN alone is not equivalent to Firebase authorization.

## 13. Analytics definitions

### Daily calorie adherence

For coaching display, avoid rewarding severe under-eating.

Initial v1 bands:

- Within ±10% of target: `ตามเป้าหมาย`
- 10–20% outside target: `ใกล้เป้าหมาย`
- More than 20% outside target: `ควรทบทวน`

### Protein adherence

```text
proteinAdherence = min(100, consumedProtein / targetProtein × 100)
```

Weekly summary uses days with an active target. Missing logs must be displayed as `ไม่มีข้อมูล`, not automatically treated as zero intake.

## 14. Edge cases

- Trainer has not set a target.
- Target changes in the middle of the week.
- Member logs food after midnight for the previous day.
- Duplicate tap creates duplicate meals.
- Member edits AI values.
- Meal photo uploads but database save fails.
- Database save succeeds but image upload fails.
- Member is offline.
- Deleted meal remains in recent foods.
- Same meal is logged twice intentionally.
- Protein target is not set.

v1 decisions:

- Date picker allows today and recent past dates.
- Save button disables during submission to prevent duplicate taps.
- Manual meal can be saved without a photo.
- Calories are required and must be zero or greater.
- Protein, carb, and fat default to zero when omitted.
- A failed image upload must not block manual meal saving.

## 15. Incremental implementation roadmap

### N-001 — Design baseline

- This specification only.
- No production behavior changes.

### N-002 — Nutrition data layer

- Add Firebase read/write helpers.
- Add target resolution by date.
- Add meal totals calculator.
- Add rules for new paths.
- No visible member UI yet.

### N-003 — Trainer target setting

- Add Nutrition section to member detail.
- Set calories and protein.
- Keep target history.

### N-004 — Member Home nutrition card

- Show remaining calories and protein.
- Add one `เพิ่มอาหาร` action.
- Keep workout visible directly below.

### N-005 — Manual meal logging

- Nutrition page.
- Today's timeline.
- Manual add/edit/delete.
- Recent foods created from confirmed meals.

### N-006 — Photo upload

- Client image compression.
- Firebase Storage upload.
- Meal photo preview.

### N-007 — AI estimation

- Protected server-side endpoint.
- AI review and confirmation screen.
- Manual fallback.

### N-008 — Trainer review

- Daily timeline.
- Comments.
- Seven-day adherence summary.

### N-009 — Stabilization

- Offline/error handling.
- Duplicate prevention.
- iOS Safari testing.
- Service Worker cache version update.
- Production Firebase Rules review.

## 16. Acceptance criteria for Nutrition v1

Nutrition v1 is ready for initial real members when:

1. Trainer can set calories and protein without touching Firebase manually.
2. Member sees remaining calories immediately after login.
3. Member can log a meal manually in under 30 seconds.
4. Member can reuse a recent meal in no more than three taps.
5. Editing or deleting a meal updates remaining calories immediately.
6. Trainer can understand a member's seven-day adherence in under 30 seconds.
7. AI failure never prevents manual meal logging.
8. Existing Workout, Programs, Packages, Progress, and PIN flows remain unchanged.
9. Mobile layout works on iPhone Safari and Android Chrome.
10. No API secrets exist in browser JavaScript.
