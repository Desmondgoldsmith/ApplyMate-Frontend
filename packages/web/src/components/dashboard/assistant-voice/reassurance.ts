/**
 * Tiny calm guidance — deterministic rotation from seed (no random LLM).
 */

const POOL_GENERAL = [
  "You don’t need to solve everything today.",
  "Momentum grows from finished loops.",
  "Your strongest opportunities may already be in motion.",
  "One clear next step is enough.",
];

const POOL_RECOVERY = [
  "Rest is part of the work — small moves still compound.",
  "There’s no rush to match yesterday’s pace.",
  "Gentle consistency beats heroic bursts.",
];

const POOL_SPRINT = [
  "Closing what you started matters more than opening something new.",
  "Each finished loop frees attention for the next.",
];

const POOL_INTERVIEW = [
  "Focus beats breadth in prep.",
  "You’ve already done the hard part — showing up again builds fluency.",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function pickReassuranceLine(params: {
  mode: string | null;
  seed: string;
}): string {
  const m = (params.mode ?? "").toUpperCase();
  let pool = POOL_GENERAL;
  if (m.includes("RECOVERY")) pool = POOL_RECOVERY;
  else if (m.includes("SPRINT") || m.includes("APPLICATION")) pool = POOL_SPRINT;
  else if (m.includes("INTERVIEW")) pool = POOL_INTERVIEW;
  const idx = hashString(params.seed) % pool.length;
  return pool[idx]!;
}
