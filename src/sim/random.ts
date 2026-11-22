// The simulation's own source of chance, so a run can be repeated exactly from a seed.
// (Three.js draws on Math.random whenever it creates an object, which would otherwise shift every roll.)
let state = (Math.random() * 4294967296) >>> 0

export function reseed(seed: number): void {
  state = seed >>> 0
}

export function random(): number {
  state = (state + 0x6d2b79f5) >>> 0
  let t = state
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
