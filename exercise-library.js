# Beta Test Checklist

## Member
- Login ด้วยรหัส 5 หลัก
- Today โหลดข้อมูลถูกคน
- เริ่มและบันทึก Workout
- Daily Habits บันทึกและเปิดใหม่ยังอยู่
- Progress แสดงข้อมูลเดิม
- Profile แสดง Member ID ถูกต้อง

## Trainer
- Login
- Members และ Member Detail
- Program Builder
- Exercise Library
- Weekly Check-in / Coach Review
- Trainer Settings
- Beta Control Backup
- Export JSON

## Data Integrity
- ข้อมูลเดิมไม่หายหลัง deploy
- Firebase legacy paths ไม่เปลี่ยน
- Backup ถูกสร้างที่ clob/systemBackups
- Pack10 data อยู่ที่ clob/v1/memberExperience
