// ระบบเตือนสัญญาณผิดปกติ — ใช้การคำนวณธรรมดาทั้งหมด ไม่เรียก AI จึงไม่มีค่าใช้จ่าย
// หลักการ: ระบบแค่ "สะกิดให้เทรนเนอร์ดู" ไม่ตัดสินใจหรือแก้ข้อมูลอะไรเอง

const SAFE_WEEKLY_LOSS_KG = 1.2;

// น้ำหนักลดเร็วเกินเกณฑ์ปลอดภัยต่อเนื่องหลายสัปดาห์
export function detectRapidWeightLoss(checkins) {
  const valid = (checkins || [])
    .filter((item) => item.weight !== "" && Number.isFinite(Number(item.weight)))
    .slice(0, 4);
  if (valid.length < 3) return null;

  const spans = [];
  for (let i = 0; i < valid.length - 1; i += 1) {
    const newer = valid[i];
    const older = valid[i + 1];
    const days = Math.abs(
      (new Date(`${newer.date}T00:00:00`) - new Date(`${older.date}T00:00:00`)) / 86400000
    );
    if (days < 3 || days > 21) continue;
    const perWeek = ((Number(older.weight) - Number(newer.weight)) / days) * 7;
    spans.push(perWeek);
  }

  if (spans.length < 2) return null;
  const rapid = spans.filter((rate) => rate > SAFE_WEEKLY_LOSS_KG);
  if (rapid.length < 2) return null;

  const avg = (rapid.reduce((a, b) => a + b, 0) / rapid.length).toFixed(1);
  return {
    type: "rapid_weight_loss",
    tone: "warning",
    message: `น้ำหนักลดเร็ว ~${avg} kg/สัปดาห์ ต่อเนื่อง — ควรตรวจว่ากินพอไหม`
  };
}

// บันทึกอาหารลดลงอย่างมีนัยสำคัญ (สัญญาณว่าอาจกำลังจะเลิกกลางคัน)
export function detectMealLogDrop(loggedDaysThisWeek, loggedDaysLastWeek) {
  if (loggedDaysLastWeek < 3) return null;
  if (loggedDaysThisWeek >= loggedDaysLastWeek * 0.5) return null;
  return {
    type: "meal_log_drop",
    tone: "warning",
    message: `บันทึกอาหารลดจาก ${loggedDaysLastWeek} เหลือ ${loggedDaysThisWeek} วัน — อาจกำลังถอย`
  };
}

// ทำ workout ไม่ถึงครึ่งของแผนติดต่อกัน 2 สัปดาห์
export function detectLowAdherence(weeklyCheckins) {
  const recent = (weeklyCheckins || []).slice(0, 2);
  if (recent.length < 2) return null;
  const low = recent.filter((item) => Number(item.workoutAdherence || 0) < 50);
  if (low.length < 2) return null;
  return {
    type: "low_adherence",
    tone: "warning",
    message: "ทำ Workout ไม่ถึงครึ่งของแผน 2 สัปดาห์ติด — ควรคุยเรื่องอุปสรรค"
  };
}

// ลูกเทรนข้ามท่าเพราะ "เจ็บ" — เรื่องความปลอดภัย ต้องให้เทรนเนอร์เห็นเร็วที่สุด
// ข้อมูลมาจากปุ่มข้ามท่าที่ลูกเทรนเลือกเหตุผลไว้แล้ว ไม่ต้องกรอกเพิ่ม
export function detectInjuryReports(sessions, days = 7) {
  const cutoff = Date.now() - days * 86400000;
  const reports = [];

  (sessions || []).forEach((session) => {
    const when = Number(session.completedAt || session.updatedAt || 0);
    if (when < cutoff) return;
    (session.exercises || []).forEach((exercise) => {
      if (exercise.skipped && String(exercise.skipReason || "").includes("เจ็บ")) {
        reports.push({ exercise: exercise.name, at: when });
      }
    });
  });

  if (!reports.length) return null;

  const names = [...new Set(reports.map((item) => item.exercise))];
  return {
    type: "injury_report",
    tone: "danger",
    message: `แจ้งเจ็บ/ไม่สบายตัว ข้าม ${names.slice(0, 2).join(", ")}${names.length > 2 ? ` +${names.length - 2}` : ""}`
  };
}

// รวมสัญญาณทั้งหมดของสมาชิกหนึ่งคน
export function detectMemberAlerts({ checkins, weeklyCheckins, sessions, loggedDaysThisWeek, loggedDaysLastWeek }) {
  return [
    // เรื่องเจ็บมาก่อนเสมอ เป็นประเด็นความปลอดภัย
    detectInjuryReports(sessions),
    detectRapidWeightLoss(checkins),
    detectLowAdherence(weeklyCheckins),
    detectMealLogDrop(Number(loggedDaysThisWeek || 0), Number(loggedDaysLastWeek || 0))
  ].filter(Boolean);
}
