import {
  getMemberExperienceDay,
  saveMemberExperienceDay,
  appendAuditLog
} from "./firebase.js";

const PREFIX = "clob_v1_member_experience_";

const DEFAULT_HABITS = [
  { id: "water", label: "Water", target: 8, unit: "glasses", value: 0 },
  { id: "steps", label: "Steps", target: 8000, unit: "steps", value: 0 },
  { id: "sleep", label: "Sleep", target: 8, unit: "hours", value: 0 },
  { id: "cardio", label: "Cardio", target: 30, unit: "min", value: 0 }
];

export function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function loadTodayState(memberCode) {
  const dateKey = todayKey();
  const remote = await getMemberExperienceDay(memberCode, dateKey);
  const local = loadLocal(memberCode, dateKey);
  const source = remote || local || {};

  const state = normalizeState(memberCode, dateKey, source);
  saveLocal(memberCode, dateKey, state);
  return state;
}

export async function updateHabit(memberCode, habitId, value) {
  const state = await loadTodayState(memberCode);
  const habit = state.habits.find((item) => item.id === habitId);
  if (!habit) return state;

  habit.value = Math.max(0, Number(value || 0));
  habit.completed = habit.value >= habit.target;
  state.updatedAt = Date.now();

  saveLocal(memberCode, state.dateKey, state);
  await saveMemberExperienceDay(memberCode, state.dateKey, {
    habits: state.habits,
    updatedAt: state.updatedAt,
    schemaVersion: "1.0"
  });

  appendAuditLog({
    action: "member_habit_updated",
    memberCode,
    targetId: habitId
  });

  return state;
}

export async function toggleTask(memberCode, taskId, completed) {
  const state = await loadTodayState(memberCode);
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return state;

  task.completed = Boolean(completed);
  task.completedAt = task.completed ? Date.now() : null;
  state.updatedAt = Date.now();

  saveLocal(memberCode, state.dateKey, state);
  await saveMemberExperienceDay(memberCode, state.dateKey, {
    tasks: state.tasks,
    updatedAt: state.updatedAt,
    schemaVersion: "1.0"
  });

  appendAuditLog({
    action: "member_task_updated",
    memberCode,
    targetId: taskId,
    completed: task.completed
  });

  return state;
}

export function calculateHabitScore(state) {
  if (!state?.habits?.length) return 0;
  const total = state.habits.reduce((sum, habit) => {
    return sum + Math.min(1, Number(habit.value || 0) / Math.max(1, Number(habit.target || 1)));
  }, 0);
  return Math.round((total / state.habits.length) * 100);
}

function normalizeState(memberCode, dateKey, source) {
  const sourceHabits = Array.isArray(source.habits) ? source.habits : [];
  const habits = DEFAULT_HABITS.map((defaultHabit) => {
    const saved = sourceHabits.find((item) => item.id === defaultHabit.id) || {};
    const value = Number(saved.value || 0);
    const target = Number(saved.target || defaultHabit.target);
    return {
      ...defaultHabit,
      ...saved,
      value,
      target,
      completed: value >= target
    };
  });

  const defaultTasks = [
    { id: "workout", label: "Complete today's workout", completed: false, completedAt: null },
    { id: "checkin", label: "Review your weekly goal", completed: false, completedAt: null }
  ];

  return {
    schemaVersion: "1.0",
    memberCode,
    dateKey,
    habits,
    tasks: Array.isArray(source.tasks) ? source.tasks : defaultTasks,
    createdAt: source.createdAt || Date.now(),
    updatedAt: source.updatedAt || Date.now()
  };
}

function loadLocal(memberCode, dateKey) {
  try {
    return JSON.parse(localStorage.getItem(`${PREFIX}${memberCode}_${dateKey}`) || "null");
  } catch {
    return null;
  }
}

function saveLocal(memberCode, dateKey, state) {
  localStorage.setItem(`${PREFIX}${memberCode}_${dateKey}`, JSON.stringify(state));
}
