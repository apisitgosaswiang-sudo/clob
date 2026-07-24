# Morning Warrior v2 — Delivery QA

วันที่ตรวจ: 24 กรกฎาคม 2026  
ฐานเปรียบเทียบ: CLOB v2 Patch-011F1  
ชุดส่งมอบ: Nutrition + AI Food Estimation Beta · Full Hotfix 5

## ผลอัตโนมัติ

- ผ่าน Branding: โลโก้แสดง Morning Warrior ขนาดใหญ่ขึ้นและไม่มีข้อความ by CLOB
- ผ่าน Nutrition data: target, local fallback, pending sync, edit same record และ soft delete
- ผ่าน Nutrition + AI UI: เมนู 5 แท็บ, manual logging, trainer review และไม่มี AI call อัตโนมัติ
- ผ่าน AI quota: 3 ครั้งต่อสมาชิก, 60 ครั้งต่อระบบ, cache ไม่หักซ้ำ และคืนโควตาเมื่อวิเคราะห์ล้มเหลว
- ผ่าน Dynamic Home states: normal, near, critical, over และ Next Best Action
- ผ่าน Patch-011F1/011F2 navigation, route, safe-area และ Service Worker regression
- ผ่าน D-001 Design System regression
- ผ่าน Full smoke test สำหรับ Programs, Packages, member add/edit, route 17 หน้า,
  Progress Check-in, Weekly Check-in และ Offline Programs fallback
- ใส่ Public Site key ของ reCAPTCHA Enterprise ที่ลงทะเบียนกับ
  `workout-tracker-ten-bay.vercel.app` แล้ว
- Firebase App Check เริ่มก่อน Auth, Database, Storage และ AI พร้อมตรวจ Token
  ก่อนจองโควตา
- ผ่าน App Check runtime test: ลำดับ initialization ถูกต้องและรับ Token ได้
  ก่อนเริ่ม AI flow
- ผ่าน AI provider fallback test: เมื่อโมเดลหลักตอบ 429 ระบบสลับโมเดลสำรอง
  ภายใต้โควตา Morning Warrior ครั้งเดียว และหากล้มเหลวทั้งหมดจะคืนโควตา
- Service Worker cache เปลี่ยนเป็น Hotfix 5, JavaScript/CSS/JSON ใช้
  Network-first และ PWA รีโหลดหนึ่งครั้งเมื่อ worker ใหม่เข้าควบคุม

## สิ่งที่ยังต้องตรวจหลัง Publish

- การเชื่อม Firebase production จริง
- Firebase AI Logic request และ App Check token บนโดเมนจริง
- การวิเคราะห์รูปอาหารจริงด้วย `gemini-3.1-flash-lite` และ fallback
  `gemini-3.5-flash`
- ตรวจ App Check metrics ให้มี Valid requests ก่อนเปิด Enforcement
- การติดตั้ง/อัปเดต PWA บนอุปกรณ์จริง
- Layout และ safe area บนโทรศัพท์จริงที่ใช้งาน

รายการใน `NUTRITION-AI-QA.md` เป็น Post-deployment acceptance checklist
จึงยังไม่ถือว่าผ่านจนกว่าจะตรวจบนระบบที่ Publish แล้ว
