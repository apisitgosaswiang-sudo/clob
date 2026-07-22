import { APP_CONFIG } from "./config.js";
import { getCoachRecord, saveCoachRecord } from "./firebase.js";
import { cleanCoachName } from "./utils.js";

const STORAGE_KEY = "clob_trainer_profile";

const DEFAULT_PROFILE = {
  coachId: APP_CONFIG.coachId,
  name: "First",
  displayName: "Coach First",
  role: "Master Coach",
  profilePhoto: "",
  email: "",
  timezone: "Asia/Bangkok"
};

function normalizeProfile(profile = {}) {
  const name = cleanCoachName(
    profile.name || profile.displayName || DEFAULT_PROFILE.name,
    DEFAULT_PROFILE.name
  );

  return {
    ...DEFAULT_PROFILE,
    ...profile,
    coachId: APP_CONFIG.coachId,
    name,
    displayName: `Coach ${name}`
  };
}

export function getTrainerProfile() {
  try {
    return normalizeProfile(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export async function loadTrainerProfile() {
  const local = getTrainerProfile();
  const remote = await getCoachRecord(APP_CONFIG.coachId);
  if (!remote) return local;

  const merged = normalizeProfile({ ...local, ...remote });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

export async function saveTrainerProfile(profile) {
  const value = normalizeProfile({ ...getTrainerProfile(), ...profile });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));

  await saveCoachRecord(APP_CONFIG.coachId, {
    coachId: APP_CONFIG.coachId,
    name: value.name,
    displayName: value.displayName,
    role: value.role,
    profilePhoto: value.profilePhoto || "",
    email: value.email || "",
    timezone: value.timezone,
    updatedAt: Date.now()
  });

  return value;
}
