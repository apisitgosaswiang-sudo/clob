# CLOB Pack09-3A – Coaching Plan

This pack defines the Coaching Plan module.

Included:
- Coaching Goal
- Start / End Date
- Current Phase
- Current Week
- Plan Status
- Nutrition Targets
- Workout Targets
- Progress %
- Coach Notes
- Firebase structure proposal

Firebase:

clob/
  onlineCoaching/
    {memberCode}/
      coachingPlan/
        goal
        startDate
        endDate
        phase
        currentWeek
        status
        nutrition/
          calories
          protein
          carbs
          fat
          fiber
          water
        workout/
          split
          weeklySessions
          cardioMinutes
          stepsGoal
        coachNotes
