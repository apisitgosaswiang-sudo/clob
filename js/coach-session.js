import { APP_CONFIG } from "./config.js";

const PERSISTENT_SESSION_KEY = "clob_coach_session_v1";
const SESSION_FLAG_KEY = "clob_trainer";
const SESSION_COACH_ID_KEY = "clob_coach_id";

function readPersistentSession() {
  try {
    const value = JSON.parse(localStorage.getItem(PERSISTENT_SESSION_KEY) || "null");
    if (!value || value.coachId !== APP_CONFIG.coachId || value.authenticated !== true) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function writeSessionStorage(coachId) {
  sessionStorage.setItem(SESSION_FLAG_KEY, "true");
  sessionStorage.setItem(SESSION_COACH_ID_KEY, coachId);
}

export function startCoachSession(coachId) {
  const normalizedId = String(coachId || "").trim();
  if (normalizedId !== APP_CONFIG.coachId) return false;

  const value = {
    authenticated: true,
    coachId: normalizedId,
    authenticatedAt: Date.now()
  };
  localStorage.setItem(PERSISTENT_SESSION_KEY, JSON.stringify(value));
  writeSessionStorage(normalizedId);
  return true;
}

export function restoreCoachSession() {
  const value = readPersistentSession();
  if (!value) {
    sessionStorage.removeItem(SESSION_FLAG_KEY);
    sessionStorage.removeItem(SESSION_COACH_ID_KEY);
    return false;
  }
  writeSessionStorage(value.coachId);
  return true;
}

export function isCoachSessionActive() {
  const sessionActive =
    sessionStorage.getItem(SESSION_FLAG_KEY) === "true" &&
    sessionStorage.getItem(SESSION_COACH_ID_KEY) === APP_CONFIG.coachId;
  return sessionActive || restoreCoachSession();
}

export function endCoachSession() {
  localStorage.removeItem(PERSISTENT_SESSION_KEY);
  sessionStorage.removeItem(SESSION_FLAG_KEY);
  sessionStorage.removeItem(SESSION_COACH_ID_KEY);
}
