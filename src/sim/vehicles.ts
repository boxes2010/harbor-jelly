import * as THREE from 'three/webgpu'
import { TRUCK_STYLES, tractor, truck } from '../models/vehicles'
import { C } from '../style'
import {
  APRON_Z, BAY_Z, DECK_LOCAL_Y, GATE_OUT, GROUND_Y, LANE_EAST, LANE_WEST, TOWN_OUT_Z, TRUCK_SPAWN_X,
} from './layout'
import { random } from './random'
import { AISLES, AISLE_TURN, type StackRef, type YardBox } from './yard'

// Somewhere a vehicle is served or waits: a bay beside the stacks, or a bay on the apron under the quay cranes.
export type Place = 'bay' | 'quay'
export interface Spot { x: number; place: Place }
// `chain` makes a leg and the one after it a single move: it starts only when the way is clear for both.
export interface Leg { x: number; z: number; chain?: boolean }
interface Rect { x0: number; x1: number; z0: number; z1: number }

const PLACE_Z: Record<Place, number> = { bay: BAY_Z, quay: APRON_Z }
// Half the length and width of a vehicle, and the room kept between two of them.
const HALF = 0.15
const WIDE = 0.043
const GAP = 0.03
// Two vehicles need their places at least this far apart.
export const BAY_PITCH = 2 * HALF + GAP + 0.02
// How long a vehicle has to wait to move across lanes before traffic gives way to it.
const COURTESY = 0.3
// A vehicle that has not moved for this long, behind one that has not either, is in a knot that will not
// undo itself. It is let through whatever is in its way for a short distance, which is the one time
// vehicles may overlap.
const KNOT = { after: 15, slip: 0.7 }
const ROAD_MIDDLE = (LANE_WEST + LANE_EAST) / 2
// How long a vehicle waits in a through lane for room to turn across, before it drives on to the next crossing.
const PATIENCE = 1
const through = (z: number) => Math.abs(z - LANE_WEST) < 1e-3 || Math.abs(z - LANE_EAST) < 1e-3

// Touching does not count: a queue stands exactly nose to tail.
const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 - 1e-4 && a.x1 > b.x0 + 1e-4 && a.z0 < b.z1 - 1e-4 && a.z1 > b.z0 + 1e-4

// The crossing to take when heading south (off the yard road) or north (off the apron): the first one
// reached that is not past `limit`, skipping any a quay crane stands over.
function crossing(south: boolean, limit: number, shut: (x: number) => boolean): number {
  const turns = AISLES.map((aisle) => aisle + (south ? -AISLE_TURN : AISLE_TURN))
  if (south) turns.reverse()
  return turns.find((x) => (south ? x <= limit + 1e-3 : x >= limit - 1e-3) && !shut(x)) ?? turns[turns.length - 1]
}

// Into the through lane on this side of the rails and round the loop, as far as the lane that passes `to`.
function round(x: number, z: number, to: number, goal: number, shut: (x: number) => boolean): Leg[] {
  const legs: Leg[] = []
  let lane = z < ROAD_MIDDLE ? LANE_WEST : LANE_EAST
  legs.push({ x, z: lane })
  const downstream = () => (lane === LANE_WEST ? to <= x + 1e-3 : to >= x - 1e-3)
  for (let turns = 0; turns < 3 && !(lane === goal && downstream()); turns++) {
    const south = lane === LANE_WEST
    // A turn into the lane wanted has to come out upstream of the place wanted.
    const limit = lane === goal ? x : south ? Math.min(x, to) : Math.max(x, to)
    x = crossing(south, limit, shut)
    legs.push({ x, z: lane })
    lane = south ? LANE_EAST : LANE_WEST
    legs.push({ x, z: lane })
  }
  legs.push({ x: to, z: lane })
  return legs
}

function length(x: number, z: number, legs: Leg[]): number {
  let sum = 0
  for (const leg of legs) {
    sum += Math.abs(leg.x - x) + Math.abs(leg.z - z)
    x = leg.x
    z = leg.z
  }
  return sum
}

