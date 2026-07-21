# CLOB Alpha 0.4 — Pack 04

Pack 04 เพิ่ม Trainer Dashboard

## ฟีเจอร์ใหม่

- Trainer Dashboard แบบ Mobile-first
- จำนวน Members
- Completed
- In Progress
- Not Started
- Need Attention
- Package Expiring
- Recent Workout Activity
- อ่านสถานะ Workout จาก Firebase
- รองรับข้อมูล Demo เมื่อ Firebase ยังไม่มีข้อมูล
- Bottom Navigation ฝั่ง Trainer

## วิธีติดตั้ง

1. แตกไฟล์ ZIP
2. เลือกไฟล์และโฟลเดอร์ทั้งหมดภายใน
3. อัปโหลดทับไฟล์ใน GitHub Repository `clob`
4. Commit changes
5. รอ Vercel Deploy

## รหัสทดสอบ

### Trainer
PIN `0409`

### Member
รหัส `12345`

## วิธีทดสอบการเชื่อมกัน

1. Login ฝั่ง Member ด้วย `12345`
2. เริ่ม Workout และบันทึกเซต
3. Finish Workout
4. Logout
5. Login ฝั่ง Trainer ด้วย PIN `0409`
6. ดูสถานะ Recent Activity

## Firebase Paths ที่อ่าน

```text
clob/
  members/
  workoutSessions/
```

## Pack ถัดไป

Pack 05 — Members

- รายชื่อสมาชิกทั้งหมด
- ค้นหาและกรอง
- Member Detail
- Package Status
- Workout History
- ปุ่มเพิ่มสมาชิก
