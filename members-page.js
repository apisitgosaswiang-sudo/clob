import { loadExerciseLibrary } from "./exercise-library.js";
import {
  getPrograms,
  saveProgram as saveProgramRemote,
  deleteProgram as deleteProgramRemote,
  assignProgramToMember
} from "./firebase.js";

const STORAGE_KEY = "clob_programs_v1";

const EXERCISE_LIBRARY = [
  { id: "goblet-squat", name: "Goblet Squat", category: "Squat", equipment: "Dumbbell" },
  { id: "db-rdl", name: "DB Romanian Deadlift", category: "Hinge", equipment: "Dumbbell" },
  { id: "push-up", name: "Push-up", category: "Push", equipment: "Bodyweight" },
  { id: "db-bench-press", name: "DB Bench Press", category: "Push", equipment: "Dumbbell" },
  { id: "seated-cable-row", name: "Seated Cable Row", category: "Pull", equipment: "Cable" },
  { id: "lat-pulldown", name: "Lat Pulldown", category: "Pull", equipment: "Cable" },
  { id: "plank", name: "Plank", category: "Core", equipment: "Bodyweight" },
  { id: "dead-bug", name: "Dead Bug", category: "Core", equipment: "Bodyweight" },
  { id: "walking-lunge", name: "Walking Lunge", category: "Lunge", equipment: "Bodyweight" },
  { id: "hip-thrust", name: "Hip Thrust", category: "Glute", equipment: "Bench" },
  { id: "shoulder-press", name: "DB Shoulder Press", category: "Push", equipment: "Dumbbell" },
  { id: "face-pull", name: "Face Pull", category: "Pull", equipment: "Cable" }
];

const DEMO_PROGRAMS = {
  "program-upper-lower": {
    id: "program-upper-lower",
    name: "Upper / Lower 4 Days",
    goal: "Strength & Muscle",
    level: "Intermediate",
    status: "active",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 8,
    updatedAt: Date.now() - 1000 * 60 * 60 * 3,
    days: [
      {
        id: "day-1",
        name: "Day 1 — Upper A",
        exercises: [
          makeExercise("db-bench-press", 3, "8-10", 10, 8, 90, "คุมช่วงลง 2 วินาที"),
          makeExercise("seated-cable-row", 3, "10-12", 25, 8, 75, "บีบสะบักท้ายจังหวะ"),
          makeExercise("shoulder-press", 3, "10", 8, 8, 75, "")
        ]
      },
      {
        id: "day-2",
        name: "Day 2 — Lower A",
        exercises: [
          makeExercise("goblet-squat", 4, "10", 14, 8, 90, ""),
          makeExercise("db-rdl", 3, "10", 16, 8, 90, ""),
          makeExercise("walking-lunge", 3, "12/ข้าง", 0, 8, 75, "")
        ]
      }
    ]
  },
  "program-beginner-fullbody": {
    id: "program-beginner-fullbody",
    name: "Beginner Full Body",
    goal: "General Fitness",
    level: "Beginner",
    status: "draft",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    updatedAt: Date.now() - 1000 * 60 * 50,
    days: [
      {
        id: "day-1",
        name: "Day 1 — Full Body",
        exercises: [
          makeExercise("goblet-squat", 3, "10", 8, 7, 90, ""),
          makeExercise("push-up", 3, "8-12", 0, 7, 75, ""),
          makeExercise("seated-cable-row", 3, "12", 20, 7, 75, ""),
          makeExercise("dead-bug", 3, "10/ข้าง", 0, 7, 60, "")
        ]
      }
    ]
  }
};

function makeExercise(id, sets, reps, weight, rpe, rest, notes) {
  const base = EXERCISE_LIBRARY.find((item) => item.id === id);
  return {
    uid: `${id}-${Math.random().toString(36).slice(2, 8)}`,
    exerciseId: id,
    name: base?.name || id,
    category: base?.category || "Other",
    sets,
    reps,
    weight,
    rpe,
    tempo: "2-0-1",
    rest,
    notes
  };
}

export async function getExerciseLibrary() {
  const library = await loadExerciseLibrary();
  return library.length ? library : EXERCISE_LIBRARY;
}

