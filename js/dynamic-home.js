export function getCalorieState(targetCalories, consumedCalories) {
  const target = Number(targetCalories);
  const consumed = Number(consumedCalories);

  if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(consumed) || consumed < 0) {
    return null;
  }

  const remaining = Math.round(target - consumed);
  let tone = "normal";

  if (remaining < 0) tone = "over";
  else if (remaining <= 100) tone = "critical";
  else if (remaining <= 250) tone = "near";

  return {
    target,
    consumed,
    remaining,
    tone,
    label: remaining < 0 ? "เกินเป้าหมาย" : "เหลือ",
    displayValue: Math.abs(remaining)
  };
}

export function chooseHomePriority({
  nutrition = null,
  workoutStatus = "not_started",
  workoutTitle = "Today's Workout",
  missions = []
} = {}) {
  const normalizedMissions = Array.isArray(missions) ? missions : [];
  const nextMission = normalizedMissions.find((item) => !item.completed) || null;
  const calorieState = nutrition
    ? getCalorieState(nutrition.targetCalories, nutrition.consumedCalories)
    : null;

  if (calorieState && nutrition.dayComplete !== true) {
    return {
      type: "nutrition",
      calorieState
    };
  }

  if (workoutStatus !== "completed") {
    return {
      type: "workout",
      status: workoutStatus === "in_progress" ? "in_progress" : "not_started",
      title: workoutTitle
    };
  }

  if (nextMission) {
    return {
      type: "mission",
      mission: nextMission
    };
  }

  if (normalizedMissions.length) {
    return { type: "success" };
  }

  return { type: "recovery" };
}
