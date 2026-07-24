import {
  getMemberByCode,
  saveMemberActivity,
  saveWorkoutSession,
  deleteWorkoutSession,
  getMemberProgram,
  getPrograms,
  getMemberWorkoutSessions
} from "./firebase.js";
import { loadExerciseLibrary } from "./exercise-library.js";

const DEMO_MEMBERS = {
  "12345": {
    code: "12345",
    name: "Apisit",
    greetingName: "Apisit",
    coachName: "Coach A",
    coachMessage: "วันนี้เน้นฟอร์ม ไม่ต้องรีบ พักเซตละ 90 วินาที 💪",
    workout: {
      id: "upper-body-a",
      title: "Upper Body A",
      duration: 45,
      exercises: 6,
      status: "ready",
      exerciseList: [
        {
          id: "goblet-squat",
          name: "Goblet Squat",
          category: "Squat",
          targetSets: 3,
          targetReps: "10",
          restSeconds: 90,
          defaultWeight: 12,
          note: "เข่าตามแนวปลายเท้า ลำตัวตั้ง"
        },
        {
          id: "db-bench-press",
          name: "DB Bench Press",
          category: "Push",
          targetSets: 3,
          targetReps: "10-12",
          restSeconds: 90,
          defaultWeight: 10,
          note: "คุมช่วงลง ไม่เด้งดัมเบล"
        },
        {
          id: "seated-cable-row",
          name: "Seated Cable Row",
          category: "Pull",
          targetSets: 3,
          targetReps: "12",
          restSeconds: 75,
          defaultWeight: 25,
          note: "ดึงศอกไปด้านหลัง ไม่ยกไหล่"
        },
        {
          id: "db-rdl",
          name: "DB Romanian Deadlift",
          category: "Hinge",
          targetSets: 3,
          targetReps: "10",
          restSeconds: 90,
          defaultWeight: 14,
          note: "ดันสะโพกไปด้านหลัง หลังเป็นกลาง"
        },
        {
          id: "push-up",
          name: "Push-up",
          category: "Push",
          targetSets: 3,
          targetReps: "AMRAP",
          restSeconds: 75,
          defaultWeight: 0,
          note: "เกร็งลำตัว รักษาแนวศีรษะถึงส้นเท้า"
        },
        {
          id: "plank",
          name: "Plank",
          category: "Core",
          targetSets: 3,
          targetReps: "30 sec",
          restSeconds: 60,
          defaultWeight: 0,
          note: "เก็บซี่โครง ไม่แอ่นหลัง"
        }
      ]
    },
    week: { completed: 2, target: 3 },
    weight: { current: 78.2, change: -0.8, unit: "kg" },
    package: { daysLeft: 18, totalSessions: 12, sessionsLeft: 7 },
    nextSession: { label: "ครั้งถัดไป", date: "พฤหัสบดี", time: "18:30" }
  }
};

const DEFAULT_EXERCISES = [
  {
    id: "goblet-squat",
    name: "Goblet Squat",
    category: "Squat",
    targetSets: 3,
    targetReps: "10",
    restSeconds: 90,
    defaultWeight: 10,
    note: "คุมฟอร์มและจังหวะ"
  },
  {
    id: "push-up",
    name: "Push-up",
    category: "Push",
    targetSets: 3,
    targetReps: "10",
    restSeconds: 75,
    defaultWeight: 0,
    note: "เกร็งลำตัวตลอดเซต"
  },
  {
    id: "seated-cable-row",
    name: "Seated Cable Row",
    category: "Pull",
    targetSets: 3,
    targetReps: "12",
    restSeconds: 75,
    defaultWeight: 20,
    note: "คุมสะบักและไม่ยกไหล่"
  }
];

const DEFAULT_MEMBER = {
  name: "Member",
  greetingName: "Member",
  coachName: "Coach",
  coachMessage: "พร้อมเริ่มการฝึกวันนี้แล้วหรือยัง?",
  workout: {
    id: "today-workout",
    title: "Today's Workout",
    duration: 45,
    exercises: DEFAULT_EXERCISES.length,
    status: "ready",
    exerciseList: DEFAULT_EXERCISES
  },
  week: { completed: 0, target: 3 },
  weight: { current: 0, change: 0, unit: "kg" },
  package: { daysLeft: 0, totalSessions: 0, sessionsLeft: 0 },
  nextSession: { label: "ครั้งถัดไป", date: "ยังไม่กำหนด", time: "" }
};

