// The people who work a port. Every machine is a post, and a post with nobody on it stands idle.

// Dollars a minute for a hand on fair pay, before any pay deals.
export const WAGE = 5

export type Trade = 'crane' | 'tractor' | 'yard' | 'gate' | 'fitter'
export const TRADES: { id: Trade; name: string; job: string }[] = [
  { id: 'crane', name: 'Quay cranes', job: 'crane driver' },
  { id: 'tractor', name: 'Tractors', job: 'tractor driver' },
  { id: 'yard', name: 'Yard cranes', job: 'yard crane driver' },
  { id: 'gate', name: 'Gate', job: 'gate clerk' },
  // Shipwrights at a shipyard, fitters at a repair dock, the shore gang at a naval base, linesmen at a ferry berth.
  { id: 'fitter', name: 'Yard gangs', job: 'fitter' },
]

// A skill runs from one star to three. Two is the ordinary hand every sum in the game is based on.
export const SKILL = { most: 3, usual: 2, step: 0.08 }

// Promotion is the player's to give once someone has put in the time. `pay` multiplies the wage, `pace`
// the speed of whatever they work, and `exp` is the seconds of work the next step up takes.
export const GRADES = [
  { name: 'Hand', pay: 1, pace: 1, exp: 240 },
  { name: 'Skilled hand', pay: 1.15, pace: 1.07, exp: 600 },
  { name: 'Leading hand', pay: 1.3, pace: 1.14, exp: 1200 },
  { name: 'Foreman', pay: 1.5, pace: 1.22, exp: Infinity },
]

// What someone is paid against the going rate: lean pay saves money but they work and learn slower.
export const PAY = [
  { name: 'Lean', pay: 0.8, pace: 0.93, learns: 0.5 },
  { name: 'Fair', pay: 1, pace: 1, learns: 1 },
  { name: 'Generous', pay: 1.25, pace: 1.06, learns: 1.5 },
]
export const FAIR = 1

// Where someone works: a trade and, for a quay crane, a yard gang or a yard crane, the berth or the block.
export interface Post {
  trade: Trade
  at: number
}

export interface Worker {
  id: number
  name: string
  skill: Record<Trade, number>
  grade: number
  // Seconds of work since the last promotion.
  exp: number
  pay: number
  // Null while waiting in the hall: an applicant, or a hand with no machine to work.
  post: Post | null
}

const FIRST = [
  'Astrid', 'Bo', 'Carmen', 'Dag', 'Elsa', 'Finn', 'Greta', 'Hugo', 'Ines', 'Jonas', 'Kaja', 'Lars', 'Maren', 'Nils',
  'Oda', 'Pablo', 'Rosa', 'Sven', 'Tove', 'Ulf', 'Vera', 'Wim', 'Ylva', 'Zeno', 'Agnes', 'Birk', 'Clara', 'Emil',
  'Frida', 'Gus', 'Hedda', 'Ivar', 'Juno', 'Karl', 'Liv', 'Mats', 'Nora', 'Olle', 'Petra', 'Rune',
]
const LAST = 'ABCDEFGHJKLMNOPRSTVW'

export const samePost = (a: Post | null, b: Post | null) => a?.trade === b?.trade && a?.at === b?.at

// How fast someone works a machine of a trade, against an ordinary hand on fair pay.
export function pace(worker: Worker, trade: Trade): number {
  return (1 + SKILL.step * (worker.skill[trade] - SKILL.usual)) * GRADES[worker.grade].pace * PAY[worker.pay].pace
}

// Dollars a minute, before any pay deals.
export function wage(worker: Worker): number {
  return WAGE * GRADES[worker.grade].pay * PAY[worker.pay].pay
}

export const promotable = (worker: Worker) => worker.exp >= GRADES[worker.grade].exp

// The same sequence of chance for the same number, so a port's applicants do not depend on anything else.
function dice(seed: number): () => number {
  let s = (seed * 2654435761) % 4294967296
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const named = (roll: () => number) =>
  `${FIRST[Math.floor(roll() * FIRST.length)]} ${LAST[Math.floor(roll() * LAST.length)]}.`

// An ordinary hand: two stars at everything.
export function hand(id: number): Worker {
  const { usual } = SKILL
  return {
    id, name: named(dice(id)), skill: { crane: usual, tractor: usual, yard: usual, gate: usual, fitter: usual },
    grade: 0, exp: 0, pay: FAIR, post: null,
  }
}

// Someone looking for work. Each has one trade they are good at and are weaker at the rest.
export function applicant(id: number): Worker {
  const roll = dice(id)
  const worker = hand(id)
  worker.name = named(roll)
  const best = TRADES[Math.floor(roll() * TRADES.length)].id
  for (const { id: trade } of TRADES) {
    worker.skill[trade] = trade === best ? (roll() < 0.55 ? SKILL.most : SKILL.usual) : roll() < 0.5 ? 1 : SKILL.usual
  }
  return worker
}