// How far a tractor drives to take a box from under a quay crane to a bay by the stacks and come back.
// The loop is one-way, so this is not simply twice the distance between them.
export function tour(quayX: number, bayX: number, shut: (x: number) => boolean): number {
  return length(quayX, APRON_Z, round(quayX, APRON_Z, bayX, LANE_WEST, shut))
    + length(bayX, BAY_Z, round(bayX, BAY_Z, quayX, LANE_EAST, shut))
}

export class Vehicle {
  // How many knots have had to be undone, for checking that it stays rare.
  static knots = 0
  readonly group = new THREE.Group()
  cargo: THREE.Mesh | null = null
  speed = 1
  // Everything else on this port's roads.
  traffic: Vehicle[] = []
  // Whether a quay crane stands over a crossing, so that it cannot be used.
  shut: (x: number) => boolean = () => false
  protected legs: Leg[] = []
  protected body: THREE.Object3D
  // The ground a move across lanes takes up, held from the moment it starts.
  private sweep: Rect | null = null
  // What is holding it up, for finding out why traffic has stopped.
  blocker: Vehicle | null = null
  // Where it is bound: a place, or out of the gate.
  private bound: Spot | 'out' | null = null
  private waited = 0
  private stalled = 0
  private slip = 0
  // The ground it has been waiting to move across. Traffic that is not yet on it gives way.
  private wants: Rect | null = null
  // Which way to face once stopped, if it matters.
  private rest: number | null = null

  constructor(body: THREE.Object3D) {
    this.body = body
    this.group.add(body)
    this.group.position.y = GROUND_Y
  }

  get x(): number {
    return this.group.position.x
  }

  get z(): number {
    return this.group.position.z
  }

  place(x: number, z: number, heading = 0): void {
    this.group.position.set(x, GROUND_Y, z)
    this.group.rotation.y = heading
    this.legs = []
    this.sweep = null
    this.wants = null
    this.rest = null
  }

  mount(mesh: THREE.Mesh): void {
    this.group.add(mesh)
    mesh.position.set(-0.02, DECK_LOCAL_Y, 0)
    mesh.quaternion.identity()
    this.cargo = mesh
  }

  unmount(): THREE.Mesh {
    const mesh = this.cargo!
    this.cargo = null
    return mesh
  }

  deckWorld(): THREE.Vector3 {
    return this.group.localToWorld(new THREE.Vector3(-0.02, DECK_LOCAL_Y, 0))
  }

  // The ground this vehicle holds: its own length, or all of a move across lanes once that has begun.
  get space(): Rect {
    return this.sweep ?? { x0: this.x - HALF, x1: this.x + HALF, z0: this.z - WIDE, z1: this.z + WIDE }
  }

  // Where it will be once any move across lanes it has begun is over.
  private get footing(): Leg {
    return this.sweep ? this.legs[0] : { x: this.x, z: this.z }
  }

  private setLegs(legs: Leg[]): void {
    this.wants = null
    this.waited = 0
    this.legs = this.sweep ? [this.legs[0], ...legs] : legs
  }

  // The way round the loop from a point to wherever it is bound.
  private way(x: number, z: number): Leg[] {
    const to = this.bound
    if (!to) return []
    if (to === 'out') {
      return [
        ...round(x, z, GATE_OUT.from, LANE_EAST, this.shut),
        { x: GATE_OUT.to, z: TOWN_OUT_Z }, { x: TRUCK_SPAWN_X, z: TOWN_OUT_Z },
      ]
    }
    const place = PLACE_Z[to.place]
    if (Math.abs(x - to.x) < 1e-3 && Math.abs(z - place) < 1e-3) return []
    return [...round(x, z, to.x, to.place === 'bay' ? LANE_WEST : LANE_EAST, this.shut), { x: to.x, z: place }]
  }

  // Set off for a place, round the loop.
  go(to: Spot): void {
    const from = this.footing
    this.bound = to
    this.rest = to.place === 'bay' ? Math.PI : 0
    this.setLegs(this.way(from.x, from.z))
  }

  // Set off out of the gate and away along the town road.
  leave(): void {
    const from = this.footing
    this.bound = 'out'
    this.rest = null
    this.setLegs(this.way(from.x, from.z))
  }

  // Drive straight through these points, for the roads outside the loop.
  follow(legs: Leg[]): void {
    this.bound = null
    this.rest = null
    this.setLegs(legs)
  }

