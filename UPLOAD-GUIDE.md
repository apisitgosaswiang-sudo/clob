# Upload Guide

## A. อัปโหลดโค้ด
- เปิด https://github.com/apisitgosaswiang-sudo/clob
- Add file → Upload files
- ลากทุกไฟล์จากโฟลเดอร์นี้ รวมถึงโฟลเดอร์ `data`
- Commit changes

## B. ตั้ง Rules
- Firebase Console → Realtime Database → Rules
- Copy จาก `database.rules.json`
- Publish

## C. ทดสอบ
- เปิดเว็บ Vercel
- ครั้งแรกระบบจะ Anonymous Login และ seed ท่า 192 ท่า
- เพิ่ม Client 1 ราย
- Reload หน้าเว็บ ตรวจว่าข้อมูลยังอยู่
- เข้า Exercises ตรวจ Search, Favorite และ Recent