export async function loadPrograms() {
  const remote = await getPrograms();
  if (remote) {
    saveProgramsLocal(remote);
    return Object.values(remote);
  }

  const local = loadProgramsLocal();
  if (Object.keys(local).length) return Object.values(local);

  saveProgramsLocal(DEMO_PROGRAMS);
  return Object.values(DEMO_PROGRAMS);
}

export function createBlankProgram() {
  const now = Date.now();
  return {
    id: `program-${now}`,
    name: "New Program",
    goal: "General Fitness",
    level: "Beginner",
    status: "draft",
    createdAt: now,
    updatedAt: now,
    days: [
      {
        id: `day-${now}`,
        name: "Day 1",
        exercises: []
      }
    ]
  };
}

export function duplicateProgram(program) {
  const copy = JSON.parse(JSON.stringify(program));
  const now = Date.now();

  copy.id = `program-${now}`;
  copy.name = `${program.name} Copy`;
  copy.status = "draft";
  copy.createdAt = now;
  copy.updatedAt = now;
  copy.days = copy.days.map((day, dayIndex) => ({
    ...day,
    id: `day-${now}-${dayIndex}`,
    exercises: day.exercises.map((exercise) => ({
      ...exercise,
      uid: `${exercise.exerciseId}-${Math.random().toString(36).slice(2, 8)}`
    }))
  }));

  return copy;
}

export async function saveProgram(program) {
  program.updatedAt = Date.now();

  const local = loadProgramsLocal();
  local[program.id] = program;
  saveProgramsLocal(local);

  await saveProgramRemote(program.id, program);
  return program;
}

export async function archiveProgram(program) {
  program.status = "archived";
  return saveProgram(program);
}

export async function removeProgram(programId) {
  const local = loadProgramsLocal();
  delete local[programId];
  saveProgramsLocal(local);
  await deleteProgramRemote(programId);
}

export async function assignProgram(program, memberCode, effectiveDate) {
  const payload = {
    programId: program.id,
    programName: program.name,
    effectiveDate,
    assignedAt: Date.now(),
    status: "active"
  };

  localStorage.setItem(
    `clob_member_program_${memberCode}`,
    JSON.stringify(payload)
  );

  await assignProgramToMember(memberCode, payload);
  return payload;
}

export function addDay(program) {
  const index = program.days.length + 1;
  program.days.push({
    id: `day-${Date.now()}`,
    name: `Day ${index}`,
    exercises: []
  });
  return program;
}

export function removeDay(program, dayId) {
  if (program.days.length <= 1) return program;
  program.days = program.days.filter((day) => day.id !== dayId);
  return program;
}

export function addExercise(program, dayId, exerciseId) {
  const day = program.days.find((item) => item.id === dayId);
  const base = EXERCISE_LIBRARY.find((item) => item.id === exerciseId);
  if (!day || !base) return program;

  day.exercises.push({
    uid: `${exerciseId}-${Math.random().toString(36).slice(2, 8)}`,
    exerciseId,
    name: base.name,
    category: base.category,
    sets: 3,
    reps: "10",
    weight: 0,
    rpe: 8,
    tempo: "2-0-1",
    rest: 90,
    notes: ""
  });

  return program;
}

export function removeExercise(program, dayId, exerciseUid) {
  const day = program.days.find((item) => item.id === dayId);
  if (!day) return program;
  day.exercises = day.exercises.filter((item) => item.uid !== exerciseUid);
  return program;
}

export function moveExercise(program, dayId, exerciseUid, direction) {
  const day = program.days.find((item) => item.id === dayId);
  if (!day) return program;

  const index = day.exercises.findIndex((item) => item.uid === exerciseUid);
  if (index < 0) return program;

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= day.exercises.length) return program;

  [day.exercises[index], day.exercises[target]] = [
    day.exercises[target],
    day.exercises[index]
  ];

  return program;
}

export function countProgramExercises(program) {
  return program.days.reduce((total, day) => total + day.exercises.length, 0);
}

function loadProgramsLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveProgramsLocal(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}