  // How far the drive to a place would be.
  distanceTo(to: Spot): number {
    const from = this.footing
    const goal = to.place === 'bay' ? LANE_WEST : LANE_EAST
    return length(from.x, from.z, [...round(from.x, from.z, to.x, goal, this.shut), { x: to.x, z: PLACE_Z[to.place] }])
  }

  // How far it may go along its lane before closing up on whatever is ahead, moving or not.
  private room(direction: number, wanted: number): number {
    const { x, z } = this
    let free = wanted
    for (const other of this.traffic) {
      if (other === this || !other.group.visible) continue
      const s = other.space
      if (s.z0 >= z + WIDE || s.z1 <= z - WIDE) continue
      const ahead = ((s.x0 + s.x1) / 2 - x) * direction
      if (ahead < 0 || (ahead === 0 && other.group.id < this.group.id)) continue
      const left = ahead - (s.x1 - s.x0) / 2 - HALF - GAP
      if (left < free) {
        free = left
        this.blocker = other
      }
    }
    // Give way to anything waiting to turn or pull out ahead, unless already on the ground it needs.
    const mine = this.space
    for (const other of this.traffic) {
      const w = other.wants
      if (!w || other === this || w.z0 >= z + WIDE || w.z1 <= z - WIDE || overlap(w, mine)) continue
      const ahead = ((w.x0 + w.x1) / 2 - x) * direction
      if (ahead > 0) free = Math.min(free, ahead - (w.x1 - w.x0) / 2 - HALF)
    }
    return Math.max(0, free)
  }

  // Returns true once it has arrived.
  protected drive(dt: number): boolean {
    let budget = this.speed * dt
    const p = this.group.position
    const before = p.x + p.z
    const held = this.blocker
    this.blocker = null
    while (this.legs.length && budget > 1e-9) {
      const to = this.legs[0]
      const dx = to.x - p.x
      const dz = to.z - p.z
      const dist = Math.hypot(dx, dz)
      if (dist < 1e-6) {
        this.legs.shift()
        this.sweep = null
        continue
      }
      let reach = dist
      if (this.slip > 0) {
        this.slip -= Math.min(budget, dist)
      } else if (!this.sweep && (to.chain || Math.abs(dz) >= 1e-3)) {
        // A move across lanes waits until all the ground it needs is clear, then holds it.
        const end = to.chain ? this.legs[1] : to
        const xs = [p.x, to.x, end.x]
        const zs = [p.z, to.z, end.z]
        const box = {
          x0: Math.min(...xs) - HALF - GAP, x1: Math.max(...xs) + HALF + GAP,
          z0: Math.min(...zs) - WIDE, z1: Math.max(...zs) + WIDE,
        }
        this.blocker = this.traffic.find((other) => other !== this && other.group.visible && overlap(box, other.space)) ?? null
        if (this.blocker) {
          this.waited += dt
          this.wants = this.waited > COURTESY ? box : null
          // Standing in a through lane holds everyone up: after a moment, drive on and take the next
          // crossing, or go round and come back to the bay.
          const round = through(end.z) || (this.bound !== null && this.bound !== 'out')
          if (through(p.z) && round && this.waited > PATIENCE) {
            this.waited = 0
            this.wants = null
            this.legs = this.way(p.x + (p.z < ROAD_MIDDLE ? -0.02 : 0.02), p.z)
            continue
          }
          break
        }
        this.waited = 0
        this.wants = null
        this.sweep = box
      } else if (!this.sweep) {
        reach = this.room(Math.sign(dx), dist)
      }
      const step = Math.min(budget, reach)
      if (step <= 1e-9) break
      p.x += (dx / dist) * step
      p.z += (dz / dist) * step
      budget -= step
      // Pulling over into a bay is a sidestep; anything longer is a turn.
      if (Math.abs(dx) > 1e-3 || Math.abs(dz) > 0.14) this.face(Math.atan2(-dz, dx), dt)
      if (step >= dist - 1e-9) {
        p.x = to.x
        p.z = to.z
        this.legs.shift()
        if (!to.chain) this.sweep = null
      }
    }
    this.stalled = this.legs.length && p.x + p.z === before ? this.stalled + dt : 0
    const other = this.blocker ?? held
    if (this.stalled > KNOT.after && (!other || other.stalled > KNOT.after)) {
      Vehicle.knots++
      this.stalled = 0
      this.slip = KNOT.slip
    }
    if (!this.legs.length && this.rest !== null) this.face(this.rest, dt)
    return this.legs.length === 0
  }

