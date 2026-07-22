import { cleanCoachName } from "./utils.js";

const STORAGE_KEY = "clob_trainer_profile";

const DEFAULT_PROFILE = {
  name: "First",
  displayName: "Coach First",
  profilePhoto: "",
  email: "",
  timezone: "Asia/Bangkok"
};

export function getTrainerProfile() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const merged = { ...DEFAULT_PROFILE, ...stored };
    merged.name = cleanCoachName(
      merged.name || merged.displayName || DEFAULT_PROFILE.name,
      DEFAULT_PROFILE.name
    );
    merged.displayName = `Coach ${merged.name}`;
    return merged;
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveTrainerProfile(profile) {
  const name = cleanCoachName(
    profile?.name || profile?.displayName || DEFAULT_PROFILE.name,
    DEFAULT_PROFILE.name
  );

  const value = {
    ...DEFAULT_PROFILE,
    ...profile,
    name,
    displayName: `Coach ${name}`
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  return value;
}
