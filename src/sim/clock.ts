// One day lasts 24 minutes of game time, and a new game opens at nine in the morning.
export const DAY = 1440
const START = 9

export const hourAt = (time: number): number => (START + (time / DAY) * 24) % 24
