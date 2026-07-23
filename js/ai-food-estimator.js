import { APP_CONFIG } from "./config.js";
import {
  ensureAppCheckToken,
  getFirebaseApp,
  getFirebaseStatus
} from "./firebase.js";
import {
  cacheAiEstimate,
  getCachedAiEstimate,
  reserveAiAnalysis,
  releaseAiAnalysis
} from "./nutrition.js";

export async function prepareFoodPhoto(file) {
  if (!(file instanceof Blob) || !String(file.type || "").startsWith("image/")) {
    throw createAiError("INVALID_IMAGE", "กรุณาเลือกรูปอาหารประเภท JPG, PNG หรือ WebP");
  }

  const source = await loadImageSource(file);
  const size = contain(source.width, source.height, 1024);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size.width, size.height);
  context.drawImage(source.image, 0, 0, size.width, size.height);
  source.release?.();

  let blob = await canvasToBlob(canvas, "image/webp", 0.72);
  if (!blob || blob.type !== "image/webp") {
    blob = await canvasToBlob(canvas, "image/jpeg", 0.76);
  }
  if (!blob) {
    throw createAiError("IMAGE_PROCESSING_FAILED", "ไม่สามารถเตรียมรูปนี้ได้ กรุณาลองเลือกรูปใหม่");
  }

  return {
    blob,
    previewUrl: URL.createObjectURL(blob),
    fingerprint: await sha256Hex(blob),
    width: size.width,
    height: size.height,
    originalBytes: file.size,
    compressedBytes: blob.size
  };
}

export async function estimateFoodPhoto({
  memberCode,
  selectedDate,
  preparedPhoto
}) {
  if (!APP_CONFIG.aiFoodEstimationEnabled) {
    throw createAiError("AI_DISABLED", "AI ยังไม่เปิดใช้งาน กรุณากรอกข้อมูลอาหารเอง");
  }
  if (!preparedPhoto?.blob || !preparedPhoto?.fingerprint) {
    throw createAiError("IMAGE_REQUIRED", "กรุณาเลือกรูปอาหารก่อนวิเคราะห์");
  }

  const cached = await getCachedAiEstimate(memberCode, preparedPhoto.fingerprint);
  if (cached) {
    return {
      ...sanitizeEstimate(cached),
      fingerprint: preparedPhoto.fingerprint,
      reused: true
    };
  }

  if (APP_CONFIG.aiRequireAppCheck && !APP_CONFIG.appCheckSiteKey) {
    throw createAiError(
      "AI_SETUP_REQUIRED",
      "AI ยังรอการตั้งค่า App Check จึงยังไม่ใช้โควตา กรุณากรอกอาหารเองก่อน"
    );
  }

  const status = getFirebaseStatus();
  if (!status.ready || !getFirebaseApp()) {
    throw createAiError(
      "FIREBASE_UNAVAILABLE",
      "ยังเชื่อมระบบ AI ไม่สำเร็จ กรุณากรอกอาหารเองก่อน"
    );
  }

  let reservation = null;
  try {
    // Verify App Check before reserving the member/project AI quota.
    await ensureAppCheckToken();
    reservation = await reserveAiAnalysis(memberCode, selectedDate);
    if (!reservation.allowed) {
      const message = reservation.reason === "member_limit"
        ? `วันนี้ใช้ AI ครบ ${APP_CONFIG.aiFoodDailyLimitPerMember} ครั้งแล้ว กรุณากรอกข้อมูลอาหารเอง`
        : reservation.reason === "project_limit"
          ? "โควตา AI ทดลองของวันนี้เต็มแล้ว กรุณากรอกข้อมูลอาหารเอง"
          : "ยังตรวจสอบโควตา AI ไม่สำเร็จ กรุณากรอกข้อมูลอาหารเอง";
      throw createAiError("AI_QUOTA", message, { reason: reservation.reason });
    }

    const {
      getAI,
      getGenerativeModel,
      GoogleAIBackend,
      Schema
    } = await import("https://www.gstatic.com/firebasejs/12.14.0/firebase-ai.js");

    const schema = Schema.object({
      properties: {
        name: Schema.string(),
        calories: Schema.number(),
        protein: Schema.number(),
        carbs: Schema.number(),
        fat: Schema.number(),
        confidence: Schema.number(),
        notes: Schema.string(),
        questions: Schema.array({
          items: Schema.string(),
          maxItems: 2
        })
      },
      optionalProperties: ["notes", "questions"]
    });

    const ai = getAI(getFirebaseApp(), { backend: new GoogleAIBackend() });
    const model = getGenerativeModel(ai, {
      model: APP_CONFIG.aiFoodModel,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.2,
        maxOutputTokens: 420
      }
    });

    const imagePart = {
      inlineData: {
        data: await blobToBase64(preparedPhoto.blob),
        mimeType: preparedPhoto.blob.type || "image/jpeg"
      }
    };
    const prompt = [
      "Analyze this single meal photo for a Thai personal-coaching food log.",
      "Estimate the total visible portion for the entire plate or container.",
      "Return a concise Thai food name and estimated total calories, protein grams, carbohydrate grams, and fat grams.",
      "Use non-negative realistic numbers. Confidence must be between 0 and 1.",
      "If cooking oil, sauce, sugar, or portion size is uncertain, mention it briefly in Thai notes.",
      "Ask at most two short Thai clarification questions only when they would materially improve the estimate.",
      "This is an editable estimate, not medical advice."
    ].join(" ");

    const result = await model.generateContent([prompt, imagePart]);
    const parsed = JSON.parse(result.response.text());
    const estimate = sanitizeEstimate({
      ...parsed,
      model: APP_CONFIG.aiFoodModel,
      estimatedAt: Date.now()
    });

    await cacheAiEstimate(memberCode, preparedPhoto.fingerprint, estimate);
    return {
      ...estimate,
      fingerprint: preparedPhoto.fingerprint,
      reused: false
    };
  } catch (error) {
    if (reservation?.allowed) {
      await releaseAiAnalysis(memberCode, selectedDate);
    }
    if (error?.clobCode) throw error;
    console.warn("AI food estimation failed:", error);
    throw createAiError(
      "AI_FAILED",
      friendlyAiError(error),
      { cause: error }
    );
  }
}