export async function loadMember(code) {
  const [remote, assignment, programs, remoteSessions, exerciseLibrary] = await Promise.all([
    getMemberByCode(code),
    getMemberProgram(code),
    getPrograms(),
    getMemberWorkoutSessions(code),
    loadExerciseLibrary()
  ]);
  const source = remote || DEMO_MEMBERS[code] || DEFAULT_MEMBER;
  const active = resolveActiveProgram(assignment, programs, remoteSessions);
  if (active) {
    source.workout = programToWorkout(active.program, active.queueItem, assignment, remoteSessions, exerciseLibrary);
  }
  return normalizeMember(code, source);
}

// เลือก "วันที่ควรทำถัดไป" จากคิวโปรแกรมของสมาชิก (เช่น Day 1 Upper > Day 2 Full Body > Day 3 Legs)
// โดยดูจาก session ล่าสุดที่ทำสำเร็จของ "ตำแหน่งคิว" ไหน (ไม่ใช่แค่ programId เฉยๆ
// เพราะโปรแกรมเดียวกันอาจถูกใส่ซ้ำหลายวันในคิวได้ แต่ละวันต้องแยกกันได้)
// แล้วขยับไปวันถัดไป ถ้ายังไม่เคยทำเลย เริ่มจากวันแรกในคิวเสมอ
function resolveActiveProgram(assignment, programs, remoteSessions) {
  if (assignment?.status !== "active") return null;

  const queue = Array.isArray(assignment?.queue) ? assignment.queue : [];
  const validQueue = queue.filter((item) => item?.programId && item?.id && programs?.[item.programId]);
  if (!validQueue.length) return null;
  if (validQueue.length === 1) return { program: programs[validQueue[0].programId], queueItem: validQueue[0] };

  const completed = Object.values(remoteSessions || {})
    .filter((item) => item
      && item.status === "completed"
      && typeof item.workoutId === "string"
      && validQueue.some((entry) => item.workoutId.startsWith(`${entry.id}:`)))
    .sort((a, b) => Number(b.completedAt || b.updatedAt || 0) - Number(a.completedAt || a.updatedAt || 0));

  const lastCompleted = completed[0];
  if (!lastCompleted) return { program: programs[validQueue[0].programId], queueItem: validQueue[0] };

  const lastQueueItemId = lastCompleted.workoutId.split(":")[0];
  const lastIndex = validQueue.findIndex((entry) => entry.id === lastQueueItemId);
  if (lastIndex === -1) return { program: programs[validQueue[0].programId], queueItem: validQueue[0] };

  const nextIndex = (lastIndex + 1) % validQueue.length;
  return { program: programs[validQueue[nextIndex].programId], queueItem: validQueue[nextIndex] };
}

// เลือกวันถัดไปภายในโปรแกรมเดียว (เผื่อโปรแกรมไหนมีมากกว่า 1 วัน)
// ปกติแล้วแต่ละโปรแกรมในคิวจะมีวันเดียว ฟังก์ชันนี้จึงมักคืนวันแรกเสมอ
function pickNextDay(queueItem, days, remoteSessions) {
  if (days.length <= 1) return days[0];

  const prefix = `${queueItem.id}:`;
  const completed = Object.values(remoteSessions || {})
    .filter((item) => item
      && item.status === "completed"
      && typeof item.workoutId === "string"
      && item.workoutId.startsWith(prefix))
    .sort((a, b) => Number(b.completedAt || b.updatedAt || 0) - Number(a.completedAt || a.updatedAt || 0));

  const lastCompleted = completed[0];
  if (!lastCompleted) return days[0];

  const lastDayId = lastCompleted.workoutId.slice(prefix.length);
  const lastIndex = days.findIndex((day) => day.id === lastDayId);
  if (lastIndex === -1) return days[0];

  return days[(lastIndex + 1) % days.length];
}

