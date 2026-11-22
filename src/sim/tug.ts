import { tug as tugModel } from '../models/vehicles'
import type { Water } from '../water'
import { LANE_Z, TUG_QUAY } from './layout'

const SPEED = 3.2

// Where a tug should stand. `side` means alongside a hull rather than out in the channel.
export interface Station { x: number; z: number; side: boolean }

// A harbour tug. It lies at the tug quay until a ship moves, then goes out ahead of her: it waits at the
// berth for a ship coming in and pushes her alongside, and it tows a ship that is leaving out to the channel.
// It always keeps east of the ship it is working, so the two never cross.
export class Tug {
  readonly boat = tugModel()
  readonly home: { x: number; z: number }
  x: number
  z: number
  // In place by the ship it is helping, which is what makes her manoeuvre faster.
  attending = false
  private heading = Math.PI

  constructor(index: number) {
    this.home = { x: TUG_QUAY.x + index * TUG_QUAY.pitch, z: TUG_QUAY.z }
    this.x = this.home.x
    this.z = this.home.z
  }

  get atHome(): boolean {
    return Math.abs(this.x - this.home.x) < 0.02 && Math.abs(this.z - this.home.z) < 0.02
  }

  // `to` is where to stand, or null to go home. `shut` means a ship is passing the quay, so stay in.
  update(dt: number, to: Station | null, shut: boolean, water: Water): void {
    const target = to ?? this.home
    // Out to the channel, along it, then in: never straight across.
    const via = to?.side ? to.z : LANE_Z
    let budget = SPEED * dt
    let facing: number | null = null
    const move = (axis: 'x' | 'z', goal: number): boolean => {
      const step = Math.max(-budget, Math.min(budget, goal - this[axis]))
      this[axis] += step
      budget -= Math.abs(step)
      if (Math.abs(step) > 1e-6) facing = axis === 'x' ? (step > 0 ? 0 : Math.PI) : step > 0 ? -Math.PI / 2 : Math.PI / 2
      return Math.abs(goal - this[axis]) < 1e-6
    }
    const off = Math.abs(this.x - target.x) > 1e-3
    if (off && !(shut && this.atHome) && move('z', via)) move('x', target.x)
    if (Math.abs(this.x - target.x) <= 1e-3) move('z', target.z)
    this.attending = to !== null && Math.hypot(this.x - to.x, this.z - to.z) < 0.3
    if (this.attending && facing === null) facing = to!.side ? Math.PI / 2 : 0
    if (this.atHome) facing = Math.PI
    if (facing !== null) {
      const turn = facing - this.heading
      this.heading += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt * 6)
    }
    if (budget < SPEED * dt - 1e-6) water.disturb(this.x, this.z, 0.004, 0.08)
    this.boat.position.set(this.x, water.height(this.x, this.z), this.z)
    this.boat.rotation.set(0, this.heading, 0)
  }
}
