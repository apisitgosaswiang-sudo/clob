import { loadExerciseLibrary } from "./exercise-library.js";
import {
  getPrograms,
  saveProgram as saveProgramRemote,
  deleteProgram as deleteProgramRemote,
  assignProgramToMember,
  getMemberProgram,
  removeProgramFromMember
} from "./firebase.js";

const STORAGE_KEY = "clob_programs_v1";
import { normalizeProgram, normalizeProgramMap } from "./data-normalizer.js";

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

let exerciseLibraryCache = [...EXERCISE_LIBRARY];

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
  exerciseLibraryCache = library.length ? library : EXERCISE_LIBRARY;
  return exerciseLibraryCache;
}

export async function loadPrograms() {
  const remote = await getPrograms();

  if (remote !== null) {
    const normalizedRemote = normalizeProgramMap(remote);
    saveProgramsLocal(normalizedRemote);
    return Object.values(normalizedRemote);
  }

  const local = normalizeProgramMap(loadProgramsLocal());
  return Object.values(local);
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
  const copy = JSON.parse(JSON.stringify(normalizeProgram(program)));
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
  program = normalizeProgram(program);
  program.updatedAt = Date.now();

  const local = loadProgramsLocal();
  local[program.id] = program;
  saveProgramsLocal(local);

  const savedRemotely = await saveProgramRemote(program.id, program);
  if (!savedRemotely) {
    throw new Error("บันทึก Program ลง Firebase ไม่สำเร็จ กรุณาตรวจการเชื่อมต่อและ Firebase Rules");
  }
  return program;
}

export async function archiveProgram(program) {
  program.status = "archived";
  return saveProgram(program);
}

export async function restoreProgram(program) {
  program.status = "draft";
  return saveProgram(program);
}

export async function removeProgram(programId) {
  const deletedRemotely = await deleteProgramRemote(programId);
  if (!deletedRemotely) {
    throw new Error("ลบ Program จาก Firebase ไม่สำเร็จ");
  }
  const local = loadProgramsLocal();
  delete local[programId];
  saveProgramsLocal(local);
}

function readLocalAssignment(memberCode) {
  try {
    return JSON.parse(localStorage.getItem(`clob_member_program_${memberCode}`) || "null");
  } catch {
    return null;
  }
}

function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// รองรับข้อมูลเก่าที่เคยเก็บเป็น "1 โปรแกรม/คน" (มี programId ตรงๆ)
// แปลงให้กลายเป็นคิวที่มี 1 รายการ เพื่อไม่ให้ของเดิมพัง
// แต่ละรายการในคิวต้องมี id เฉพาะตัว (เผื่อใช้โปรแกรมเดียวกันซ้ำหลายวัน จะได้แยกกันได้)
// และมี extras[] สำหรับท่าพิเศษที่เทรนเนอร์เพิ่มเฉพาะวันนั้น แยกจากตัวโปรแกรมเอง
function normalizeAssignment(raw) {
  if (!raw) return { queue: [], effectiveDate: "", assignedAt: 0, status: "unassigned" };

  if (Array.isArray(raw.queue)) {
    const queue = raw.queue
      .filter((item) => item && item.programId)
      .map((item) => ({
        id: item.id || uid(),
        programId: item.programId,
        programName: item.programName || "",
        extras: Array.isArray(item.extras) ? item.extras : []
      }));
    return {
      queue,
      effectiveDate: raw.effectiveDate || "",
      assignedAt: Number(raw.assignedAt || 0),
      status: raw.status || (queue.length ? "active" : "unassigned")
    };
  }

  if (raw.programId) {
    return {
      queue: [{ id: uid(), programId: raw.programId, programName: raw.programName || "", extras: [] }],
      effectiveDate: raw.effectiveDate || "",
      assignedAt: Number(raw.assignedAt || 0),
      status: raw.status || "active"
    };
  }

  return { queue: [], effectiveDate: "", assignedAt: 0, status: "unassigned" };
}

export async function loadMemberProgram(memberCode) {
  const remote = await getMemberProgram(memberCode);
  const raw = remote || readLocalAssignment(memberCode);
  const needsIdMigration = Array.isArray(raw?.queue) && raw.queue.some((item) => item && !item.id);
  const normalized = normalizeAssignment(raw);
  localStorage.setItem(`clob_member_program_${memberCode}`, JSON.stringify(normalized));
  if (needsIdMigration && normalized.queue.length) {
    // id ที่เพิ่งสร้างต้องเขียนกลับไปเก็บถาวรทันที ไม่งั้นจะสุ่มใหม่ทุกครั้งที่โหลดหน้า
    // ทำให้ระบบติดตามว่า "ทำวันไหนไปแล้ว" ใช้งานไม่ได้
    assignProgramToMember(memberCode, normalized).catch(() => {});
  }
  return normalized;
}

