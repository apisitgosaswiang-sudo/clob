# CLOB Pack10 Data Safety Contract

## Freeze policy
หลัง Pack10 ให้หยุดเพิ่มฟีเจอร์ระหว่าง Beta และแก้เฉพาะ:
1. Critical bug
2. Security issue
3. Data loss / data integrity issue
4. Small UX fix ที่ไม่เปลี่ยน schema

## Protected legacy paths
ห้าม rename, move หรือ delete:
- clob/members
- clob/workoutSessions
- clob/programs
- clob/memberPrograms
- clob/exercises
- clob/progress
- clob/onlineCoaching

## New Pack10 path
- clob/v1/memberExperience

Pack10 ใช้ update แบบ additive และไม่เขียนทับ root object ทั้งก้อน

## Before every deployment
1. เปิด Trainer > Settings > Beta Control
2. Backup สมาชิกที่ได้รับผลกระทบ
3. Export JSON เก็บไว้นอก Firebase
4. Deploy ไป Preview ก่อน Production
5. ทดสอบ Login, Workout, Progress, Check-in และ Backup
6. จึง Promote Production

## Rollback
Rollback ตัวเว็บผ่าน Vercel ไม่ได้ลบข้อมูล Firebase
หาก release มีปัญหา ให้ rollback deployment ก่อน ห้ามรีบแก้ข้อมูลจริง