function isSameCalendarDay(a, b) {
  const d1 = new Date(Number(a || 0));
  const d2 = new Date(Number(b || 0));
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function programToWorkout(program, queueItem, assignment, remoteSessions, exerciseLibrary) {
  const days = Array.isArray(program.days) ? program.days : [];
  const day = pickNextDay(queueItem, days, remoteSessions) || days[0] || { id: program.id, name: program.name, exercises: [] };
  const libraryMap = Object.fromEntries((exerciseLibrary || []).map((item) => [item.id, item]));
  const workoutId = `${queueItem.id}:${day.id}`;
  const alreadyCompletedToday = Object.values(remoteSessions || {}).some((item) =>
    item
    && item.workoutId === workoutId
    && item.status === "completed"
    && isSameCalendarDay(item.completedAt, Date.now())
  );

  const baseExercises = (day.exercises || []).map((exercise) => ({
    id: exercise.uid || exercise.exerciseId,
    name: exercise.name,
    category: exercise.category || "Other",
    targetSets: Number(exercise.sets || 3),
    targetReps: String(exercise.reps || "10"),
    restSeconds: Number(exercise.rest || 90),
    defaultWeight: Number(exercise.weight || 0),
    note: exercise.notes || "",
    imageUrl: libraryMap[exercise.exerciseId]?.imageUrl || "",
    isExtra: false
  }));

  // ท่าพิเศษที่เทรนเนอร์เพิ่มเฉพาะวันนี้ (แยกจากตัวโปรแกรม) ต่อท้ายรายการท่าหลัก
  const extraExercises = (queueItem.extras || []).map((extra) => ({
    id: extra.id,
    name: extra.name,
    category: libraryMap[extra.exerciseId]?.category || "Other",
    targetSets: Number(extra.sets || 3),
    targetReps: String(extra.reps || "10"),
    restSeconds: Math.round(Number(extra.restMinutes || 1.5) * 60),
    defaultWeight: Number(extra.weight || 0),
    note: extra.notes || "",
    imageUrl: libraryMap[extra.exerciseId]?.imageUrl || "",
    isExtra: true
  }));

  return {
    id: workoutId,
    title: program.name,
    programName: program.name,
    dayLabel: days.length > 1 ? (day.name || "") : "",
    alreadyCompletedToday,
    duration: Math.max(20, (baseExercises.length + extraExercises.length) * 8),
    status: "ready",
    assignmentId: assignment.programId,
    exerciseList: [...baseExercises, ...extraExercises]
  };
}

function normalizeMember(code, source) {
  const workout = {
    ...DEFAULT_MEMBER.workout,
    ...(source.workout || {})
  };

  workout.exerciseList = Array.isArray(workout.exerciseList)
    ? workout.exerciseList
    : DEFAULT_EXERCISES;

  workout.exercises = workout.exerciseList.length;

  return {
    code,
    name: source.name || DEFAULT_MEMBER.name,
    greetingName: source.greetingName || source.name || DEFAULT_MEMBER.greetingName,
    coachName: source.coachName || DEFAULT_MEMBER.coachName,
    coachMessage: source.coachMessage || DEFAULT_MEMBER.coachMessage,
    profilePhoto: source.profilePhoto || "",
    profilePhotoPath: source.profilePhotoPath || "",
    profilePhotoUpdatedAt: Number(source.profilePhotoUpdatedAt || 0),
    workout,
    week: { ...DEFAULT_MEMBER.week, ...(source.week || {}) },
    weight: { ...DEFAULT_MEMBER.weight, ...(source.weight || {}) },
    package: { ...DEFAULT_MEMBER.package, ...(source.package || {}) },
    nextSession: { ...DEFAULT_MEMBER.nextSession, ...(source.nextSession || {}) }
  };
}

export function createWorkoutSession(code, member) {
  const now = Date.now();
  const existing = getActiveWorkoutSession(code);

  if (
    existing &&
    existing.status === "in_progress" &&
    existing.workoutId === member.workout.id
  ) {
    return existing;
  }

  const session = {
    id: `${now}`,
    memberCode: code,
    workoutId: member.workout.id,
    title: member.workout.title,
    status: "in_progress",
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    currentExerciseIndex: 0,
    exercises: member.workout.exerciseList.map((exercise) => ({
      ...exercise,
      completed: false,
      sets: Array.from({ length: exercise.targetSets }, (_, index) => ({
        setNumber: index + 1,
        weight: index === 0 ? exercise.defaultWeight || 0 : "",
        reps: "",
        rpe: "",
        completed: false,
        completedAt: null
      }))
    }))
  };

  saveSessionLocal(code, session);
  saveMemberActivity(code, {
    type: "workout_started",
    workoutTitle: session.title,
    sessionId: session.id,
    timestamp: now
  });
  saveWorkoutSession(code, session.id, session);

  return session;
}

// ถ้าเทรนเนอร์เพิ่มท่าใหม่เข้าไปในโปรแกรมระหว่างที่ลูกเทรนกำลังทำ session อยู่
// (ยังไม่กด Finish) ให้ดึงท่าที่เพิ่มมาใหม่มาต่อท้าย session ปัจจุบันทันที
// โดยไม่แตะท่าที่มีอยู่แล้ว/ทำไปแล้ว กันข้อมูลที่ทำไปแล้วหาย
export function syncSessionWithProgram(code, member, session) {
  if (!session || session.workoutId !== member.workout.id) return session;

  const existingIds = new Set(session.exercises.map((exercise) => exercise.id));
  const newExercises = (member.workout.exerciseList || []).filter((exercise) => !existingIds.has(exercise.id));
  if (!newExercises.length) return session;

  const appended = newExercises.map((exercise) => ({
    ...exercise,
    completed: false,
    sets: Array.from({ length: exercise.targetSets }, (_, index) => ({
      setNumber: index + 1,
      weight: index === 0 ? exercise.defaultWeight || 0 : "",
      reps: "",
      rpe: "",
      completed: false,
      completedAt: null
    }))
  }));

  session.exercises = [...session.exercises, ...appended];
  session.updatedAt = Date.now();
  saveSessionLocal(code, session);
  saveWorkoutSession(code, session.id, session);

  return session;
}

export function cancelWorkoutSession(code) {
  const session = getActiveWorkoutSession(code);
  if (!session) return;
  localStorage.removeItem(`clob_workout_session_${code}`);
  if (session.id) deleteWorkoutSession(code, session.id);
}

export function getActiveWorkoutSession(code) {
  const raw = localStorage.getItem(`clob_workout_session_${code}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function updateWorkoutSet(code, session, exerciseIndex, setIndex, values) {
  const targetSet = session.exercises[exerciseIndex].sets[setIndex];

  targetSet.weight = values.weight;
  targetSet.reps = values.reps;
  targetSet.rpe = values.rpe;
  targetSet.completed = true;
  targetSet.completedAt = Date.now();

  const exercise = session.exercises[exerciseIndex];
  exercise.completed = exercise.sets.every((item) => item.completed);

  const nextSet = exercise.sets[setIndex + 1];
  if (nextSet && nextSet.weight === "") {
    nextSet.weight = values.weight;
  }

  session.updatedAt = Date.now();
  saveSessionLocal(code, session);
  saveWorkoutSession(code, session.id, session);

  return session;
}

export function setCurrentExercise(code, session, exerciseIndex) {
  session.currentExerciseIndex = exerciseIndex;
  session.updatedAt = Date.now();
  saveSessionLocal(code, session);
  return session;
}

export function completeWorkout(code, session) {
  const now = Date.now();
  session.status = "completed";
  session.completedAt = now;
  session.updatedAt = now;

  saveSessionLocal(code, session);
  saveWorkoutSession(code, session.id, session);
  saveMemberActivity(code, {
    type: "workout_completed",
    workoutTitle: session.title,
    sessionId: session.id,
    timestamp: now,
    completedSets: countCompletedSets(session),
    totalSets: countTotalSets(session)
  });

  localStorage.setItem(
    `clob_workout_history_${code}`,
    JSON.stringify([
      session,
      ...getWorkoutHistory(code).filter((item) => item.id !== session.id)
    ].slice(0, 30))
  );

  return session;
}

export function getWorkoutHistory(code) {
  try {
    return JSON.parse(localStorage.getItem(`clob_workout_history_${code}`) || "[]");
  } catch {
    return [];
  }
}

// ดึงประวัติ Workout ที่ทำสำเร็จแล้วทั้งหมดของลูกเทรนจาก Firebase (เชื่อถือได้ข้ามอุปกรณ์)
// ใช้ local history (getWorkoutHistory) เป็นสำรองเฉพาะตอน Firebase ใช้งานไม่ได้
export async function loadMemberWorkoutHistory(code) {
  const remote = await getMemberWorkoutSessions(code);
  const sessions = remote
    ? Object.values(remote)
    : getWorkoutHistory(code);

  return sessions
    .filter((item) => item && item.status === "completed")
    .sort((a, b) => Number(b.completedAt || b.updatedAt || 0) - Number(a.completedAt || a.updatedAt || 0));
}

export function countCompletedSets(session) {
  return session.exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((set) => set.completed).length,
    0
  );
}

export function countTotalSets(session) {
  return session.exercises.reduce(
    (total, exercise) => total + exercise.sets.length,
    0
  );
}

export function getWorkoutProgress(session) {
  const total = Math.max(countTotalSets(session), 1);
  return Math.round((countCompletedSets(session) / total) * 100);
}

function saveSessionLocal(code, session) {
  localStorage.setItem(
    `clob_workout_session_${code}`,
    JSON.stringify(session)
  );
}
