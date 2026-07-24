import {
  getMemberByCode,
  saveMemberActivity,
  saveWorkoutSession,
  deleteWorkoutSession,
  getMemberProgram,
  getPrograms
} from "./firebase.js";

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
  const [remote, assignment, programs] = await Promise.all([
    getMemberByCode(code),
    getMemberProgram(code),
    getPrograms()
  ]);
  const source = remote || DEMO_MEMBERS[code] || DEFAULT_MEMBER;
  if (assignment?.status === "active" && programs?.[assignment.programId]) {
    source.workout = programToWorkout(programs[assignment.programId], assignment);
  }
  return normalizeMember(code, source);
}

function programToWorkout(program, assignment) {
  const days = Array.isArray(program.days) ? program.days : [];
  const day = days[0] || { id: program.id, name: program.name, exercises: [] };
  return {
    id: `${program.id}:${day.id}`,
    title: day.name || program.name,
    duration: Math.max(20, (day.exercises || []).length * 8),
    status: "ready",
    assignmentId: assignment.programId,
    exerciseList: (day.exercises || []).map((exercise) => ({
      id: exercise.uid || exercise.exerciseId,
      name: exercise.name,
      category: exercise.category || "Other",
      targetSets: Number(exercise.sets || 3),
      targetReps: String(exercise.reps || "10"),
      restSeconds: Number(exercise.rest || 90),
      defaultWeight: Number(exercise.weight || 0),
      note: exercise.notes || ""
    }))
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
