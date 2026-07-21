# CLOB Alpha 0.1

Mobile-first PWA เชื่อม Firebase Realtime Database และ Anonymous Authentication แล้ว

## ฟีเจอร์ในรอบนี้
- Firebase Anonymous Authentication
- แยกข้อมูลผู้ใช้ตาม `clob/users/{uid}`
- Client CRUD
- แพ็กเกจรายเดือน: วันเริ่มต้น / จำนวนเดือน / วันหมดอายุ
- Master Exercise Library 192 ท่า
- Search / Category / Favorites / Recent
- White Theme
- Bottom Navigation
- Auto-scroll to top

## วิธีอัปโหลด
1. สำรองไฟล์เดิมหรือดาวน์โหลด ZIP จาก GitHub ก่อน
2. แตก ZIP นี้
3. GitHub repository `clob` → Add file → Upload files
4. ลากไฟล์และโฟลเดอร์ทั้งหมดขึ้นไป
5. Commit message: `CLOB Alpha 0.1 - Firebase and exercise library`
6. รอ Vercel Deploy

## Firebase Rules
นำเนื้อหา `database.rules.json` ไปวางที่ Firebase → Realtime Database → Rules แล้วกด Publish

## หมายเหตุด้านความปลอดภัย
Firebase web config เป็นข้อมูลที่อยู่ในฝั่งเว็บได้ตามรูปแบบของ Firebase แต่สิทธิ์เข้าถึงข้อมูลต้องควบคุมด้วย Database Rules
