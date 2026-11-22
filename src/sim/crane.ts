import * as THREE from 'three/webgpu'
import { BOX, cyl, stretch } from '../kit'
import { CRANE_FAMILIES, QUAY_CRANE, drivePack, quayCrane, spreader, trolley } from '../models/cranes'
import { C } from '../style'
import type { BoxPool } from './boxes'
import { APRON_Z, VEHICLE_BOX_Y } from './layout'
import type { Ship } from './ship'
import type { Carrier } from './vehicles'

const HOIST_Y = 0.66
const GRIP = BOX.h / 2 + 0.006
// How far the boom lifts when the berth is empty, and how fast it moves.
const LUFF = { angle: 0.85, speed: 0.6 }
const HINGE = new THREE.Vector3(0, QUAY_CRANE.girder, QUAY_CRANE.hinge)
const ACROSS = new THREE.Vector3(1, 0, 0)
export const CRANE_GAP = 0.52

export interface CraneTask {
  kind: 'unload' | 'load'
  ship: Ship
  col: number
  x: number
  carrier: Carrier | null
  // How much slower this cargo is to handle: 1 for an ordinary box.
  heft: number
}

export function approach(current: number, target: number, maxSpeed: number, dt: number): number {
  const diff = target - current
  const step = Math.min(maxSpeed, Math.abs(diff) * 5 + 0.04) * dt
  return Math.abs(diff) <= step ? target : current + Math.sign(diff) * step
}

export class Crane {
  readonly group = new THREE.Group()
  task: CraneTask | null = null
  zone: [number, number] = [0, 0]
  speed = 1
  // Someone is at the controls. Without a driver it finishes the lift in hand and takes no more.
  manned = true
  waitingForCarrier = false
  onMove: (task: CraneTask) => void = () => {}
  private steps: (() => boolean)[] = []
  private index = 0
  private dt = 0
  private held: THREE.Mesh | null = null
  private tz = APRON_Z
  private sy = HOIST_Y
  // Set by the port: no ship is alongside, so the boom may lift clear of the water.
  boomUp = false
  // Where a crane sent to the next berth is making for along the rails, until it gets there or is given work.
  rest: number | null = null
  private lift = 0
  private trolley = trolley(0.13, 0.07)
  private spreader = spreader()
  private falls: THREE.Mesh[] = []
  private boom: THREE.Group
  private stay = cyl(0.005, 0.005, 1, C.iron, 0, 0, 0, 6)
  private apex: THREE.Vector3
  private hang: THREE.Vector3
  private drive: THREE.Group | null = null
  private tier = 0

  // The berth decides the generation of crane: each berth was fitted out in its own time.
  constructor(public x: number, public berth: number, color: string, private pool: BoxPool) {
    const g = this.group
    const model = quayCrane(berth % CRANE_FAMILIES, color)
    this.boom = model.boom
    this.boom.position.copy(HINGE)
    this.apex = model.apex
    this.hang = model.hang
    this.stay.castShadow = false
    g.add(model.frame, this.boom, this.stay, this.trolley, this.spreader)
    for (let i = 0; i < 4; i++) {
      const fall = cyl(0.0025, 0.0025, 1, C.iron, 0, 0, 0, 5)
      fall.castShadow = false
      this.falls.push(fall)
      g.add(fall)
    }
    this.pose()
  }

  // Fits the drives of a speed tier. Returns true if they changed.
  restyle(tier: number): boolean {
    if (tier === this.tier) return false
    this.tier = tier
    this.drive?.removeFromParent()
    this.drive = drivePack(tier)
    this.group.add(this.drive)
    return true
  }

  get hook(): THREE.Vector3 {
    return new THREE.Vector3(this.x, this.sy, this.tz)
  }

  // Every crane between this one and a working crane needs a gap of its own.
  private limits(cranes: Crane[], index: number): [number, number] {
    let lo = -Infinity
    let hi = Infinity
    cranes.forEach((crane, j) => {
      if (!crane.task || j === index) return
      if (j < index) lo = Math.max(lo, crane.task.x + (index - j) * CRANE_GAP)
      else hi = Math.min(hi, crane.task.x - (j - index) * CRANE_GAP)
    })
    return [lo, hi]
  }

  canStart(x: number, cranes: Crane[], index: number): boolean {
    const [lo, hi] = this.limits(cranes, index)
    return x >= lo - 1e-6 && x <= hi + 1e-6
  }

  start(task: CraneTask): void {
    this.rest = null
    this.task = task
    this.index = 0
    this.steps = task.kind === 'unload' ? this.unloadSteps(task) : this.loadSteps(task)
  }