async function persistQueue(memberCode, queue, effectiveDate) {
  const payload = {
    queue,
    effectiveDate: effectiveDate || new Date().toISOString().slice(0, 10),
    assignedAt: Date.now(),
    status: queue.length ? "active" : "unassigned"
  };

  localStorage.setItem(`clob_member_program_${memberCode}`, JSON.stringify(payload));
  const saved = await assignProgramToMember(memberCode, payload);
  if (!saved) throw new Error("บันทึกคิวโปรแกรมลง Firebase ไม่สำเร็จ");
  return payload;
}

export async function addProgramToQueue(program, memberCode, effectiveDate) {
  const current = normalizeAssignment(await loadMemberProgram(memberCode));
  const queue = [...current.queue, { programId: program.id, programName: program.name }];
  return persistQueue(memberCode, queue, current.effectiveDate || effectiveDate);
}

export async function removeQueueItem(memberCode, index) {
  const current = normalizeAssignment(await loadMemberProgram(memberCode));
  const queue = current.queue.filter((_, i) => i !== index);
  return persistQueue(memberCode, queue, current.effectiveDate);
}

export async function moveQueueItem(memberCode, index, direction) {
  const current = normalizeAssignment(await loadMemberProgram(memberCode));
  const queue = [...current.queue];
  const target = index + direction;
  if (target < 0 || target >= queue.length) return current;
  [queue[index], queue[target]] = [queue[target], queue[index]];
  return persistQueue(memberCode, queue, current.effectiveDate);
}

export async function unassignProgram(memberCode) {
  const removed = await removeProgramFromMember(memberCode);
  if (!removed) throw new Error("นำ Program ออกจากสมาชิกไม่สำเร็จ");
  localStorage.removeItem(`clob_member_program_${memberCode}`);
  return true;
}

// เพิ่มท่าออกกำลังกายพิเศษให้เฉพาะ "วัน" นั้นๆ ในคิว แยกต่างหากจากตัวโปรแกรมหลัก
// (โปรแกรมหลักยังใช้ซ้ำกับสมาชิกคนอื่นได้ปกติ ไม่ถูกแก้ไข)
export async function addExtraToQueueItem(memberCode, queueIndex, exercise) {
  const current = normalizeAssignment(await loadMemberProgram(memberCode));
  const queue = current.queue.map((item, index) => {
    if (index !== queueIndex) return item;
    const extra = {
      id: uid(),
      exerciseId: exercise.id,
      name: exercise.name,
      sets: exercise.sets || 3,
      reps: exercise.reps || "10",
      weight: exercise.weight || "",
      restMinutes: exercise.restMinutes || "",
      notes: exercise.notes || ""
    };
    return { ...item, extras: [...(item.extras || []), extra] };
  });
  return persistQueue(memberCode, queue, current.effectiveDate);
}

export async function removeExtraFromQueueItem(memberCode, queueIndex, extraId) {
  const current = normalizeAssignment(await loadMemberProgram(memberCode));
  const queue = current.queue.map((item, index) => {
    if (index !== queueIndex) return item;
    return { ...item, extras: (item.extras || []).filter((extra) => extra.id !== extraId) };
  });
  return persistQueue(memberCode, queue, current.effectiveDate);
}

export function addDay(program) {
  program.days = Array.isArray(program.days) ? program.days : [];
  const index = program.days.length + 1;
  program.days.push({
    id: `day-${Date.now()}`,
    name: `Day ${index}`,
    exercises: []
  });
  return program;
}

export function removeDay(program, dayId) {
  program.days = Array.isArray(program.days) ? program.days : [];
  if (program.days.length <= 1) return program;
  program.days = program.days.filter((day) => day.id !== dayId);
  return program;
}

export function addExercise(program, dayId, exerciseId) {
  const day = program.days.find((item) => item.id === dayId);
  const base = exerciseLibraryCache.find((item) => item.id === exerciseId) || EXERCISE_LIBRARY.find((item) => item.id === exerciseId);
  if (!day || !base) return program;

  day.exercises = Array.isArray(day.exercises) ? day.exercises : [];
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
  day.exercises = (Array.isArray(day.exercises) ? day.exercises : []).filter((item) => item.uid !== exerciseUid);
  return program;
}

export function moveExercise(program, dayId, exerciseUid, direction) {
  const day = program.days.find((item) => item.id === dayId);
  if (!day) return program;

  day.exercises = Array.isArray(day.exercises) ? day.exercises : [];
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
  return (Array.isArray(program?.days) ? program.days : []).reduce(
    (total, day) => total + (Array.isArray(day?.exercises) ? day.exercises.length : 0),
    0
  );
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
