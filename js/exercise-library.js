import {
  getExercises,
  saveExercise as saveExerciseRemote,
  deleteExercise as deleteExerciseRemote,
  getExercisePreferences,
  saveExercisePreferences
} from "./firebase.js";

const STORAGE_KEY = "clob_exercises_v3_custom";
const LEGACY_STORAGE_KEY = "clob_exercises_v2";
const PREFS_KEY = "clob_exercise_prefs_v1";

export const EXERCISE_CATEGORIES = [
  "Squat", "Hinge", "Push", "Pull", "Lunge", "Core",
  "Carry", "Rotation", "Isolation", "Mobility", "Cardio"
];

const SEED_EXERCISES = [
  seed("goblet-squat", "Goblet Squat", "Squat", "Quadriceps", ["Glutes","Core"], "Dumbbell", "Beginner", "Hold the dumbbell close. Keep the chest tall."),
  seed("back-squat", "Back Squat", "Squat", "Quadriceps", ["Glutes","Core"], "Barbell", "Intermediate", "Brace before each rep. Keep the bar over mid-foot."),
  seed("front-squat", "Front Squat", "Squat", "Quadriceps", ["Upper Back","Core"], "Barbell", "Advanced", "Keep elbows high. Sit between the hips."),
  seed("db-rdl", "DB Romanian Deadlift", "Hinge", "Hamstrings", ["Glutes","Back"], "Dumbbell", "Beginner", "Push the hips back. Keep the weights close."),
  seed("barbell-rdl", "Barbell Romanian Deadlift", "Hinge", "Hamstrings", ["Glutes","Back"], "Barbell", "Intermediate", "Move from the hips. Stop before the back rounds."),
  seed("hip-thrust", "Hip Thrust", "Hinge", "Glutes", ["Hamstrings"], "Barbell", "Beginner", "Finish with the ribs down. Pause at the top."),
  seed("push-up", "Push-up", "Push", "Chest", ["Triceps","Shoulders"], "Bodyweight", "Beginner", "Keep one straight line. Lower with control."),
  seed("db-bench-press", "DB Bench Press", "Push", "Chest", ["Triceps","Shoulders"], "Dumbbell", "Beginner", "Keep wrists stacked. Control the bottom."),
  seed("shoulder-press", "DB Shoulder Press", "Push", "Shoulders", ["Triceps","Core"], "Dumbbell", "Beginner", "Keep ribs down. Press overhead smoothly."),
  seed("seated-cable-row", "Seated Cable Row", "Pull", "Back", ["Biceps","Rear Delts"], "Cable", "Beginner", "Lead with the elbows. Pause at the body."),
  seed("lat-pulldown", "Lat Pulldown", "Pull", "Lats", ["Biceps","Upper Back"], "Cable", "Beginner", "Pull elbows down. Avoid leaning back."),
  seed("face-pull", "Face Pull", "Pull", "Rear Delts", ["Upper Back"], "Cable", "Beginner", "Pull toward the eyes. Rotate the hands back."),
  seed("walking-lunge", "Walking Lunge", "Lunge", "Quadriceps", ["Glutes","Core"], "Bodyweight", "Beginner", "Take a stable step. Keep the front heel down."),
  seed("reverse-lunge", "Reverse Lunge", "Lunge", "Glutes", ["Quadriceps","Core"], "Dumbbell", "Beginner", "Step back softly. Drive through the front foot."),
  seed("plank", "Plank", "Core", "Core", ["Shoulders","Glutes"], "Bodyweight", "Beginner", "Squeeze the glutes. Keep the ribs down."),
  seed("dead-bug", "Dead Bug", "Core", "Core", ["Hip Flexors"], "Bodyweight", "Beginner", "Keep the lower back down. Move slowly."),
  seed("pallof-press", "Pallof Press", "Rotation", "Core", ["Shoulders"], "Cable", "Beginner", "Do not let the torso rotate."),
  seed("farmer-carry", "Farmer Carry", "Carry", "Grip", ["Core","Traps"], "Dumbbell", "Beginner", "Walk tall. Keep the weights quiet."),
  seed("biceps-curl", "DB Biceps Curl", "Isolation", "Biceps", ["Forearms"], "Dumbbell", "Beginner", "Keep elbows still. Avoid swinging."),
  seed("triceps-pushdown", "Triceps Pushdown", "Isolation", "Triceps", [], "Cable", "Beginner", "Lock the elbows by the body."),
  seed("thoracic-rotation", "Thoracic Rotation", "Mobility", "Upper Back", ["Shoulders"], "Bodyweight", "Beginner", "Move from the upper back. Breathe out."),
  seed("incline-walk", "Incline Walk", "Cardio", "Cardiovascular", ["Glutes","Calves"], "Treadmill", "Beginner", "Use a pace you can sustain.")
];

