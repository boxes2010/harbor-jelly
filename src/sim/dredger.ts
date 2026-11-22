import { dredger as dredgerModel } from '../models/vehicles'
import type { Water } from '../water'
import { LANE_Z, OFF_EAST, OFF_WEST } from './layout'

const SPEED = 0.6

// The dredger that deepens the channel. It comes in from the east and works its way west with its pipe
// on the bottom, and its hopper fills as it goes. It has the channel to itself until it is gone.
export class Dredger {
  readonly boat = dredgerModel()
  x = OFF_EAST
  private spoil = this.boat.getObjectByName('spoil')!

  constructor() {
    this.boat.rotation.y = Math.PI
    this.boat.visible = false
  }

  get started(): boolean {
    return this.x < OFF_EAST
  }

  // Steams on down the channel. Returns true once it has left at the far end.
  update(dt: number, water: Water): boolean {
    this.x -= SPEED * dt
    const fill = 0.15 + 0.85 * Math.min(1, (OFF_EAST - this.x) / (OFF_EAST - OFF_WEST))
    this.spoil.scale.y = fill
    this.spoil.position.y = 0.09 + 0.025 * fill
    water.disturb(this.x + 0.34, LANE_Z + 0.13, 0.004, 0.09)
    this.boat.visible = true
    this.boat.position.set(this.x, water.height(this.x, LANE_Z), LANE_Z)
    return this.x <= OFF_WEST
  }
}