  private travel(x: number, z: () => number, left: Crane | null, right: Crane | null): boolean {
    const lo = left ? left.x + CRANE_GAP : -Infinity
    const hi = right ? right.x - CRANE_GAP : Infinity
    this.x = Math.min(hi, Math.max(lo, approach(this.x, x, 0.3 * this.speed, this.dt)))
    const pace = this.speed / (this.task?.heft ?? 1)
    // A neighbour standing exactly one gap away must not hold it a rounding error short.
    if (Math.abs(this.x - x) < 1e-6) this.x = x
    this.tz = approach(this.tz, z(), 0.45 * pace, this.dt)
    this.hoist(HOIST_Y)
    return this.x === x && this.tz === z()
  }

  private hoist(y: number): boolean {
    this.sy = approach(this.sy, y, (0.45 * this.speed) / (this.task?.heft ?? 1), this.dt)
    return this.sy === y
  }

  private pause(seconds: number): () => boolean {
    let left = seconds
    return () => (left -= this.dt) <= 0
  }

  private neighbours: [Crane | null, Crane | null] = [null, null]

  private carrierReady(task: CraneTask): boolean {
    this.waitingForCarrier = !task.carrier?.ready
    return !this.waitingForCarrier
  }

  private unloadSteps(task: CraneTask): (() => boolean)[] {
    const { ship, col } = task
    return [
      () => this.travel(task.x, () => ship.topPos(col).z, ...this.neighbours),
      () => {
        const top = ship.topPos(col)
        this.tz = top.z
        if (!this.hoist(top.y + GRIP)) return false
        const box = this.pool.get(ship.takeImport(col))
        box.userData.cargo = ship.call!.cargo
        this.grab(box)
        return true
      },
      this.pause(0.25),
      () => this.hoist(HOIST_Y),
      () => this.travel(task.x, () => APRON_Z, ...this.neighbours),
      () => this.carrierReady(task),
      () => {
        if (!this.hoist(VEHICLE_BOX_Y + GRIP)) return false
        task.carrier!.receive(this.held!)
        this.held = null
        this.onMove(task)
        return true
      },
      this.pause(0.25),
      () => this.hoist(HOIST_Y),
    ]
  }

  private loadSteps(task: CraneTask): (() => boolean)[] {
    const { ship, col } = task
    return [
      () => this.travel(task.x, () => APRON_Z, ...this.neighbours),
      () => this.carrierReady(task),
      () => {
        if (!this.hoist(VEHICLE_BOX_Y + GRIP)) return false
        this.grab(task.carrier!.give())
        return true
      },
      this.pause(0.25),
      () => this.hoist(HOIST_Y),
      () => this.travel(task.x, () => ship.freePos(col).z, ...this.neighbours),
      () => {
        const free = ship.freePos(col)
        this.tz = free.z
        if (!this.hoist(free.y + GRIP)) return false
        ship.placeExport(col, this.held!.userData.color as number)
        this.pool.release(this.held!)
        this.held = null
        this.onMove(task)
        return true
      },
      this.pause(0.25),
      () => this.hoist(HOIST_Y),
    ]
  }

  private grab(mesh: THREE.Mesh): void {
    this.spreader.add(mesh)
    mesh.position.set(0, -GRIP, 0)
    mesh.quaternion.identity()
    this.held = mesh
  }

  update(dt: number, cranes: Crane[], index: number, held: boolean): void {
    this.dt = dt
    this.neighbours = [cranes[index - 1] ?? null, cranes[index + 1] ?? null]
    this.waitingForCarrier = false
    const lift = this.boomUp && !this.task && this.tz <= 0 ? LUFF.angle : 0
    this.lift += Math.sign(lift - this.lift) * Math.min(Math.abs(lift - this.lift), LUFF.speed * dt)
    if (held) return this.pose()
    if (this.task) {
      if (this.steps[this.index]()) this.index++
      if (this.index >= this.steps.length) this.task = null
    } else {
      const [lo, hi] = this.limits(cranes, index)
      let to = Math.min(hi, Math.max(lo, this.x))
      if (this.rest !== null) {
        const [left, right] = this.neighbours
        to = Math.min(hi, right ? right.x - CRANE_GAP : Infinity, Math.max(lo, left ? left.x + CRANE_GAP : -Infinity, this.rest))
        if (this.x === to) this.rest = null
      }
      this.x = approach(this.x, to, 0.3 * this.speed, dt)
      this.tz = approach(this.tz, APRON_Z, 0.45, dt)
      this.hoist(HOIST_Y)
    }
    this.pose()
  }

  private pose(): void {
    this.group.position.x = this.x
    this.boom.rotation.x = -this.lift
    stretch(this.stay, this.apex, this.hang.clone().applyAxisAngle(ACROSS, -this.lift).add(HINGE))
    this.trolley.position.set(0, 0.745, this.tz)
    this.spreader.position.set(0, this.sy, this.tz)
    this.falls.forEach((fall, i) => {
      const fx = (i % 2 ? 1 : -1) * 0.05
      const fz = this.tz + (i < 2 ? 1 : -1) * 0.025
      stretch(fall, new THREE.Vector3(fx, 0.73, fz), new THREE.Vector3(fx, this.sy, fz))
    })
  }
}
