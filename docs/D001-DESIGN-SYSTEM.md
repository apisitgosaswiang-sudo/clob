# D-001 — CLOB v2 Design System

## Direction

`Athletic Luxury with Momentum`

The interface is calm, precise and premium. Energy appears only where it helps
the member act, see progress or feel an earned reward.

> Quiet outside. Active inside.

## Visual Ratio

- 90% neutral foundation: warm canvas, white surfaces, ink and muted gray
- 10% semantic emphasis: action, progress, success, streak and achievement

## Semantic Color

| Role | Token | Value | Use |
|---|---|---:|---|
| Action | `--clob-action` | `#E11D48` | The one primary action |
| Progress | `--clob-progress` | `#E11D48` | Active ring and progress |
| Success | `--clob-success` | `#16865B` | Earned completion |
| Streak | `--clob-streak` | `#E56C2F` | Streak only |
| Achievement | `--clob-achievement` | `#B9852F` | PR and achievement |
| Ink | `--clob-ink` | `#131315` | Main type and signature hero |
| Canvas | `--clob-canvas` | `#F4F3F1` | App background |

Incomplete work is neutral. It is not an error and must not be shown in red.

## Typography

- Primary: Inter
- Thai fallback: Noto Sans Thai
- Display copy uses tight tracking and short line length.
- Labels are small uppercase text with wide tracking.
- Body copy remains short and supports the next action.

## Shape and Depth

- Primary hero radius: 28 px
- Supporting cards: 18–22 px
- Primary action: 16 px
- Shadows are soft and sparse.
- The dark Today’s Mission hero is a signature surface, not a generic card
  style used across every section.

## Member Today Hierarchy

1. Time-aware Emotion Design
2. Today’s Mission
3. One primary next action
4. Workout plan
5. Daily rhythm
6. Secondary links and navigation

The first viewport must communicate the mission and next action without
requiring the member to interpret dashboards.

## Today’s Mission Rules

- Maximum three missions.
- Completion uses the existing source of truth when available.
- A completed workout automatically completes the workout mission.
- A source-driven completion cannot be manually reversed from the mission UI.
- A generic mission can be completed directly.
- No fake Nutrition mission is added before the Nutrition data layer exists.
- If there is no mission, show recovery language without manufacturing work.

## Emotion Rules

Messages are deterministic:

1. All missions complete
2. Workout complete
3. Some progress made
4. No mission / recovery
5. Morning, afternoon or evening

Messages must be brief, human and non-judgmental.

## Motion

- Entrance: 420 ms, small vertical rise
- Interaction: 140–240 ms
- Progress transitions are calm and directional
- `prefers-reduced-motion` disables non-essential motion

## Product Gates

The reference screen passes only when:

1. It is beautiful with a clear purpose.
2. The next action is understood within three seconds.
3. Completion feels good enough to support tomorrow’s return.
