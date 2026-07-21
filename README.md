# CLOB Alpha 0.8 — Pack 08 Part 2

ระบบ Check-in และ Progress Timeline สำหรับสมาชิก

## Features

- Weight
- Body Fat
- Skeletal Muscle
- Chest
- Waist
- Hip
- Arm
- Thigh
- Note
- Add Check-in
- Edit Check-in
- Delete Check-in
- Latest metrics
- Change from first entry
- Progress Timeline
- Realtime Database sync
- Local Storage fallback
- เชื่อมหน้า Photos จาก Part 1

## วิธีเข้าใช้งาน

1. Trainer Login
2. Members
3. เลือกสมาชิก
4. กดแท็บ `Progress`
5. กด `+`
6. กรอกข้อมูล
7. กด `Save`

## Realtime Database Path

```text
clob/
  progress/
    {memberCode}/
      checkins/
        {checkinId}/
          date
          weight
          bodyFat
          skeletalMuscle
          chest
          waist
          hip
          arm
          thigh
          note
```

## Install

แตก ZIP แล้วอัปโหลดไฟล์ทั้งหมดทับ Pack08 Part 1 จากนั้น Commit และรอ Vercel Deploy

หากยังเห็นไฟล์เก่า ให้ Hard Refresh หรือเปิด Incognito

## Pack 08 Part 3

- Charts
- Before / After
- PR Tracker
- Adherence
- UI polish
