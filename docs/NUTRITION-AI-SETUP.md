# Morning Warrior Nutrition AI — One-time Firebase setup

Status: App Check registered; production validation pending  
Billing target: Firebase Spark, no Cloud Billing account, no payment method  
Primary model: `gemini-3.1-flash-lite`  
Fallback model: `gemini-3.5-flash`

The manual Nutrition system works without this setup. Until App Check is ready,
the AI button stops before reserving quota and asks the member to enter the meal
manually.

## 1. Keep the project on Spark

1. Open Firebase Console for `online-trainer-c`.
2. Confirm the project is on the Spark plan.
3. Do not link a Cloud Billing account.
4. Do not enable Cloud Functions or Vertex AI Gemini API.

The intended provider is Gemini Developer API through Firebase AI Logic.

## 2. Enable Firebase AI Logic

1. Open `AI Services` → `AI Logic`.
2. Start the setup flow.
3. Select `Gemini Developer API`.
4. Complete the guided setup.
5. Do not copy or add the generated Gemini API key to Morning Warrior source code.

Firebase AI Logic uses its proxy gateway to attach the Gemini API key on the
backend. The Firebase web configuration key already present in `js/config.js`
is not the Gemini API key.

## 3. App Check configuration for the public web app

Completed on 23 July 2026:

- Firebase web app: `online-trainer-web`
- Provider: reCAPTCHA Enterprise, score-based
- Production domain: `workout-tracker-ten-bay.vercel.app`
- Token TTL: 1 hour
- App status: Registered
- The public site key is already configured in `js/config.js`.

Do not add the standalone reCAPTCHA `<script>`, assessment endpoint, `TOKEN`,
`USER_ACTION` or a server API key. Firebase App Check SDK handles the token
flow automatically.

After deploying this build:

1. Test one AI food-photo analysis on the production domain.
2. Open Firebase Console → App Check → request metrics.
3. Confirm the production request appears as valid.
4. Then enable enforcement for Firebase AI Logic.
5. Keep replay protection disabled for the first small beta unless it is
   intentionally configured and tested.

The site key is public configuration. Never place a reCAPTCHA secret or Gemini
API key in the app.

## 4. Lower the provider-side per-user rate limit

The Morning Warrior daily counter is an app-level product guardrail. Add a provider-side
rate limit as defense in depth:

1. Open Google Cloud Console for `online-trainer-c`.
2. Open `Firebase AI Logic API` → `Quotas & System Limits`.
3. Find `Generate content requests` for the production region.
4. Lower the per-user rate from the default to `2 requests per minute`.
5. Keep the project on Spark with no billing account.

This provider quota is per minute rather than per day. The Morning Warrior transaction
continues to enforce the three-per-day member flow and the 60-per-day project
guardrail. Spark with no billing account remains the financial hard stop.

## 5. Local testing with App Check

When testing from localhost with enforcement enabled:

1. Enable the App Check web debug provider only in a temporary local test copy.
2. Open the local app and copy the debug token printed in the browser console.
3. Add the token to Firebase Console → App Check → Apps → Manage debug tokens.
4. Never publish the debug token or debug-mode switch.

Production files must continue to use the reCAPTCHA Enterprise provider.

## 6. Cost guardrails already enforced by Morning Warrior

- Image selection and compression: 0 AI calls.
- Explicit `วิเคราะห์ด้วย AI` button: 1 AI call.
- One call returns Calories, Protein, Carbs and Fat together.
- Same compressed image fingerprint: cached result, 0 new calls.
- Member limit: 3 new analyses per calendar day.
- Whole-project limit: 60 new analyses per calendar day.
- Failed analysis never saves nutrition values automatically.
- Reanalysis warns that it uses another quota before proceeding.
- Opening pages, editing values, saving, deleting, Home calculations and trainer
  review do not call AI.
- No automatic switch to a paid provider exists.

Usage counters are stored at:

```text
clob/aiFoodUsage/{YYYY-MM-DD}
```

Cached estimates are stored at:

```text
clob/aiFoodCache/{memberCode}/{SHA-256 fingerprint}
```

The meal photo itself is not stored permanently in this beta.

## 7. Privacy notice for beta members

Use a short notice near the photo action:

> รูปอาหารจะถูกส่งให้ AI เพื่อประเมินสารอาหารและไม่ถูกเก็บเป็นรูปถาวรใน Morning Warrior
> โปรดหลีกเลี่ยงภาพที่มีใบหน้า เอกสาร หรือข้อมูลส่วนตัว

The Gemini Developer API free tier may use submitted data to improve provider
products. Do not use meal photos that contain faces, names, addresses, medical
documents or other private information.

## 8. Smoke test after deployment

1. Log in as a member.
2. Open Nutrition.
3. Select one food photo.
4. Confirm the UI still says no quota was used before the button is pressed.
5. Press `วิเคราะห์ด้วย AI` once.
6. Confirm the result shows name, Calories, Protein, Carbs, Fat and an AI
   estimate label.
7. Edit one value and save.
8. Confirm Home updates Calories Remaining without another AI call.
9. Re-select the exact same image and analyze.
10. Confirm the cached result returns and the daily remaining count does not
    decrease.
11. Use three different images, then confirm a fourth new image falls back to
    manual entry.
