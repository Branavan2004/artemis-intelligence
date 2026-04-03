export function getMissionHoursElapsed(launchDate: string, now = new Date()) {
  return (now.getTime() - new Date(launchDate).getTime()) / (1000 * 60 * 60)
}

export function getMissionElapsedTime(launchDate: string, now = new Date()) {
  const diff = now.getTime() - new Date(launchDate).getTime()
  const prefix = diff < 0 ? 'T-' : 'T+'
  const absoluteDiff = Math.abs(diff)
  const hours = Math.floor(absoluteDiff / (1000 * 60 * 60))
  const minutes = Math.floor((absoluteDiff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((absoluteDiff % (1000 * 60)) / 1000)

  return `${prefix} ${hours}h ${minutes}m ${seconds}s`
}

export function getMissionPhase(launchDate: string, now = new Date()) {
  const hoursElapsed = getMissionHoursElapsed(launchDate, now)

  if (hoursElapsed < 0) return 'Pre-Launch'
  if (hoursElapsed < 24) return 'Earth Orbit & Systems Check'
  if (hoursElapsed < 72) return 'Translunar Injection'
  if (hoursElapsed < 96) return 'Lunar Flyby'
  if (hoursElapsed < 216) return 'Return Trajectory'
  return 'Reentry & Splashdown'
}
