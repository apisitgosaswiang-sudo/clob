# Morning Warrior — Recovery Build v1.0

ฐานระบบสำหรับกลับมา Deploy หลังไฟล์ถูกอัปโหลดผิดตำแหน่ง

## โครงสร้างที่รองรับ

- `index.html` อยู่ Root
- JavaScript อยู่ใน `js/`
- CSS อยู่ใน `css/`
- Demo JSON อยู่ใน `data/`
- Firebase Rules อยู่ใน `firebase/`
- Service Worker อยู่ Root

## การแก้สำคัญ

- แก้ `index.html` ให้เป็น HTML จริง
- แก้ CSS และ JavaScript paths
- แก้ syntax error ใน `sw.js`
- ป้องกัน Service Worker ส่ง `index.html` แทนไฟล์ JavaScript ที่หาไม่พบ
- เปลี่ยน cache version เพื่อกำจัด cache เก่า
- เพิ่ม `vercel.json` สำหรับป้องกัน cache ของ entry point

อ่าน `UPLOAD-RECOVERY-GUIDE.md` ก่อนอัปโหลด
