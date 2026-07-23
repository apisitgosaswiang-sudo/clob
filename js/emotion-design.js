const DAYPARTS = {
  morning: {
    tone: "morning",
    eyebrow: "GOOD MORNING",
    title: "Let’s make today count.",
    body: "Start with one clear action."
  },
  afternoon: {
    tone: "afternoon",
    eyebrow: "GOOD AFTERNOON",
    title: "Keep the momentum.",
    body: "Your next step is ready."
  },
  evening: {
    tone: "evening",
    eyebrow: "GOOD EVENING",
    title: "Finish with intention.",
    body: "A little progress still counts."
  }
};

export function getEmotionMessage({
  date = new Date(),
  completed = 0,
  total = 0,
  workoutDone = false
} = {}) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeCompleted = Math.min(safeTotal, Math.max(0, Number(completed) || 0));
  const remaining = Math.max(0, safeTotal - safeCompleted);

  if (!safeTotal) {
    return {
      tone: "recovery",
      eyebrow: "TODAY",
      title: "Recovery is part of the plan.",
      body: "No mission has been set for today."
    };
  }

  if (safeCompleted === safeTotal) {
    return {
      tone: "success",
      eyebrow: "MISSION COMPLETE",
      title: "Great work today.",
      body: "You finished what mattered."
    };
  }

  if (workoutDone) {
    return {
      tone: "achievement",
      eyebrow: "ONE WORKOUT STRONGER",
      title: "That effort counts.",
      body: remaining === 1 ? "One small step left today." : `${remaining} missions left today.`
    };
  }

  if (safeCompleted > 0) {
    return {
      tone: "progress",
      eyebrow: "MOMENTUM",
      title: "You’re already moving.",
      body: remaining === 1 ? "One small step left today." : `${remaining} missions left today.`
    };
  }

  return DAYPARTS[getDaypart(date)];
}

export function missionProgress(completed = 0, total = 0) {
  const safeTotal = Math.max(0, Number(total) || 0);
  if (!safeTotal) return 0;
  const safeCompleted = Math.min(safeTotal, Math.max(0, Number(completed) || 0));
  return Math.round((safeCompleted / safeTotal) * 100);
}

export function formatToday(date = new Date(), locale = "en-US") {
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      month: "short",
      day: "numeric"
    }).format(date);
  } catch {
    return "Today";
  }
}

function getDaypart(date) {
  const parsed = date instanceof Date ? date : new Date(date);
  const hour = Number.isNaN(parsed.getTime()) ? new Date().getHours() : parsed.getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}
