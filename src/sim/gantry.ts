import * as THREE from 'three/webgpu'
import { BOX, cyl, stretch } from '../kit'
import { YARD_CRANE, gantryFrame, spreader, trolley } from '../models/cranes'
import { C } from '../style'
import { BAY_Z, GROUND_Y } from './layout'

const GIRDER_Y = YARD_CRANE.girder
const CARRY_Y = GROUND_Y + 0.42
const GRIP = BOX.h / 2 + 0.006

function glide(current: number, target: number, maxSpeed: number, dt: number): number {
  const diff = target - current
  const step = Math.min(maxSpeed, Math.abs(diff) * 10 + 0.1) * dt
  return Math.abs(diff) <= step ? target : current + Math.sign(diff) * step
}

// One move of a box between a vehicle and a stack. Positions are read late,
// because the stack may change while the lift waits its turn.
export interface Lift {
  from: () => THREE.Vector3
  to: () => THREE.Vector3
  dig: () => number
  pick: () => THREE.Mesh
  drop: (mesh: THREE.Mesh) => void
}

// Yard crane: straddles one block and makes every lift in it, one at a time.
export class Gantry {
  readonly group = new THREE.Group()
  speed = 1
  private queue: Lift[] = []
  private steps: (() => boolean)[] = []
  private index = 0
  private dt = 0
  private held: THREE.Mesh | null = null
  private tz = BAY_Z
  private sy = CARRY_Y
  private trolley = trolley(0.25, 0.085)
  private spreader = spreader()
  private falls: THREE.Mesh[] = []
  private frame: THREE.Object3D | null = null
  private tier = -1

  constructor(public x: number, tier = 0) {
    const g = this.group
    this.trolley.position.y = GIRDER_Y + 0.02
    g.add(this.trolley, this.spreader)
    for (let i = 0; i < 2; i++) {
      const fall = cyl(0.0025, 0.0025, 1, C.iron, 0, 0, 0, 5)
      fall.castShadow = false
      this.falls.push(fall)
      g.add(fall)
    }
    this.restyle(tier)
    this.pose()
  }

  // Swap the frame for another generation of yard crane. Returns true if it changed.
  restyle(tier: number): boolean {
    if (tier === this.tier) return false
    this.tier = tier
    this.frame?.removeFromParent()
    this.frame = gantryFrame(tier)
    this.group.add(this.frame)
    return true
  }

  // Lifts waiting or under way.
  get pending(): number {
    return this.queue.length + (this.steps.length ? 1 : 0)
  }

  request(lift: Lift): void {
    this.queue.push(lift)
  }

  private travel(p: THREE.Vector3): boolean {
    this.x = glide(this.x, p.x, 0.5 * this.speed, this.dt)
    this.tz = glide(this.tz, p.z, 0.7 * this.speed, this.dt)
    this.hoist(CARRY_Y)
    return this.x === p.x && this.tz === p.z
  }

  private hoist(y: number): boolean {
    this.sy = glide(this.sy, y, 0.7 * this.speed, this.dt)
    return this.sy === y
  }

  private plan(lift: Lift): (() => boolean)[] {
    let dig = -1
    return [
      () => this.travel(lift.from()),
      () => this.hoist(lift.from().y + GRIP),
      () => {
        if (dig < 0) dig = lift.dig()
        return (dig -= this.dt) <= 0
      },
      () => {
        this.held = lift.pick()
        this.spreader.add(this.held)
        this.held.position.set(0, -GRIP, 0)
        this.held.quaternion.identity()
        return true
      },
      () => this.hoist(CARRY_Y),
      () => this.travel(lift.to()),
      () => {
        if (!this.hoist(lift.to().y + GRIP)) return false
        const mesh = this.held!
        this.held = null
        lift.drop(mesh)
        return true
      },
      () => this.hoist(CARRY_Y),
    ]
  }

  update(dt: number): void {
    this.dt = dt
    if (!this.steps.length && this.queue.length) {
      this.steps = this.plan(this.queue.shift()!)
      this.index = 0
    }
    if (this.steps.length) {
      if (this.steps[this.index]()) this.index++
      if (this.index >= this.steps.length) this.steps = []
    } else {
      this.hoist(CARRY_Y)
    }
    this.pose()
  }

  private pose(): void {
    this.group.position.x = this.x
    this.trolley.position.z = this.tz
    this.spreader.position.set(0, this.sy, this.tz)
    this.falls.forEach((fall, i) => {
      const fx = i ? 0.06 : -0.06
      stretch(fall, new THREE.Vector3(fx, GIRDER_Y, this.tz), new THREE.Vector3(fx, this.sy, this.tz))
    })
  }
}