  private face(heading: number, dt: number): void {
    const turn = heading - this.group.rotation.y
    this.group.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt * 12)
  }
}

type CarrierJob =
  | { kind: 'import'; x: number; stackX: number; slot: StackRef }
  | { kind: 'export'; x: number; stackX: number; ref: StackRef; box: YardBox }

export type CarrierState = 'idle' | 'toApron' | 'atApron' | 'toStack' | 'handling'

// Yard tractor: shuttles one box at a time between the quay cranes and the yard.
export class Carrier extends Vehicle {
  state: CarrierState = 'idle'
  job: CarrierJob | null = null
  // Someone is at the wheel. Without a driver it finishes its run and is given no more.
  manned = true
  private tier = 0

  constructor(tier = 0) {
    super(tractor(tier))
    this.tier = tier
  }

  // Swap the tractor for another generation. Returns true if it changed.
  restyle(tier: number): boolean {
    if (tier === this.tier) return false
    this.tier = tier
    this.body.removeFromParent()
    this.body = tractor(tier)
    this.group.add(this.body)
    return true
  }

  get idle(): boolean {
    return this.state === 'idle'
  }

  get ready(): boolean {
    return this.state === 'atApron'
  }

  fetchImport(x: number, slot: StackRef, stackX: number): void {
    this.job = { kind: 'import', x, stackX, slot }
    this.toApron()
  }

  fetchExport(x: number, ref: StackRef, box: YardBox, stackX: number): void {
    this.job = { kind: 'export', x, stackX, ref, box }
    this.toStack()
  }

  // Crane has set a box down on the deck.
  receive(mesh: THREE.Mesh): void {
    this.mount(mesh)
    this.toStack()
  }

  // Crane lifts the box off; the tractor is free again.
  give(): THREE.Mesh {
    this.finish()
    return this.unmount()
  }

  toApron(): void {
    this.go({ x: this.job!.x, place: 'quay' })
    this.state = 'toApron'
  }

  private toStack(): void {
    this.go({ x: this.job!.stackX, place: 'bay' })
    this.state = 'toStack'
  }

  finish(): void {
    this.job = null
    this.state = 'idle'
  }

  // Returns true on the frame it reaches a stack and handling should begin.
  advance(dt: number): boolean {
    const arrived = this.drive(dt)
    if (arrived && this.state === 'toApron') this.state = 'atApron'
    if (arrived && this.state === 'toStack') {
      this.state = 'handling'
      return true
    }
    return false
  }
}

const CABS = [C.white, C.signalBlue, C.signalRed, C.teal, C.cream]

// Road truck from outside the port, driven by a scripted list of steps.
export class Truck extends Vehicle {
  active = false
  dt = 0
  private steps: (() => boolean)[] = []
  private index = 0

  constructor() {
    // One draw decides both the colour and the make of truck.
    const pick = Math.floor(random() * CABS.length * TRUCK_STYLES)
    super(truck(Math.floor(pick / CABS.length), CABS[pick % CABS.length]))
    this.group.visible = false
  }

  run(steps: (() => boolean)[]): void {
    this.steps = steps
    this.index = 0
    this.active = true
    this.group.visible = true
  }

  // A step that sets the truck off, then lasts until it gets there.
  trip(start: () => void): () => boolean {
    let started = false
    return () => {
      if (!started) start()
      started = true
      return this.drive(this.dt)
    }
  }

  wait(seconds: () => number): () => boolean {
    let left = -1
    return () => {
      if (left < 0) left = seconds()
      left -= this.dt
      return left <= 0
    }
  }

  update(dt: number): void {
    if (!this.active) return
    this.dt = dt
    if (this.steps[this.index]()) this.index++
    if (this.index >= this.steps.length) {
      this.active = false
      this.group.visible = false
    }
  }
}
