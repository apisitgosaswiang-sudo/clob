# CLOB Alpha 0.3 — Pack 03

Pack 03 เพิ่มระบบ Workout Tracking สำหรับฝั่งสมาชิก

## ฟีเจอร์ใหม่

- รายการท่าออกกำลังกายของวัน
- เปิดดูแต่ละท่า
- บันทึก Weight
- บันทึก Reps
- บันทึก RPE
- บันทึกทีละเซต
- เติมน้ำหนักจากเซตก่อนให้อัตโนมัติ
- Rest Timer หลังบันทึกเซต
- ข้ามเวลาพักได้
- Progress ของ Workout
- กลับมาทำต่อได้
- Finish Workout
- Workout Complete Summary
- บันทึก Session ลง Local Storage
- พยายาม Sync Session ไป Firebase
- อัปเดตสถานะสมาชิกให้ Trainer Dashboard ใช้ต่อใน Pack 04

## วิธีติดตั้ง

1. แตกไฟล์ ZIP
2. เลือกไฟล์และโฟลเดอร์ทั้งหมดภายใน
3. อัปโหลดทับไฟล์ใน GitHub Repository `clob`
4. Commit changes
5. รอ Vercel Deploy

## รหัสทดสอบ

### Member
`12345`

### Trainer
PIN `0409`

## วิธีทดสอบ Workout

1. Login ด้วย `12345`
2. กด `เริ่ม Workout`
3. เลือกท่า
4. กรอก KG / REPS / RPE
5. กด `บันทึก`
6. Rest Timer จะเริ่ม
7. ทำครบทุกเซต
8. กลับหน้า Workout Overview
9. กด `Finish Workout`

## Firebase Paths

```text
clob/
  workoutSessions/
    {memberCode}/
      {sessionId}/
  members/
    {memberCode}/
      activity/
      lastWorkoutStatus
      lastWorkoutTitle
      lastWorkoutUpdatedAt
```

## หมายเหตุ

Firebase Rules จาก Pack 01 อนุญาตผู้ใช้ Anonymous ที่ล็อกอินแล้วอ่านและเขียนใต้ `clob` ได้
ก่อนใช้งานจริงกับลูกค้าหลายคน ต้องปรับ Rules ให้จำกัดสิทธิ์ Trainer และ Member แยกกัน

## Pack ถัดไป

Pack 04 — Trainer Dashboard

- จำนวน Members วันนี้
- Completed
- In Progress
- Not Started
- Need Attention
- Package Expiring
- Recent Workout Activity
