import { getFirebaseApp } from "./firebase.js";

// AI ช่วยร่างคำติชม Weekly Review
// หลักการประหยัดเครดิต:
//   1. เรียกเฉพาะตอนเทรนเนอร์กดปุ่มเท่านั้น — ไม่มี auto-generate
//   2. cache ผลต่อ check-in หนึ่งอัน กดซ้ำไม่เสียเครดิตเพิ่ม
//   3. ผลลัพธ์เป็นแค่ "ร่าง" เทรนเนอร์ต้องอ่าน/แก้/ยืนยันเองก่อนส่งเสมอ

const CACHE_PREFIX = "clob_ai_draft_";

function cacheKey(memberCode, checkinId) {
  return `${CACHE_PREFIX}${memberCode}_${checkinId}`;
}

export function getCachedDraft(memberCode, checkinId) {
  try {
    const raw = localStorage.getItem(cacheKey(memberCode, checkinId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedDraft(memberCode, checkinId, draft) {
  try {
    localStorage.setItem(cacheKey(memberCode, checkinId), JSON.stringify(draft));
  } catch {
    // เต็มก็ไม่เป็นไร แค่จะเสียเครดิตถ้ากดซ้ำ
  }
}

// สร้างร่างคำติชมจากข้อมูลจริงของสัปดาห์นั้น
export async function draftCoachFeedback({ memberCode, checkin, memberName, stats }) {
  const cached = getCachedDraft(memberCode, checkin.id);
  if (cached) return { ...cached, fromCache: true };

  const {
    getAI,
    getGenerativeModel,
    GoogleAIBackend,
    Schema
  } = await import("https://www.gstatic.com/firebasejs/12.14.0/firebase-ai.js");

  const schema = Schema.object({
    properties: {
      feedback: Schema.string(),
      nextWeekGoal: Schema.string()
    }
  });

  const facts = [
    `ชื่อลูกเทรน: ${memberName || "ลูกเทรน"}`,
    `สัปดาห์: ${checkin.weekStart || "-"}`,
    `ทำ Workout ตามแผน: ${Number(checkin.workoutAdherence || 0)}%`,
    `ทำโภชนาการตามแผน: ${Number(checkin.nutritionAdherence || 0)}%`,
    `การนอน: ${Number(checkin.sleep || 0)}/10`,
    `ความเครียด: ${Number(checkin.stress || 0)}/10`,
    `พลังงาน: ${Number(checkin.energy || 0)}/10`,
    `ความหิว: ${Number(checkin.hunger || 0)}/10`,
    checkin.weight ? `น้ำหนักที่รายงาน: ${checkin.weight} kg` : "",
    stats?.weightChange ? `แนวโน้มน้ำหนัก 30 วัน: ${stats.weightChange} kg` : "",
    stats?.sessionsThisWeek !== undefined ? `จำนวน session ที่ทำสำเร็จสัปดาห์นี้: ${stats.sessionsThisWeek}` : "",
    checkin.wins ? `สิ่งที่ลูกเทรนบอกว่าทำได้ดี: ${checkin.wins}` : "",
    checkin.challenges ? `อุปสรรคที่ลูกเทรนแจ้ง: ${checkin.challenges}` : "",
    checkin.coachQuestion ? `คำถามจากลูกเทรน: ${checkin.coachQuestion}` : ""
  ].filter(Boolean).join("\n");

  const prompt = [
    "คุณเป็นผู้ช่วยของเทรนเนอร์ส่วนตัวชาวไทย ช่วยร่างคำติชมสำหรับรายงานประจำสัปดาห์ของลูกเทรน",
    "เขียนเป็นภาษาไทยที่อบอุ่นแต่ตรงไปตรงมา ใช้ข้อมูลที่ให้มาเท่านั้น ห้ามแต่งตัวเลขหรือข้อเท็จจริงเพิ่ม",
    "feedback: 2-4 ประโยค ชมสิ่งที่ทำได้ดีก่อน แล้วชี้จุดที่ควรปรับอย่างสร้างสรรค์",
    "ถ้ามีคำถามจากลูกเทรน ให้ตอบคำถามนั้นด้วยใน feedback",
    "nextWeekGoal: 1-2 ประโยค เป้าหมายที่ทำได้จริงและวัดผลได้",
    "ห้ามให้คำแนะนำทางการแพทย์ ถ้าข้อมูลบ่งชี้อาการบาดเจ็บหรือปัญหาสุขภาพ ให้แนะนำว่าควรคุยกับเทรนเนอร์หรือแพทย์โดยตรง",
    "นี่เป็นเพียงร่างให้เทรนเนอร์ตรวจสอบและแก้ไข ไม่ใช่ข้อความที่ส่งอัตโนมัติ",
    "",
    "ข้อมูลสัปดาห์นี้:",
    facts
  ].join("\n");

  const ai = getAI(getFirebaseApp(), { backend: new GoogleAIBackend() });
  const model = getGenerativeModel(ai, {
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  const result = await model.generateContent(prompt);
  const parsed = JSON.parse(result.response.text());

  const draft = {
    feedback: String(parsed.feedback || "").trim(),
    nextWeekGoal: String(parsed.nextWeekGoal || "").trim(),
    draftedAt: Date.now()
  };

  if (!draft.feedback) throw new Error("AI ร่างข้อความไม่สำเร็จ ลองอีกครั้ง");

  setCachedDraft(memberCode, checkin.id, draft);
  return { ...draft, fromCache: false };
}