function seed(id, name, category, primaryMuscle, secondaryMuscles, equipment, difficulty, coachTip) {
  return {
    id, name, category, primaryMuscle, secondaryMuscles,
    equipment, difficulty, coachTip,
    videoUrl: "", gifUrl: "", notes: "",
    builtIn: true, createdAt: 1, updatedAt: 1
  };
}

export async function loadExerciseLibrary() {
  // Core exercises are bundled with the app and are never replaced by Firebase.
  // Firebase/localStorage contains only trainer-created custom exercises.
  const core = Object.fromEntries(SEED_EXERCISES.map((item) => [item.id, item]));
  const remote = await getExercises();

  if (remote && typeof remote === "object") {
    const custom = normalizeCustomExercises(remote);
    saveLocal(custom);
    return [...Object.values(core), ...Object.values(custom)];
  }

  const custom = loadLocal();
  return [...Object.values(core), ...Object.values(custom)];
}

export async function saveExercise(exercise) {
  if (exercise?.builtIn) {
    throw new Error("Core exercises are read-only.");
  }

  const value = {
    ...exercise,
    id: exercise.id || createExerciseId(exercise.name),
    builtIn: false,
    updatedAt: Date.now(),
    createdAt: exercise.createdAt || Date.now()
  };

  const local = loadLocal();
  local[value.id] = value;
  saveLocal(local);
  const savedRemotely = await saveExerciseRemote(value.id, value);
  if (!savedRemotely) {
    console.warn("Exercise saved locally because Firebase was unavailable.");
  }
  return value;
}

export async function removeExercise(exerciseId) {
  if (SEED_EXERCISES.some((item) => item.id === exerciseId)) {
    throw new Error("Core exercises cannot be deleted.");
  }
  const local = loadLocal();
  delete local[exerciseId];
  saveLocal(local);
  await deleteExerciseRemote(exerciseId);
}

export function createBlankExercise() {
  return {
    id: "",
    name: "",
    category: "Squat",
    primaryMuscle: "",
    secondaryMuscles: [],
    equipment: "Bodyweight",
    difficulty: "Beginner",
    coachTip: "",
    videoUrl: "",
    gifUrl: "",
    notes: "",
    builtIn: false
  };
}

export async function loadExercisePrefs() {
  const remote = await getExercisePreferences();
  if (remote) {
    localStorage.setItem(PREFS_KEY, JSON.stringify(remote));
    return normalizePrefs(remote);
  }
  try {
    return normalizePrefs(JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"));
  } catch {
    return normalizePrefs({});
  }
}

export async function toggleFavorite(exerciseId) {
  const prefs = await loadExercisePrefs();
  prefs.favorites[exerciseId] = !prefs.favorites[exerciseId];
  if (!prefs.favorites[exerciseId]) delete prefs.favorites[exerciseId];
  await persistPrefs(prefs);
  return prefs;
}

export async function markExerciseRecent(exerciseId) {
  const prefs = await loadExercisePrefs();
  prefs.recent = [exerciseId, ...prefs.recent.filter((id) => id !== exerciseId)].slice(0, 12);
  await persistPrefs(prefs);
  return prefs;
}

export function filterExercises(exercises, { query = "", category = "All", tab = "All", prefs }) {
  const q = query.trim().toLowerCase();
  return exercises.filter((exercise) => {
    const text = [
      exercise.name, exercise.category, exercise.primaryMuscle,
      exercise.equipment, ...(exercise.secondaryMuscles || [])
    ].join(" ").toLowerCase();

    if (q && !text.includes(q)) return false;
    if (category !== "All" && exercise.category !== category) return false;
    if (tab === "Favorites" && !prefs.favorites[exercise.id]) return false;
    if (tab === "Recent" && !prefs.recent.includes(exercise.id)) return false;
    return true;
  }).sort((a, b) => {
    if (tab === "Recent") return prefs.recent.indexOf(a.id) - prefs.recent.indexOf(b.id);
    return a.name.localeCompare(b.name);
  });
}

export function createExerciseId(name) {
  const base = String(name || "exercise")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9ก-๙]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "exercise"}-${Date.now().toString(36)}`;
}

function normalizePrefs(value) {
  return {
    favorites: value?.favorites || {},
    recent: Array.isArray(value?.recent) ? value.recent : []
  };
}

async function persistPrefs(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  await saveExercisePreferences(prefs);
}

function normalizeCustomExercises(value) {
  return Object.fromEntries(
    Object.entries(value || {}).filter(([, exercise]) => exercise && !exercise.builtIn)
  );
}

function loadLocal() {
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (Object.keys(current).length) return normalizeCustomExercises(current);

    // One-time recovery from the previous cache. Remove bundled core records and
    // retain only trainer-created exercises so older users do not lose custom work.
    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "{}");
    const migrated = normalizeCustomExercises(legacy);
    if (Object.keys(migrated).length) saveLocal(migrated);
    return migrated;
  } catch {
    return {};
  }
}

function saveLocal(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeCustomExercises(value)));
}