export function sanitizeEstimate(value = {}) {
  const questions = Array.isArray(value.questions)
    ? value.questions.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 2)
    : [];
  return {
    name: String(value.name || "อาหารจากรูป").trim().slice(0, 100),
    calories: safeNumber(value.calories),
    protein: safeNumber(value.protein),
    carbs: safeNumber(value.carbs),
    fat: safeNumber(value.fat),
    confidence: Math.max(0, Math.min(1, Number(value.confidence || 0))),
    notes: String(value.notes || "").trim().slice(0, 240),
    questions,
    model: String(value.model || APP_CONFIG.aiFoodModel),
    estimatedAt: Number(value.estimatedAt || Date.now())
  };
}

function friendlyAiError(error) {
  const message = `${String(error?.code || "")} ${String(error?.message || "")}`;
  if (/app.?check|recaptcha|attestation|403|permission/i.test(message)) {
    return "App Check ยังยืนยันเว็บไซต์นี้ไม่สำเร็จ กรุณาปิด–เปิดแอปแล้วลองอีกครั้ง";
  }
  if (/429|quota|rate/i.test(message)) {
    return "โควตา AI ชั่วคราวเต็มแล้ว กรุณากรอกอาหารเอง";
  }
  if (/network|fetch|offline/i.test(message)) {
    return "อินเทอร์เน็ตไม่พร้อมสำหรับ AI กรุณากรอกอาหารเอง";
  }
  return "AI วิเคราะห์รูปนี้ไม่สำเร็จ กรุณากรอกหรือแก้ข้อมูลอาหารเอง";
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.round(parsed * 10) / 10
    : 0;
}

function createAiError(code, message, extra = {}) {
  const error = new Error(message);
  error.clobCode = code;
  Object.assign(error, extra);
  return error;
}

function contain(width, height, maxEdge) {
  const ratio = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio))
  };
}

async function loadImageSource(file) {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close()
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = objectUrl;
  });
  return {
    image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => URL.revokeObjectURL(objectUrl)
  };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function sha256Hex(blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
