export const ARTEMIS_II_LAUNCH_DATE = new Date('2026-04-01T22:35:00Z');
const MISSION_DURATION_MS = 10 * 24 * 60 * 60 * 1000;

export function getMissionElapsedMs(now = new Date()): number {
  return now.getTime() - ARTEMIS_II_LAUNCH_DATE.getTime();
}

export function getMissionElapsedHours(now = new Date()): number {
  return getMissionElapsedMs(now) / (1000 * 60 * 60);
}

export function getMissionElapsedTime(now = new Date()): string {
  const diff = getMissionElapsedMs(now);
  const prefix = diff < 0 ? 'T-' : 'T+';
  const absoluteDiff = Math.abs(diff);
  const hours = Math.floor(absoluteDiff / (1000 * 60 * 60));
  const minutes = Math.floor((absoluteDiff % (1000 * 60 * 60)) / (1000 * 60));

  return `${prefix}${hours}h ${minutes}m`;
}

export function getCurrentMissionPhase(now = new Date()): string {
  const hoursElapsed = getMissionElapsedHours(now);

  if (hoursElapsed < 0) return 'Pre-Launch';
  if (hoursElapsed < 24) return 'Earth Orbit & Systems Check';
  if (hoursElapsed < 72) return 'Translunar Injection';
  if (hoursElapsed < 96) return 'Lunar Flyby';
  if (hoursElapsed < 216) return 'Return Trajectory';
  if (hoursElapsed < 240) return 'Reentry & Splashdown';
  return 'Post-Mission';
}

export function getMissionProgress(now = new Date()): number {
  return Math.min(Math.max((getMissionElapsedMs(now) / MISSION_DURATION_MS) * 100, 0), 100);
}

export function getMissionStatus(now = new Date()): string {
  const elapsed = getMissionElapsedMs(now);

  if (elapsed < 0) return 'Pre-Launch';
  if (elapsed > MISSION_DURATION_MS) return 'Completed';
  return 'Active';
}

export function getMissionUpdate(now = new Date()) {
  return {
    timestamp: now.toISOString(),
    missionElapsedTime: getMissionElapsedTime(now),
    phase: getCurrentMissionPhase(now),
  };
}
