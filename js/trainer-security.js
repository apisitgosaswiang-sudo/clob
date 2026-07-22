import { APP_CONFIG } from "./config.js";
import {
  getCoachSecurity,
  registerCoachPinFailure,
  clearCoachPinFailures
} from "./firebase.js";

const PBKDF2_ITERATIONS = 150000;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const LOCAL_STATE_KEY = "clob_coach_security_state";

// Setup PIN is never stored as plain text in the client bundle.
const MASTER_PIN_SALT = "WklvuvVlVywhrn/S0qWqkQ==";
const MASTER_PIN_HASH = "PrbE/3MG+vqx9Hf9trceH7TTKJYKLMt4q9vyZFiqT8w=";

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function derivePinHash(pin) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("อุปกรณ์นี้ไม่รองรับการตรวจสอบ PIN อย่างปลอดภัย");
  }

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: base64ToBytes(MASTER_PIN_SALT),
      iterations: PBKDF2_ITERATIONS
    },
    keyMaterial,
    256
  );

  return bytesToBase64(new Uint8Array(bits));
}

function readLocalState() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STATE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function writeLocalState(value) {
  localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(value));
  return value;
}

export function isValidCoachId(value) {
  return String(value || "").trim() === APP_CONFIG.coachId;
}

export function isValidCoachPin(value) {
  return new RegExp(`^\\d{${APP_CONFIG.coachPinLength}}$`).test(String(value || ""));
}

export async function getCoachSecurityState() {
  const remote = await getCoachSecurity(APP_CONFIG.coachId);
  const local = readLocalState();
  const state = remote || local;
  return {
    failedAttempts: Number(state.failedAttempts || 0),
    lockedUntil: Number(state.lockedUntil || 0)
  };
}

export async function verifyCoachPin(pin) {
  if (!isValidCoachPin(pin)) return { ok: false, reason: "invalid" };

  const state = await getCoachSecurityState();
  if (state.lockedUntil > Date.now()) {
    return { ok: false, reason: "locked", lockedUntil: state.lockedUntil };
  }

  const hash = await derivePinHash(pin);
  if (hash === MASTER_PIN_HASH) {
    writeLocalState({ failedAttempts: 0, lockedUntil: 0, lastSuccessfulLoginAt: Date.now() });
    await clearCoachPinFailures(APP_CONFIG.coachId);
    return { ok: true };
  }

  const localAttempts = Number(state.failedAttempts || 0) + 1;
  const localNext = {
    failedAttempts: localAttempts >= MAX_ATTEMPTS ? 0 : localAttempts,
    lockedUntil: localAttempts >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0,
    lastFailedAt: Date.now()
  };
  writeLocalState(localNext);

  const remote = await registerCoachPinFailure(APP_CONFIG.coachId, {
    maxAttempts: MAX_ATTEMPTS,
    lockMs: LOCK_MS
  });
  const latest = remote || localNext;

  return {
    ok: false,
    reason: Number(latest.lockedUntil || 0) > Date.now() ? "locked" : "invalid",
    lockedUntil: Number(latest.lockedUntil || 0),
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - Number(latest.failedAttempts || 0))
  };
}

export function formatCoachLockTime(timestamp) {
  const remaining = Math.max(0, Number(timestamp || 0) - Date.now());
  return `${Math.max(1, Math.ceil(remaining / 60000))} นาที`;
}
