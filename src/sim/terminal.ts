import * as THREE from 'three/webgpu'
import { BLOCK, BOX, LIVERIES, QUAY_TOP, TERMINAL_X1, rbox } from '../kit'
import { DRIVE_TIERS, GANTRY_TIERS } from '../models/cranes'
import { TRACTOR_TIERS, barrier, booth, docker, signalMast } from '../models/vehicles'
import { C } from '../style'
import type { Water } from '../water'
import { BoxPool } from './boxes'
import { Crane, type CraneTask } from './crane'
import { pace, type Worker } from './crew'
import { Dredger } from './dredger'
import { CARGO, PACE, RETAINER_FLOOR, STAGE_PAY, UPGRADES, WORKS, type CargoId, type ChainStage, type Job, type Works, type Contract, type Game, type Offer, type Port, type UpgradeId } from './game'
import { Gantry, type Lift } from './gantry'
import { blueprint, outline, pulse } from './ghost'
import {
  APRON_Z, BAY_Z, BERTH_X, CLASSES, GATE_STOP_X, GATE_X, GROUND_Y, LANE_Z,
  TOWN_IN_Z, TRUCK_SPAWN_X, TUG_QUAY, type ClassId,
} from './layout'
import { shipBody } from '../models/ships'
import { LIFT, yardFixture, type Fixture } from '../models/vessels'
import { stormMast, tidePole } from '../models/signals'
import { Smoke } from '../models/smoke'
import { hourAt } from './clock'
import { Ship, berthZ, type Call } from './ship'
import { Tug, type Station } from './tug'
import { BAY_PITCH, Carrier, Truck, tour, type Spot, type Vehicle } from './vehicles'
import { YARD, Yard, YARD_SIZE, type StackRef, type YardBox } from './yard'
import { random } from './random'

export const MAX_QUEUE = 5
// Ships with no contract ask for a berth now and then. A request stands for a while, then goes elsewhere.
export const ASKING = { gap: [150, 300], stands: 150, most: 2 }
// What a ship off the timetable pays over the port's going rate, and what share of that comes as her bonus.
const SPOT = { premium: 1.25, bonus: 0.8, fee: { goods: 1, food: 1.35, machines: 1.6 } }
// A ship's deadline: a start, and so long for every box.
const WINDOW = { base: 240, perBox: 4 }
const TRAMPS = ['WANDERER', 'OSPREY', 'DRIFTWOOD', 'CORMORANT', 'SALTWIND', 'LODESTAR', 'HALCYON', 'MARLIN', 'TERN', 'BRIGHTWATER']
const TRAMP_HULLS = [C.berry, C.navy, C.tealDeep, C.maroon, C.iron]
// How many boxes a ship of each size brings when she comes off the timetable, least and most.
const TRAMP_LOAD: Record<ClassId, [number, number]> = { feeder: [6, 14], panamax: [20, 40], neo: [40, 70] }
const GATE_INTERVAL = 12
// The road to the far end of the yard is long: a lane keeps this many trucks on it at once.
const TRUCKS_PER_LANE = 5
const DIG_TIME = 1.5
const STARVE_LIMIT = 8
const FADE = 90
const POP_TIME = 0.45
const BOOTH_PITCH = 0.125
// A truck stops this far short of its booth, with its nose at the barrier.
const BOOTH_STOP = 0.15
// A quay crane's sill reaches this far either side of it: no crossing the rails there.
const CRANE_REACH = 0.34
// Imports ready and uncollected: beyond this the gate is falling behind.
const GATE_BACKLOG = 20
// Seconds ships have lately spent ready to move with the channel taken: beyond this, tugs are worth it.
const CHANNEL_WAIT = 20
// Seconds ships have lately spent waiting for the tide: beyond this, deeper dredging is worth it.
const TIDE_WAIT = 30
const BOOTH_Z = -0.76
// How far either side of its centre a berth reaches along the quay.
const BERTH_REACH = 1.62
// Where the pointer stops meaning the quay and starts meaning the yard road, and where the gate area begins.
const ROAD_EDGE = -0.48
const GATE_AREA = 2.97
const OFFICE = { x: 3.4, z: -0.98, w: 0.4, d: 0.26 }
const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_Y)
const SEA = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

// Something in the port the player can point at and build on or improve.
export type Target =
  | { kind: 'berth'; berth: number }
  | { kind: 'site'; berth: number }
  | { kind: 'channel' }
  | { kind: 'block'; block: number }
  | { kind: 'plot'; block: number }
  | { kind: 'tractors' }
  | { kind: 'gate' }
  | { kind: 'office' }

// Drawn, and inside nothing hidden.
function shown(object: THREE.Object3D | null): boolean {
  for (let o = object; o; o = o.parent) if (!o.visible) return false
  return true
}
// Berths busier than this have no room for another line.
export const ROOM_TO_GROW = 0.6
const BUSY_FADE = 240
const PACE_FADE = 600
// Berth-seconds a box, assumed until enough boxes have been moved to measure it.
const UNKNOWN_PACE = 10
// Seconds between paydays.
const PAYDAY = 60
// Where crews wait outside the terminal office.
const CREW_ROOM = { x: 3.27, z: -0.835, pitch: 0.05 }
const CRANE_COLORS = [C.signalRed, C.signalBlue, C.signalYellow, C.teal]
// A crane sent to the next berth stops this far from its middle, on the side it came from.
const MOVED_TO = 1.15
// A berth's signal mast stands on the quay edge by the bows of its ships, clear of the bollards.
const MAST = { x: 1.45, z: -0.022 }
// Which generation of machine a speed level has reached, spread evenly over the upgrade's levels.
function tierOf(level: number, id: UpgradeId, tiers: number): number {
  const max = UPGRADES.find((u) => u.id === id)!.max
  return Math.min(tiers - 1, Math.floor((level * tiers) / (max + 1)))
}
const SIZES: ClassId[] = ['feeder', 'panamax', 'neo']
// How far the water stands above and below its mean at high and low tide.
const TIDE_RANGE = 0.04
// Where the storm signal mast stands on the quay, and the tide pole in the water off it.
const STORM_MAST = { x: 3.25, z: -0.14 }
const TIDE_POLE = { x: 0.95, z: 0.045 }

// A ship asking to call, and when she gives up and goes elsewhere.
export interface Request {
  id: number
  call: Call
  until: number
}

export type Cause = 'tractors' | 'yardCranes' | 'yard' | 'exports' | 'gate' | 'channel' | 'queue'

export interface Diagnosis {
  cause: Cause | null
  stage: ChainStage | null
  text: string
}

function boothAt(lane: number): THREE.Group {
  const group = booth()
  group.position.set(GATE_STOP_X + 0.02 - lane * BOOTH_PITCH, GROUND_Y, BOOTH_Z)
  return group
}

// One docker stands outside the office for every crew waiting for a machine.
function dockerAt(place: number): THREE.Group {
  const group = docker()
  group.position.set(CREW_ROOM.x + place * CREW_ROOM.pitch, GROUND_Y, CREW_ROOM.z)
  return group
}

export class Terminal {
  readonly group = new THREE.Group()
  readonly yard = new Yard()
  readonly queue: Call[] = []
  // Ships off the timetable asking for a berth.
  readonly requests: Request[] = []
  // Seconds lost to each cause, fading over a couple of minutes.
  readonly lost = { tractors: 0, yard: 0, yardCranes: 0, exports: 0, channel: 0, queue: 0, working: 0, home: 0, tide: 0 }
  // Every box that has crossed the quay or the gate, in each direction.
  readonly flow = { landed: 0, shipped: 0, gateIn: 0, gateOut: 0 }
  // Hooks for the interface: a box was paid for, a ship left, something new was built.
  onPay: (at: THREE.Vector3, amount: number) => void = () => {}
  onDeparture: (at: THREE.Vector3, bonus: number, onTime: boolean, permit: boolean, note: string) => void = () => {}
  onBuilt: (at: THREE.Vector3) => void = () => {}
  onPayday: (at: THREE.Vector3, amount: number) => void = () => {}
  // One of the player's own ships has put to sea, and what the voyage costs.
  onVoyage: (at: THREE.Vector3, cost: number) => void = () => {}
  private ships: Ship[]
  private cranes: Crane[] = []
  private carriers: Carrier[] = []
  private trucks: Truck[] = []
  // Every vehicle on this port's roads, so each can keep clear of the others.
  private onRoad: Vehicle[] = []
  // Places promised to vehicles, so that no two are ever sent to the same one.
  private claims = new Map<Vehicle, Spot[]>()
  // Idle tractors that have been given a quay bay to wait in.
  private resting = new Set<Carrier>()
  private booths: THREE.Group[] = []
  // The barriers across the way in and the way out, each with the lane it guards.
  private barriers: { arm: THREE.Object3D; x: number; z: number }[] = []
  private tugs: Tug[] = []
  // Who works each machine, and the yard blocks with nobody on their crane.
  private hands = new Map<object, Worker>()
  private unworked = new Set<number>()
  private nextAsk = 0
  private asked = 0
  private luck = 0
  // This harbour's own weather and water: when the next typhoon strikes, until when it blows, and the signal
  // mast and tide pole that show how things stand.
  private nextBlow = Infinity
  private blowUntil = 0
  private stormMast: ReturnType<typeof stormMast> | null = null
  private tidePole: ReturnType<typeof tidePole> | null = null
  // What stands on each yard that is not a container berth, and when each next has work to do.
  private fixtures = new Map<number, { works: Works; fixture: Fixture }>()
  private nextJob = new Map<number, number>()
  private planned: Works | null = null
  // The dredger at work, and how deep it has made the channel so far.
  private dredger: Dredger | null = null
  private dredged: number
  private seaway = new THREE.ClippingGroup()
  private masts = new THREE.Group()
  private mastKey = ''
  private roadside = new THREE.ClippingGroup()
  private smoke = new Smoke()
  private puffClock = 0
  private dockers: THREE.Group[] = []
  private payClock = 0
  private busy = 0
  // Berth-seconds used and boxes moved lately, both fading, so their ratio is the going pace per box.
  private berthTime = 0
  private moved = 0
  private gantries = new Map<number, Gantry>()
  private pool = new BoxPool()
  private nextCall = new Map<string, number>()
  private gateClock = 0
  private truckSerial = 0
  private exportsInbound = 0
  private live = false
  private pops: { object: THREE.Object3D; t: number; base: number }[] = []
  private wanted: Offer | null = null
  private marked: Target | null = null
  private markKey = ''
  private markRims: THREE.Mesh[] = []
  private pads = new THREE.Group()
  private previewKey = ''
  private ghosts = new THREE.Group()
  private spot: THREE.Vector3 | null = null
  private rims: THREE.Mesh[] = []

  constructor(private game: Game, readonly port: Port, private water: Water) {
    this.ships = BERTH_X.map((x) => new Ship(x, water))
    for (const ship of this.ships) this.group.add(ship.group)
    // Trucks drive on past the end of the block, so they are cut off where it is cut.
    this.roadside.clippingPlanes = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), BLOCK.x1)]
    this.seaway.clippingPlanes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), -BLOCK.x0), ...this.roadside.clippingPlanes]
    this.dredged = port.levels.dredge
    this.group.add(this.yard.mesh, this.ghosts, this.pads, this.roadside, this.seaway, this.masts, this.smoke.mesh)
    this.yard.load = (block) => this.gantries.get(block)?.pending ?? 0
    for (const [x, z, side, lane] of [[TERMINAL_X1 - 0.02, BAY_Z - 0.068, 1, BAY_Z], [TERMINAL_X1, -0.272, -1, -0.335]]) {
      const gate = barrier()
      gate.position.set(x, GROUND_Y, z)
      gate.scale.z = side
      this.group.add(gate)
      this.barriers.push({ arm: gate.getObjectByName('arm')!, x, z: lane })
    }
    this.luck = (game.ports.indexOf(port) + 1) * 7919
    this.nextAsk = ASKING.gap[1]
    const rules = port.def.rules
    if (rules?.typhoon) {
      const [least, most] = rules.typhoon.every
      this.nextBlow = game.time + least + this.roll() * (most - least)
      this.stormMast = stormMast()
      this.stormMast.group.position.set(STORM_MAST.x, QUAY_TOP, STORM_MAST.z)
      this.group.add(this.stormMast.group)
    }
    if (rules?.tide) {
      this.tidePole = tidePole()
      this.tidePole.group.position.set(TIDE_POLE.x, 0, TIDE_POLE.z)
      this.group.add(this.tidePole.group)
    }
    this.configure()
    this.yard.seed(port.yardImports, port.yardExports)
    this.live = true
  }

  get waiting(): number {
    return this.queue.length
  }

  get yardFill(): number {
    return this.yard.capacity ? this.yard.committed / this.yard.capacity : 0
  }

  // Pairs of vehicles standing on the same ground right now. There should never be any.
  get overlaps(): number {
    const out = this.onRoad.filter((vehicle) => vehicle.group.visible)
    let pairs = 0
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        if (Math.abs(out[i].x - out[j].x) < 0.27 && Math.abs(out[i].z - out[j].z) < 0.07) pairs++
      }
    }
    return pairs
  }

  get storm(): boolean {
    return this.game.time < this.port.stormUntil
  }

  get held(): boolean {
    return this.game.time < this.port.holdUntil
  }

  get dredging(): boolean {
    return this.dredger !== null
  }

  // A typhoon is overhead: nothing works and nothing moves.
  get typhoon(): boolean {
    return this.game.time < this.blowUntil
  }

  // Seconds until the typhoon that has been signalled strikes, or null with no signal up.
  get signal(): number | null {
    const typhoon = this.port.def.rules?.typhoon
    const left = this.nextBlow - this.game.time
    return typhoon && left <= typhoon.warning ? Math.max(0, left) : null
  }

  // Brings the next typhoon this near, for looking at it.
  hasten(seconds: number): void {
    if (this.port.def.rules?.typhoon) this.nextBlow = this.game.time + seconds
  }

  // The tide, from -1 at low water to 1 at high. A harbour without one stands at 0.
  get tide(): number {
    const tide = this.port.def.rules?.tide
    return tide ? Math.cos((this.game.time / tide.period) * Math.PI * 2) : 0
  }

  // Whether there is water for the deepest ships now, and the seconds until that changes. Null with no tide.
  get tideTurn(): { open: boolean; turns: number } | null {
    const tide = this.port.def.rules?.tide
    if (!tide) return null
    const phase = ((this.game.time / tide.period) % 1) * Math.PI * 2
    const ebb = Math.acos(tide.sill)
    const seconds = (angle: number) => (angle / (Math.PI * 2)) * tide.period
    if (phase < ebb) return { open: true, turns: seconds(ebb - phase) }
    if (phase < Math.PI * 2 - ebb) return { open: false, turns: seconds(Math.PI * 2 - ebb - phase) }
    return { open: true, turns: seconds(Math.PI * 2 - phase + ebb) }
  }

  // The sizes of ship that have to wait for the tide: those that need all the depth the channel has.
  get tideBound(): ClassId[] {
    if (!this.port.def.rules?.tide) return []
    return SIZES.filter((size) => CLASSES[size].dredge > 0 && CLASSES[size].dredge === this.dredged)
  }

  // Whether the state of the tide keeps a ship from moving.
  private ebbed(call: Call): boolean {
    return !call.work && this.tideBound.includes(call.ship) && this.tideTurn?.open === false
  }

  // Whether trucks are held up on the road at this hour.
  get rush(): boolean {
    const hour = hourAt(this.game.time)
    return this.port.def.rules?.rush?.hours.some(([from, to]) => hour >= from && hour < to) ?? false
  }

  // The harbour's own weather and water: a typhoon strikes when its warning has run out, and the tide turns.
  private season(): void {
    const g = this.game
    const rules = this.port.def.rules
    if (rules?.typhoon && g.time >= this.nextBlow) {
      const { every, blow } = rules.typhoon
      this.blowUntil = g.time + blow
      this.port.holdUntil = Math.max(this.port.holdUntil, this.blowUntil)
      this.port.stormUntil = Math.max(this.port.stormUntil, this.blowUntil)
      this.nextBlow = this.blowUntil + every[0] + this.roll() * (every[1] - every[0])
    }
    if (this.stormMast) this.stormMast.shapes.visible = this.signal !== null || this.typhoon
    if (this.tidePole) {
      this.water.level = this.tide * TIDE_RANGE
      const open = this.tideTurn!.open
      this.tidePole.open.visible = open
      this.tidePole.shut.visible = !open
    }
  }

  // The ship at a berth or on her way to it, as the call she is making, or null.
  visiting(berth: number): Call | null {
    const ship = this.ships[berth]
    return ship.stage === 'away' ? null : ship.call
  }

  // The line whose ship that is, or null.
  calling(berth: number): string | null {
    return this.visiting(berth)?.contract ?? null
  }

  // Where each of a berth's cranes stands along the quay.
  cranesAt(berth: number): number[] {
    return this.cranes.filter((crane) => crane.berth === berth).map((crane) => crane.x)
  }

  enqueue(call: Call): void {
    this.queue.push(call)
  }

  // Chance of the terminal's own, so that ships asking to call do not disturb the rest of the simulation.
  private roll(): number {
    this.luck = (this.luck * 1664525 + 1013904223) % 4294967296
    return this.luck / 4294967296
  }

  // A ship off the timetable asks for a berth: any size the channel takes, with any cargo.
  private ask(): void {
    const g = this.game
    const port = this.port
    const sizes = SIZES.slice(0, 1 + port.levels.dredge)
    const ship = sizes[Math.floor(this.roll() ** 1.6 * sizes.length)]
    const cargo = (Object.keys(CARGO) as CargoId[])[Math.floor(this.roll() * 3)]
    const [least, most] = TRAMP_LOAD[ship]
    const unload = Math.round(least + this.roll() * (most - least))
    const load = Math.round(unload * (0.5 + this.roll() * 0.4))
    const fee = Math.round(port.def.contracts[0].fee * SPOT.premium * SPOT.fee[cargo])
    const boxes = unload + load
    this.requests.push({
      id: ++this.asked,
      until: g.time + ASKING.stands,
      call: {
        name: TRAMPS[Math.floor(this.roll() * TRAMPS.length)], ship, cargo, unload, load, fee,
        hull: TRAMP_HULLS[Math.floor(this.roll() * TRAMP_HULLS.length)],
        bonus: Math.round((boxes * fee * SPOT.bonus) / 10) * 10,
        window: WINDOW.base + WINDOW.perBox * boxes * CARGO[cargo].heft, arrivedAt: g.time, contract: null,
      },
    })
  }

  // Lets a ship that asked come in. She joins the queue offshore, and her deadline starts now.
  accept(id: number): boolean {
    const i = this.requests.findIndex((request) => request.id === id)
    if (i < 0 || this.queue.length >= MAX_QUEUE) return false
    const [{ call }] = this.requests.splice(i, 1)
    this.queue.push({ ...call, arrivedAt: this.game.time })
    return true
  }

  // Whether a ship asking to call could be turned round inside her deadline at the pace ships have been
  // going lately, if a berth were free for her now.
  fits(call: Call): boolean {
    const pace = this.moved > 10 ? this.berthTime / this.moved : UNKNOWN_PACE
    return (call.unload + call.load) * pace * CARGO[call.cargo].heft < call.window * 0.8
  }

  decline(id: number): void {
    const i = this.requests.findIndex((request) => request.id === id)
    if (i >= 0) this.requests.splice(i, 1)
  }

  // Share of the time the open berths have had a ship on them lately, from 0 to 1.
  get load(): number {
    return this.busy
  }

  // How much busier the berths would get with this line, judged by how long ships have been taking here.
  forecast(contract: Contract): number {
    const pace = this.moved > 10 ? this.berthTime / this.moved : UNKNOWN_PACE
    return ((contract.unload + contract.load) * pace) / this.port.every(contract) / this.port.quays.length
  }

  // Seconds until a contract's next ship arrives offshore.
  nextIn(contract: string): number | null {
    const due = this.nextCall.get(contract)
    return due === undefined ? null : Math.max(0, due - this.game.time)
  }

  // The slowest link right now, and what to do about it. A typhoon on its way is said first.
  diagnosis(): Diagnosis {
    const found = this.diagnose()
    const signal = this.signal
    if (signal === null) return found
    const left = `${Math.floor(signal / 60)}:${String(Math.floor(signal % 60)).padStart(2, '0')}`
    return { ...found, text: `Typhoon signal is up: it strikes in ${left}. ${found.text}` }
  }

  private diagnose(): Diagnosis {
    const l = this.lost
    const port = this.port
    // Only advise what can actually be built: not something still waiting on something else.
    const room = (id: UpgradeId) => port.levels[id] < port.maxLevel(id) && port.needs({ id }) === null
    const backlog = this.yard.ready(this.game.time)
    if (this.held) {
      const text = this.typhoon ? 'Everything is lashed down until the typhoon has blown over.'
        : this.storm ? 'Cranes are stopped for the storm.' : 'Work is stopped.'
      return { cause: null, stage: null, text }
    }
    if (this.dredger) return { cause: null, stage: null, text: 'The channel is shut while the dredger deepens it.' }
    const idle = port.vacancies().length
    if (idle) {
      return {
        cause: null, stage: null,
        text: `${idle === 1 ? 'A machine stands' : `${idle} machines stand`} idle with nobody to work ${idle === 1 ? 'it' : 'them'}. Take someone on in the Crew tab.`,
      }
    }
    if (l.yard > 6 && l.yard >= l.tractors) {
      // A full yard is the gate's doing when boxes sit ready with no truck to take them.
      if (backlog > 12 && room('gate')) {
        return { cause: 'gate', stage: 'Gate', text: 'The yard is full of imports waiting for trucks. Add gate lanes to clear them.' }
      }
      if (!room('yardBlock') && !room('stackHeight') && port.def.rules?.plots) {
        return {
          cause: 'yard', stage: null,
          text: 'The yard is full and the city has no more ground to give. Ask the biggest lines for fewer sailings, or keep lines whose cargo leaves sooner.',
        }
      }
      return {
        cause: 'yard', stage: 'Yard',
        text: 'The yard is full, so cranes are waiting for space. Add yard blocks or stack higher.',
      }
    }
    if (l.yardCranes > 30 && l.yardCranes > l.working * 0.5) {
      if (!room('yardCrane') && !room('yardBlock')) {
        return {
          cause: 'yardCranes', stage: null,
          text: 'Tractors and trucks are queuing at the yard cranes, and the yard has no room to grow. This port has all the ships it can turn round: ask a line for fewer sailings.',
        }
      }
      return {
        cause: 'yardCranes', stage: 'Yard',
        text: 'Tractors and trucks are queuing at the yard cranes. Speed the yard cranes up, or add yard blocks.',
      }
    }
    if (l.tractors > l.working * 0.3 && l.tractors > 6) {
      return { cause: 'tractors', stage: 'Yard', text: 'Cranes are waiting for tractors. Add tractors or make them faster.' }
    }
    if (l.exports > 10 && room('gate')) {
      return { cause: 'exports', stage: 'Gate', text: 'Ships are waiting for export boxes. Add gate lanes to bring them in faster.' }
    }
    if (backlog > GATE_BACKLOG && room('gate')) {
      return { cause: 'gate', stage: 'Gate', text: 'Imports are piling up faster than trucks collect them. Add gate lanes.' }
    }
    if (l.tide > TIDE_WAIT) {
      const text = 'Deep ships are waiting for high water. '
      return room('dredge')
        ? { cause: 'channel', stage: 'Berth', text: text + 'Dredge deeper than they need and they come and go at any tide.' }
        : { cause: 'channel', stage: null, text: text + 'The dredger is on its way.' }
    }
    if (l.channel > CHANNEL_WAIT && room('tug')) {
      return {
        cause: 'channel', stage: 'Berth',
        text: 'Ships are waiting for the channel to clear. Tugs move them in and out faster.',
      }
    }
    if (l.queue > 40) {
      const text = 'Ships are queuing offshore. '
      // Late ships earn no stamps, so a port that cannot keep up cannot wait for a permit to save it.
      const drop = port.reliability < 50 && port.contracts.length > 1 ? ' Or drop a line until the port keeps up.' : ''
      if (l.home > 20) {
        return {
          cause: 'queue', stage: 'Berth',
          text: text + 'Some are waiting for their own berth while another stands empty: let those lines take any berth.',
        }
      }
      if (room('crane') || room('craneSpeed')) {
        return { cause: 'queue', stage: 'Cranes', text: text + 'Add cranes or speed them up.' + drop }
      }
      if (room('berth')) {
        return { cause: 'queue', stage: 'Berth', text: text + 'The cranes are at their limit: open another berth.' + drop }
      }
      if (room('tug')) return { cause: 'queue', stage: 'Berth', text: text + 'Tugs would clear the channel sooner.' + drop }
      return { cause: 'queue', stage: null, text: text + 'This port is working at its limit.' + drop }
    }
    if (this.busy < ROOM_TO_GROW) {
      return { cause: null, stage: null, text: 'Running smoothly, with room for another line.' + this.tip() }
    }
    // Nothing is wrong, but another line would not fit. Point at what would make room.
    const text = `Running smoothly, but the berths are busy ${Math.round(this.busy * 100)}% of the time. `
    if (room('crane') || room('craneSpeed')) {
      return { cause: null, stage: 'Cranes', text: text + 'More or faster cranes would make room for another line.' }
    }
    if (room('berth')) return { cause: null, stage: 'Berth', text: text + 'Another berth would make room for another line.' }
    return { cause: null, stage: null, text: text + 'This port is close to its limit.' }
  }

  // With nothing wrong, a word on where a better arrangement would pay: the richest line whose last ship
  // left on time but not early, when it has no berth of its own to be fitted out for it.
  private tip(): string {
    const port = this.port
    if (!port.levels.berth) return ''
    const slow = port.contracts
      .filter((id) => port.last[id] && port.last[id].used <= 1 && port.last[id].used > PACE[0].within && port.home(id) === null)
      .map((id) => port.contract(id))
      .sort((a, b) => b.bonus - a.bonus)[0]
    return slow ? ` ${slow.line} would pay more for a faster turn: keep a berth for its ships and give it more cranes.` : ''
  }

  hint(): string {
    return this.diagnosis().text
  }

  // How bad each kind of delay has been lately, from 0 to 1.
  delays(): Record<Cause, number> {
    const l = this.lost
    const craneTime = FADE * this.cranes.length * 0.6
    const share = (seconds: number, full: number) => Math.min(1, seconds / full)
    return {
      tractors: share(l.tractors, craneTime),
      yardCranes: share(l.yardCranes, FADE * this.gantries.size * 1.2),
      yard: share(l.yard, craneTime),
      exports: share(l.exports, craneTime),
      gate: share(this.yard.ready(this.game.time), GATE_BACKLOG * 1.5),
      channel: share(l.channel, CHANNEL_WAIT * 2.5),
      queue: share(l.queue, FADE * 3),
    }
  }

  // Where a small blueprint is, so the interface can point at it. Null for big ones and when nothing is shown.
  get previewSpot(): THREE.Vector3 | null {
    return this.spot
  }

  // Show what an offer would build, as a blueprint in the world. Null clears it.
  preview(offer: Offer | null): void {
    this.wanted = offer
  }

  // Show what founding a yard on the next stretch of quay would build. Null clears it.
  plan(works: Works | null): void {
    this.planned = works
  }

  // What a yard is working on: the ship, what she is, and how far along the work is, from 0 to 1.
  job(berth: number): { call: Call; done: number } | null {
    const ship = this.ships[berth]
    return ship.stage !== 'away' && ship.call?.work ? { call: ship.call, done: ship.done } : null
  }

  // Outline the thing the player is pointing at or has picked. Null clears it.
  mark(target: Target | null): void {
    this.marked = target
  }

  // What in the port lies under a ray from the camera: first anything solid, then the ground or water.
  pick(raycaster: THREE.Raycaster): Target | null {
    const port = this.port
    const owners = new Map<THREE.Object3D, Target>()
    for (const crane of this.cranes) owners.set(crane.group, { kind: 'berth', berth: crane.berth })
    for (const carrier of this.carriers) owners.set(carrier.group, { kind: 'tractors' })
    for (const [block, gantry] of this.gantries) owners.set(gantry.group, { kind: 'block', block })
    for (const lane of this.booths) owners.set(lane, { kind: 'gate' })
    for (const truck of this.trucks) if (truck.active) owners.set(truck.group, { kind: 'gate' })
    for (const waiting of this.dockers) owners.set(waiting, { kind: 'office' })
    for (const ship of this.ships) if (ship.model) owners.set(ship.model, { kind: 'channel' })
    for (const tug of this.tugs) owners.set(tug.boat, { kind: 'channel' })
    if (this.dredger) owners.set(this.dredger.boat, { kind: 'channel' })
    for (const mast of this.masts.children) owners.set(mast, { kind: 'berth', berth: mast.userData.berth as number })
    for (const [berth, { fixture }] of this.fixtures) owners.set(fixture.group, { kind: 'berth', berth })
    owners.set(this.yard.mesh, { kind: 'block', block: -1 })
    for (const hit of raycaster.intersectObjects([...owners.keys()], true)) {
      let object: THREE.Object3D | null = hit.object
      if (!shown(object)) continue
      while (object && !owners.has(object)) object = object.parent
      if (object === this.yard.mesh) return { kind: 'block', block: this.blockAt(hit.point.x) ?? port.blocks[0] }
      return owners.get(object!)!
    }

    const at = new THREE.Vector3()
    if (raycaster.ray.intersectPlane(GROUND, at) && at.z <= 0 && at.z >= BLOCK.z0 && at.x >= BLOCK.x0 && at.x <= TERMINAL_X1) {
      if (at.z < YARD.rowZ0 + 0.05) {
        const block = this.blockAt(at.x)
        if (block !== null && !port.plots.includes(block)) return null
        if (block !== null) return port.blocks.includes(block) ? { kind: 'block', block } : { kind: 'plot', block }
        if (at.x < GATE_AREA) return null
        const inOffice = Math.abs(at.x - OFFICE.x) < OFFICE.w / 2 && Math.abs(at.z - OFFICE.z) < OFFICE.d / 2
        return { kind: inOffice ? 'office' : 'gate' }
      }
      if (at.z < ROAD_EDGE) return { kind: at.x > GATE_AREA ? 'gate' : 'tractors' }
      const berth = this.berthAt(at.x)
      if (berth === null) return null
      return berth <= port.levels.berth ? { kind: 'berth', berth } : { kind: 'site', berth }
    }
    if (raycaster.ray.intersectPlane(SEA, at) && at.z > 0 && at.z < BLOCK.z1 && at.x > BLOCK.x0 && at.x < BLOCK.x1) {
      const berth = this.berthAt(at.x)
      if (berth !== null && berth > port.levels.berth && at.z < LANE_Z - 0.1) return { kind: 'site', berth }
      return { kind: 'channel' }
    }
    return null
  }

  private blockAt(x: number): number | null {
    for (let block = 0; block < YARD.blocks; block++) {
      if (Math.abs(x - this.yard.blockX(block)) <= YARD_SIZE.x / 2 + 0.1) return block
    }
    return null
  }

  private berthAt(x: number): number | null {
    const berth = BERTH_X.findIndex((center) => Math.abs(x - center) <= BERTH_REACH)
    return berth < 0 ? null : berth
  }

  // Where on the quay a new crane for this berth would stand: the spot clearest of the cranes already there.
  private craneSpot(berth: number): number {
    let best = BERTH_X[berth]
    let room = -1
    for (const offset of [0, -1.15, 1.15, -0.58, 0.58]) {
      const x = BERTH_X[berth] + offset
      const clear = this.cranes.reduce((least, crane) => Math.min(least, Math.abs(crane.x - x)), Infinity)
      if (clear > room) {
        room = clear
        best = x
      }
    }
    return best
  }

  // Whether a place is promised to, or stood on by, any vehicle but this one.
  private taken(spot: Spot, by: Vehicle | null): boolean {
    for (const [vehicle, spots] of this.claims) {
      if (vehicle !== by && spots.some((s) => s.place === spot.place && Math.abs(s.x - spot.x) < BAY_PITCH - 1e-6)) return true
    }
    const z = spot.place === 'bay' ? BAY_Z : APRON_Z
    return this.onRoad.some((v) => v !== by && v.group.visible && Math.abs(v.z - z) < 0.05 && Math.abs(v.x - spot.x) < BAY_PITCH - 1e-6)
  }

  // The nearest quay bay to x that nothing is using and no crane is working over.
  private parking(x: number, by: Vehicle | null, clearOf = Infinity): number {
    const working = (at: number) => Math.abs(at - clearOf) < BAY_PITCH
      || this.cranes.some((crane) => crane.task && Math.abs(crane.task.x - at) < BAY_PITCH)
    const west = BERTH_X[BERTH_X.length - 1] - 1.4
    const east = BERTH_X[0] + 3.6
    const from = Math.min(east, Math.max(west, x))
    for (let k = 0; k < 100; k++) {
      const at = from + Math.ceil(k / 2) * (k % 2 ? 1 : -1) * BAY_PITCH
      if (at >= west && at <= east && !working(at) && !this.taken({ x: at, place: 'quay' }, by)) return at
    }
    return from
  }

  // An idle tractor goes and waits under the quay cranes, in a bay nobody needs.
  private park(carrier: Carrier, clearOf = Infinity): void {
    const spot: Spot = { x: this.parking(carrier.x, carrier, clearOf), place: 'quay' }
    this.claims.set(carrier, [spot])
    this.resting.add(carrier)
    carrier.go(spot)
  }

  // The idle tractor to send to a quay crane at x, once the bay under the crane is free. A tractor
  // resting in the way is moved on.
  private summon(x: number): Carrier | null {
    const carrier = this.idleCarrier(x)
    if (!carrier || !this.taken({ x, place: 'quay' }, carrier)) return carrier
    for (const other of this.resting) {
      if (other !== carrier && other.idle && Math.abs(this.claims.get(other)![0].x - x) < BAY_PITCH) this.park(other, x)
    }
    return null
  }

  private assign(carrier: Carrier, x: number, stackX: number): void {
    this.resting.delete(carrier)
    this.claims.set(carrier, [{ x, place: 'quay' }, { x: stackX, place: 'bay' }])
  }

  // Bring the physical port in line with what the player owns.
  private configure(): void {
    this.port.settle()
    const { levels } = this.port
    const owned = this.port.cranes.reduce((sum, n) => sum + n, 0)
    const standing = (berth: number) => this.cranes.filter((c) => c.berth === berth)
    // A crane sent to the next berth is the one standing nearest it. It sets off along the rails once
    // its lift is done. Berths are numbered westwards.
    for (let berth = 0; berth < BERTH_X.length; berth++) {
      while (standing(berth).length > this.port.cranes[berth]) {
        const to = [berth - 1, berth + 1].find((b) => b >= 0 && standing(b).length < this.port.cranes[b])
        const team = standing(berth)
        const crane = to !== undefined && to > berth ? team[0] : team[team.length - 1]
        if (to === undefined || crane.task) break
        crane.berth = to
        crane.rest = BERTH_X[to] + (to > berth ? MOVED_TO : -MOVED_TO)
      }
    }
    // A berth turned over to other work loses its cranes, and each yard has what its work needs standing on it.
    for (let i = this.cranes.length - 1; i >= 0; i--) {
      const crane = this.cranes[i]
      if (this.port.yards[crane.berth] === 'boxes' || crane.task) continue
      crane.group.removeFromParent()
      this.cranes.splice(i, 1)
    }
    for (let berth = 0; berth < BERTH_X.length; berth++) {
      const works = this.port.worksAt(berth)
      const standingNow = this.fixtures.get(berth)
      if ((standingNow?.works ?? null) === works) continue
      standingNow?.fixture.group.removeFromParent()
      this.fixtures.delete(berth)
      if (!works) continue
      const fixture = yardFixture(works)
      fixture.group.position.x = BERTH_X[berth]
      this.group.add(fixture.group)
      this.fixtures.set(berth, { works, fixture })
      this.appear(fixture.group)
    }
    // A crane belongs to a berth and works only that berth's ships.
    for (let berth = 0; berth < BERTH_X.length; berth++) {
      while (this.cranes.length < owned && standing(berth).length < this.port.cranes[berth]) {
        const crane = new Crane(this.craneSpot(berth), berth, CRANE_COLORS[this.cranes.length % CRANE_COLORS.length], this.pool)
        crane.onMove = (task) => this.paid(task, crane)
        this.cranes.push(crane)
        this.group.add(crane.group)
        this.appear(crane.group)
      }
    }
    // Speed upgrades are new machines: the faster tractor and yard crane look the part.
    const tractorTier = tierOf(levels.carrierSpeed, 'carrierSpeed', TRACTOR_TIERS)
    const gantryTier = tierOf(levels.yardCrane, 'yardCrane', GANTRY_TIERS)
    const driveTier = tierOf(levels.craneSpeed, 'craneSpeed', DRIVE_TIERS)
    while (this.carriers.length < 1 + levels.carrier) {
      const carrier = new Carrier(tractorTier)
      const x = this.parking(BERTH_X[0], null)
      carrier.place(x, APRON_Z)
      this.claims.set(carrier, [{ x, place: 'quay' }])
      this.resting.add(carrier)
      this.join(carrier)
      this.carriers.push(carrier)
      this.group.add(carrier.group)
      this.appear(carrier.group)
    }
    while (this.booths.length < 1 + levels.gate) {
      const lane = boothAt(this.booths.length)
      this.booths.push(lane)
      this.group.add(lane)
      this.appear(lane)
    }
    while (this.dockers.length < this.port.crews) {
      const waiting = dockerAt(this.dockers.length)
      this.dockers.push(waiting)
      this.group.add(waiting)
      this.appear(waiting)
    }
    while (this.dockers.length > this.port.crews) this.dockers.pop()!.removeFromParent()
    // Each berth's cranes share its ships out between them, west to east.
    this.cranes.sort((a, b) => a.x - b.x)
    for (let berth = 0; berth < BERTH_X.length; berth++) {
      const team = this.cranes.filter((c) => c.berth === berth)
      team.forEach((crane, k) => (crane.zone = [k / team.length, (k + 1) / team.length]))
    }
    // Every machine goes at the pace of whoever works it, and one with nobody on it takes no new work.
    this.hands.clear()
    for (let berth = 0; berth < BERTH_X.length; berth++) {
      const drivers = this.port.crew('crane', berth)
      standing(berth).forEach((crane, k) => drivers[k] && this.hands.set(crane, drivers[k]))
    }
    const drivers = this.port.crew('tractor')
    this.carriers.forEach((carrier, k) => drivers[k] && this.hands.set(carrier, drivers[k]))
    for (const crane of this.cranes) {
      const driver = this.hands.get(crane)
      crane.manned = driver !== undefined
      crane.speed = (1 + 0.15 * levels.craneSpeed) * (driver ? pace(driver, 'crane') : 1)
      if (crane.restyle(driveTier)) this.appear(crane.group, false)
    }
    for (const carrier of this.carriers) {
      const driver = this.hands.get(carrier)
      carrier.manned = driver !== undefined
      carrier.speed = 1.4 * (1 + 0.15 * levels.carrierSpeed) * (driver ? pace(driver, 'tractor') : 1)
      if (carrier.restyle(tractorTier)) this.appear(carrier.group, false)
    }
    while (this.tugs.length < levels.tug) {
      const tug = new Tug(this.tugs.length)
      this.tugs.push(tug)
      this.group.add(tug.boat)
      this.appear(tug.boat)
    }
    if (this.dredged < levels.dredge && !this.dredger) {
      this.dredger = new Dredger()
      this.seaway.add(this.dredger.boat)
    }
    this.yard.setBlocks(this.port.blocks)
    this.yard.tiers = 2 + levels.stackHeight
    this.unworked.clear()
    for (const block of this.yard.blocks) {
      let gantry = this.gantries.get(block)
      if (!gantry) {
        gantry = new Gantry(this.yard.blockX(block), gantryTier)
        this.gantries.set(block, gantry)
        this.group.add(gantry.group)
        this.appear(gantry.group)
      }
      const driver = this.port.crew('yard', block)[0]
      if (driver) this.hands.set(gantry, driver)
      else this.unworked.add(block)
      gantry.speed = (1 + 0.2 * levels.yardCrane) * (driver ? pace(driver, 'yard') : 1)
      if (gantry.restyle(gantryTier)) this.appear(gantry.group, false)
    }
  }

  private join(vehicle: Vehicle): void {
    vehicle.traffic = this.onRoad
    vehicle.shut = this.craneOver
    this.onRoad.push(vehicle)
  }

  // Something the player just bought rises out of the ground.
  private appear(object: THREE.Object3D, announce = true): void {
    if (!this.live) return
    this.pops.push({ object, t: 0, base: object.position.y })
    if (announce) this.onBuilt(new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()))
  }

  private animate(dt: number): void {
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const pop = this.pops[i]
      pop.t += dt
      const k = Math.min(1, pop.t / POP_TIME)
      const s = k < 1 ? Math.max(0.02, 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2) : 1
      pop.object.scale.y = s
      pop.object.position.y = GROUND_Y + (pop.base - GROUND_Y) * s
      if (k >= 1) this.pops.splice(i, 1)
    }
  }

  // Keeps the blueprint and the outline in the world in step with what the interface asked for.
  private showPreview(): void {
    const port = this.port
    const built = [this.cranes.length, this.carriers.length, this.gantries.size, this.booths.length, this.dockers.length,
      ...this.ships.map((ship) => ship.model?.id ?? 0)].join()
    const offer = this.wanted
    const site = port.levels.berth + 1
    const key = this.planned && site < BERTH_X.length ? ['plan', this.planned, site].join()
      : offer && port.level(offer) < port.max(offer)
        ? [offer.id, port.where(offer), port.levels[offer.id], port.levels.dredge, built].join() : ''
    if (key !== this.previewKey) {
      this.previewKey = key
      this.ghosts.clear()
      for (const rim of this.rims) rim.removeFromParent()
      this.rims = []
      this.spot = null
      if (key.startsWith('plan')) {
        const { group } = yardFixture(this.planned!)
        group.position.x = BERTH_X[site]
        this.ghosts.add(blueprint(group, false))
      } else if (offer && key) this.drawPreview(offer)
      if (offer && key && (offer.id === 'carrier' || offer.id === 'gate')) {
        this.spot = new THREE.Box3().setFromObject(this.ghosts).getCenter(new THREE.Vector3())
      }
    }
    const markKey = this.marked ? [JSON.stringify(this.marked), built].join() : ''
    if (markKey !== this.markKey) {
      this.markKey = markKey
      this.pads.clear()
      for (const rim of this.markRims) rim.removeFromParent()
      this.markRims = []
      if (this.marked) this.drawMark(this.marked)
    }
    const mastKey = JSON.stringify([port.contracts, port.homes, port.first, port.cranes])
    if (mastKey !== this.mastKey) {
      this.mastKey = mastKey
      this.masts.clear()
      for (let berth = 0; berth <= port.levels.berth; berth++) {
        const kept = port.contracts.filter((id) => port.home(id) === berth)
        if (!kept.length && port.first !== berth) continue
        const mast = signalMast(kept.map((id) => port.contract(id).hull), port.first === berth)
        mast.position.set(BERTH_X[berth] + MAST.x, QUAY_TOP, MAST.z)
        mast.userData.berth = berth
        this.masts.add(mast)
      }
    }
    pulse(performance.now() / 1000)
  }

  private drawMark(target: Target): void {
    const rim = (object: THREE.Object3D) => this.markRims.push(...outline(object))
    const pad = (x: number, z: number, width: number, depth: number) =>
      this.pads.add(blueprint(rbox(width, 0.014, depth, C.white, x, GROUND_Y + 0.009, z, 0.006), false))
    switch (target.kind) {
      case 'berth':
        for (const crane of this.cranes) if (crane.berth === target.berth) rim(crane.group)
        if (this.fixtures.has(target.berth)) rim(this.fixtures.get(target.berth)!.fixture.group)
        break
      case 'site':
        pad(BERTH_X[target.berth], APRON_Z, BERTH_REACH * 2 - 0.3, 0.4)
        break
      case 'channel':
        for (const ship of this.ships) if (ship.model) rim(ship.model)
        break
      case 'block':
        if (this.gantries.has(target.block)) rim(this.gantries.get(target.block)!.group)
        break
      case 'plot':
        pad(this.yard.blockX(target.block), YARD_SIZE.centerZ, YARD_SIZE.x, YARD_SIZE.z)
        break
      case 'tractors':
        for (const carrier of this.carriers) rim(carrier.group)
        break
      case 'gate':
        for (const lane of this.booths) rim(lane)
        break
      case 'office':
        for (const waiting of this.dockers) rim(waiting)
        break
    }
  }

  private drawPreview(offer: Offer): void {
    const { yard } = this
    const id = offer.id
    const at = this.port.where(offer)
    // Machines show through whatever is in front of them; ground and hulls are big enough not to need it.
    const ghost = (object: THREE.Object3D, overlay = true) => this.ghosts.add(blueprint(object, overlay))
    const mark = (object: THREE.Object3D) => this.rims.push(...outline(object))
    const hullAt = (size: ClassId, x: number, z: number) => {
      const body = shipBody(CLASSES[size])
      body.position.set(x, 0, z)
      ghost(body, false)
    }
    switch (id) {
      case 'berth': {
        const size = SIZES[Math.min(SIZES.length - 1, this.port.levels.dredge)]
        hullAt(size, BERTH_X[at], berthZ(CLASSES[size]))
        ghost(new Crane(BERTH_X[at], at, C.white, this.pool).group)
        break
      }
      case 'dredge': {
        const size = SIZES[Math.min(SIZES.length - 1, this.port.levels.dredge + 1)]
        hullAt(size, BERTH_X[0], berthZ(CLASSES[size]))
        break
      }
      case 'crane':
        ghost(new Crane(this.craneSpot(at), at, C.white, this.pool).group)
        break
      case 'carrier': {
        const carrier = new Carrier()
        carrier.place(this.parking(BERTH_X[0], null), APRON_Z)
        ghost(carrier.group)
        break
      }
      case 'yardBlock': {
        if (at < 0) break
        const x = yard.blockX(at)
        ghost(new Gantry(x).group)
        ghost(rbox(YARD_SIZE.x, 0.016, YARD_SIZE.z, C.white, x, GROUND_Y + 0.01, YARD_SIZE.centerZ, 0.006), false)
        break
      }
      case 'stackHeight':
        for (const block of yard.blocks) {
          ghost(rbox(
            YARD_SIZE.x, BOX.h, YARD_SIZE.z, C.white,
            yard.blockX(block), GROUND_Y + BOX.h * (yard.tiers + 0.5), YARD_SIZE.centerZ, 0.012,
          ), false)
        }
        break
      case 'gate':
        ghost(boothAt(this.booths.length))
        break
      case 'tug':
        for (const ship of this.ships) if (ship.model) mark(ship.model)
        break
      case 'craneSpeed':
        for (const crane of this.cranes) mark(crane.group)
        break
      case 'carrierSpeed':
        for (const carrier of this.carriers) mark(carrier.group)
        break
      case 'yardCrane':
        for (const gantry of this.gantries.values()) mark(gantry.group)
        break
    }
  }

  private paid(task: CraneTask, crane: Crane): void {
    const amount = task.ship.call!.fee
    const own = this.game.fleet.find((vessel) => vessel.id === task.ship.call!.own)
    if (own) own.earned += amount
    this.game.earn(amount, this.port)
    this.port.stats.boxes++
    this.moved++
    if (task.kind === 'unload') this.flow.landed++
    else this.flow.shipped++
    this.onPay(crane.hook, amount)
  }

  // Records what is in the yard, so a saved port reopens about as full as it was left.
  snapshot(): void {
    this.port.yardImports = this.yard.count('import')
    this.port.yardExports = this.yard.count('export')
    // Work done on a ship of the player's own is kept, so that closing the game does not lose it.
    for (const [berth, keel] of Object.entries(this.port.keels)) {
      const ship = this.ships[Number(berth)]
      if (ship.stage === 'work' && ship.call?.work?.own) keel.done = ship.progress
    }
  }

  update(dt: number): void {
    this.season()
    this.port.train(dt)
    this.payClock += dt
    if (this.payClock >= PAYDAY) {
      this.payClock -= PAYDAY
      const amount = this.game.payWages(this.port)
      this.onPayday(new THREE.Vector3(CREW_ROOM.x + 0.13, GROUND_Y + 0.12, CREW_ROOM.z), amount)
      // A retainer is paid for keeping a yard ready, as long as the port can be relied on.
      for (const berth of this.port.works) {
        const retainer = WORKS[this.port.yards[berth] as Works].retainer
        if (!retainer || this.port.reliability < RETAINER_FLOOR) continue
        this.game.earn(retainer, this.port)
        this.onPay(new THREE.Vector3(BERTH_X[berth], QUAY_TOP + 0.3, -0.1), retainer)
      }
    }
    this.configure()
    this.arrivals()
    this.traffic(dt)
    if (!this.held) this.dispatch(dt)

    this.cranes.forEach((crane, i) => {
      const stage = this.ships[crane.berth].stage
      crane.boomUp = stage === 'away' || stage === 'arrive' || stage === 'depart'
      crane.update(dt, this.cranes, i, this.held)
    })
    this.puffClock += dt
    if (this.puffClock > 0.22) {
      this.puffClock = 0
      for (const ship of this.ships) {
        const from = ship.exhaust
        if (from) this.smoke.emit(from)
      }
    }
    this.smoke.update(dt)
    if (!this.held) {
      for (const carrier of this.carriers) this.runCarrier(carrier, dt)
      for (const gantry of this.gantries.values()) gantry.update(dt)
    }
    this.gate(dt)
    for (const truck of this.trucks) truck.update(dt)
    // A barrier lifts for a truck coming up to it and drops behind it.
    for (const { arm, x, z } of this.barriers) {
      const near = this.trucks.some((t) => t.active && Math.abs(t.x - x) < 0.5 && Math.abs(t.z - z) < 0.1)
      arm.rotation.x += ((near ? -1.25 : 0) - arm.rotation.x) * Math.min(1, dt * 7)
    }
    this.labour(dt)
    this.yard.sync()
    this.animate(dt)
    this.showPreview()
    this.experience(dt)

    // How busy the port is, for judging whether another line would fit, is a matter of its container berths.
    const quays = this.port.quays
    const occupied = quays.filter((berth) => this.ships[berth].stage !== 'away').length
    this.busy += (occupied / quays.length - this.busy) * (1 - Math.exp(-dt / BUSY_FADE))
    this.port.busy = this.ships.map((ship, berth) => ship.stage !== 'away'
      || this.queue.some((call) => (call.work ? call.work.yard === this.port.yards[berth] : this.port.home(call.contract) === berth)))
    const slow = Math.exp(-dt / PACE_FADE)
    this.berthTime = this.berthTime * slow + occupied * dt
    this.moved *= slow

    const fade = Math.exp(-dt / FADE)
    for (const key of Object.keys(this.lost) as (keyof typeof this.lost)[]) this.lost[key] *= fade
    this.lost.queue += this.queue.length * dt
    for (const gantry of this.gantries.values()) this.lost.yardCranes += Math.max(0, gantry.pending - 1) * dt
  }

  // Time at work counts towards a promotion: a crane with a lift on, a tractor on a run, a yard crane with
  // lifts waiting, a gate with trucks in the port.
  private experience(dt: number): void {
    if (this.held) return
    const port = this.port
    for (const [machine, worker] of this.hands) {
      const busy = machine instanceof Crane ? machine.task !== null
        : machine instanceof Carrier ? !machine.idle : (machine as Gantry).pending > 0
      if (busy) port.credit(worker, dt)
    }
    if (this.trucks.some((truck) => truck.active)) for (const clerk of port.crew('gate')) port.credit(clerk, dt)
  }

  // A call at a yard for work: the vessel, what the work pays, and a deadline to turn her round by.
  private jobCall(works: Works, job: Job, gangs: number, built: boolean): Call {
    const def = WORKS[works]
    return {
      name: def.names[Math.floor(this.roll() * def.names.length)], ship: 'feeder', hull: job.hull, unload: 0, load: 0,
      fee: job.fee, bonus: job.bonus, window: Math.round((job.work / (def.booked ? 1 : gangs)) * def.slack + def.transit),
      arrivedAt: this.game.time, contract: null, cargo: 'goods', work: { yard: works, vessel: job.vessel, need: job.work, built },
    }
  }

  // Work for the yards that do something other than containers. A shipyard lays its next keel once the slip
  // is clear, a repair dock is sent a ship when it is free, and the navy and the ferry keep to their own times.
  private jobs(): void {
    const g = this.game
    const port = this.port
    for (const berth of [...this.nextJob.keys()]) if (port.worksAt(berth) === null) this.nextJob.delete(berth)
    for (const berth of port.works) {
      const works = port.yards[berth] as Works
      const def = WORKS[works]
      const ship = this.ships[berth]
      const due = this.nextJob.get(berth)
      if (due === undefined) {
        this.nextJob.set(berth, g.time + 15 + this.roll() * 20)
        continue
      }
      if (g.time < due) continue
      const gangs = Math.max(1, port.crew('fitter', berth).length)
      if (!def.every) {
        if (ship.stage !== 'away') continue
        // A ship ordered for the player's own fleet takes the slip before any customer's.
        const keel = port.keels[berth]
        if (keel) {
          const { design } = keel
          ship.lay({
            name: design.name, ship: design.size, hull: design.hull, unload: 0, load: 0, fee: 0, bonus: 0, window: Infinity,
            arrivedAt: g.time, contract: null, cargo: design.fit,
            work: { yard: 'shipyard', vessel: 'coaster', need: g.shipWork(design), built: true, own: true },
          })
          ship.progress = keel.done
        } else {
          ship.lay(this.jobCall(works, def.jobs[port.products[berth] ?? 0] ?? def.jobs[0], gangs, true))
        }
        this.nextJob.set(berth, Infinity)
        continue
      }
      if (!def.booked && (ship.stage !== 'away' || this.queue.some((call) => call.work?.yard === works))) continue
      this.nextJob.set(berth, g.time + def.every[0] + this.roll() * (def.every[1] - def.every[0]))
      if (this.queue.length >= MAX_QUEUE) {
        // A booked ship that finds no room offshore goes away again, and that is noticed.
        if (def.booked) {
          port.score(false)
          g.stamp(false)
          port.stats.diverted++
        }
        continue
      }
      this.queue.push(this.jobCall(works, def.jobs[Math.floor(this.roll() * def.jobs.length)], gangs, false))
    }
  }

  // The gangs at each yard work on whatever lies there, each at their own pace. A ship lift brings its ship
  // clear of the water first and sets her down afterwards; a hull on the slip is paid for at each quarter.
  private labour(dt: number): void {
    const port = this.port
    for (const berth of port.works) {
      const ship = this.ships[berth]
      const work = ship.stage === 'work' ? ship.call?.work : undefined
      const lifts = port.yards[berth] === 'repair'
      if (work) {
        const due = ship.progress >= work.need
        if (lifts) ship.raise = due ? 0 : LIFT.up
        if (!due && !this.held && (!lifts || ship.lift >= LIFT.up - 1e-3)) {
          const gang = port.crew('fitter', berth)
          ship.progress += gang.reduce((sum, worker) => sum + pace(worker, 'fitter'), 0) * dt
          for (const worker of gang) port.credit(worker, dt)
          const stage = Math.min(3, Math.floor(ship.done * 4))
          if (work.built && stage > ship.stagesPaid) {
            ship.stagesPaid = stage
            const sum = Math.round(ship.call!.fee * STAGE_PAY)
            if (sum) {
              this.game.earn(sum, port)
              this.onPay(ship.deck, sum)
            }
          }
        }
      }
      const moving = this.fixtures.get(berth)?.fixture.moving
      if (!moving) continue
      if (lifts) {
        const to = ship.stage === 'away' ? 0 : (ship.lift / LIFT.up - 1) * LIFT.down
        moving.position.y += Math.sign(to - moving.position.y) * Math.min(Math.abs(to - moving.position.y), dt * 0.05)
      } else {
        // The gantry stands over the section being built.
        const to = work ? (ship.done - 0.5) * ship.length : 0
        moving.position.x += Math.sign(to - moving.position.x) * Math.min(Math.abs(to - moving.position.x), dt * 0.2)
      }
    }
  }

  private arrivals(): void {
    const g = this.game
    const port = this.port
    this.jobs()
    for (let i = this.requests.length - 1; i >= 0; i--) if (g.time >= this.requests[i].until) this.requests.splice(i, 1)
    if (g.time >= this.nextAsk) {
      this.nextAsk = g.time + ASKING.gap[0] + this.roll() * (ASKING.gap[1] - ASKING.gap[0])
      if (this.requests.length < ASKING.most) this.ask()
    }
    // The player's own ships come in when their passage is done, and wait at sea if there is no room offshore.
    for (const vessel of g.fleet) {
      if (vessel.at !== port.def.id || vessel.calling || g.time < vessel.due || this.queue.length >= MAX_QUEUE) continue
      vessel.calling = true
      const hold = g.capacity(vessel)
      this.queue.push({
        name: vessel.name, ship: vessel.size, hull: vessel.hull, unload: vessel.aboard, load: hold, fee: g.freight(vessel, port), bonus: 0,
        window: WINDOW.base + WINDOW.perBox * (vessel.aboard + hold) * CARGO[vessel.fit].heft, arrivedAt: g.time, contract: null,
        cargo: vessel.fit, own: vessel.id,
      })
    }
    for (const id of [...this.nextCall.keys()]) {
      if (!port.contracts.includes(id)) this.nextCall.delete(id)
    }
    for (const id of port.contracts) {
      const contract = port.contract(id)
      const due = this.nextCall.get(id)
      if (due === undefined) {
        this.nextCall.set(id, g.time + 4 + random() * 10)
        continue
      }
      if (g.time < due) continue
      this.nextCall.set(id, g.time + port.every(contract) * (0.8 + random() * 0.4))
      if (this.queue.length >= MAX_QUEUE) {
        port.score(false)
        g.stamp(false)
        port.stats.diverted++
        continue
      }
      this.queue.push({
        name: contract.ships[Math.floor(random() * contract.ships.length)],
        ship: contract.ship, hull: contract.hull, unload: contract.unload, load: contract.load, fee: contract.fee,
        bonus: contract.bonus, window: contract.window, arrivedAt: g.time, contract: id, cargo: contract.cargo ?? 'goods',
      })
    }
  }

  // Where a tug stands for a ship that is moving: ahead of her in the channel, or pushing on her
  // seaward side once she has moved in far enough to leave room there.
  private station(ship: Ship, slot: number): Station | null {
    const ahead = ship.length / 2 + 0.45 + 0.5 * slot
    const side = ship.z + ship.beam / 2 + 0.09
    if (ship.stage === 'berth' && side < 0.98) return { x: ship.x + [0.3, -0.3, 0][slot % 3] * ship.length, z: side, side: true }
    const x = (ship.stage === 'depart' ? ship.x : ship.berthX) + ahead
    // A ship that is leaving is let go as she comes up to the tug quay.
    return x > TUG_QUAY.x - 0.3 ? null : { x, z: LANE_Z, side: false }
  }

  // One ship moves in the channel at a time; departures go first to free a berth.
  private traffic(dt: number): void {
    const port = this.port
    const moving = this.ships.find((ship) => ship.channelBusy) ?? null
    const passing = this.ships.some((ship) => ship.stage === 'depart' && Math.abs(ship.x - TUG_QUAY.x - 0.5) < ship.length / 2 + 1.2)
    this.tugs.forEach((tug, slot) => tug.update(dt, moving ? this.station(moving, slot) : null, passing, this.water))
    for (const ship of this.ships) {
      const tugs = ship === moving ? this.tugs.filter((tug) => tug.attending).length : 0
      if (ship.update(dt, 1 + 0.25 * tugs) === 'gone') port.stats.ships++
    }
    // The dredger has the channel to itself. It sets off once the last ship under way has cleared it.
    if (this.dredger) {
      if ((this.dredger.started || !this.ships.some((ship) => ship.channelBusy)) && this.dredger.update(dt, this.water)) {
        this.dredger.boat.removeFromParent()
        this.dredger = null
        this.dredged = port.levels.dredge
      }
      return
    }
    // Nothing sets out in a typhoon, and a ship that needs the tide waits for it where she is.
    const next = this.typhoon ? null : this.allot()
    if (this.queue.some((call) => this.ebbed(call)) || this.ships.some((ship) => this.finished(ship) && this.ebbed(ship.call!))) {
      this.lost.tide += dt
    }
    const homed = this.queue.some((call) => !call.work && port.home(call.contract) !== null)
    if (!next && homed && this.free().some((berth) => port.yards[berth] === 'boxes')) this.lost.home += dt
    if (this.ships.some((s) => s.channelBusy)) {
      // Someone is ready to move and cannot.
      if (this.ships.some((ship) => this.finished(ship)) || next) this.lost.channel += dt
      return
    }
    const leaving = this.typhoon ? undefined : this.ships.find((ship) => this.finished(ship) && !this.ebbed(ship.call!))
    if (leaving) {
      // A tug on its way back along the channel has to be past her before she moves out into it.
      if (this.tugs.every((tug) => tug.atHome || tug.x > leaving.x + leaving.length / 2 + 0.2)) this.release(leaving)
      return
    }
    if (next) this.ships[next.berth].dispatch(this.queue.splice(next.call, 1)[0])
  }

  // Open berths with no ship: container berths that have a crane, and yards for other work.
  private free(): number[] {
    return this.ships.map((_, berth) => berth).filter((berth) =>
      berth <= this.port.levels.berth && this.ships[berth].stage === 'away'
      && (this.port.yards[berth] !== 'boxes' || this.cranes.some((c) => c.berth === berth)))
  }

  // The next ship to bring in, and the berth for her. A line with a berth of its own waits for that berth.
  // Any other ship takes a berth that is kept for nobody, or failing that one whose line has no ship waiting.
  private allot(): { call: number; berth: number } | null {
    const port = this.port
    const open = this.free()
    if (!open.length) return null
    const free = open.filter((berth) => port.yards[berth] === 'boxes')
    const homes = this.queue.map((call) => port.home(call.contract))
    const kept = new Set(port.contracts.map((id) => port.home(id)))
    for (let call = 0; call < this.queue.length; call++) {
      if (this.ebbed(this.queue[call])) continue
      // A ship that comes for work goes to a yard that does it, and nowhere else.
      const work = this.queue[call].work
      if (work) {
        const berth = open.find((b) => port.yards[b] === work.yard)
        if (berth !== undefined) return { call, berth }
        continue
      }
      const home = homes[call]
      if (home !== null) {
        if (free.includes(home)) return { call, berth: home }
        continue
      }
      const berth = free.find((b) => !kept.has(b)) ?? free.find((b) => !homes.includes(b))
      if (berth !== undefined) return { call, berth }
    }
    return null
  }

  // The berth to set an export down beside. Each line's share of the exports goes to its own berth, and
  // the rest is spread over the berths that are kept for nobody.
  private staging(): number {
    const port = this.port
    const open = 1 + port.levels.berth
    const pick = random()
    const kept = new Set(port.contracts.map((id) => port.home(id)))
    kept.delete(null)
    if (!kept.size) return Math.floor(pick * open)
    const shared = Array.from({ length: open }, (_, berth) => berth).filter((berth) => !kept.has(berth))
    const wanted = new Array<number>(open).fill(0)
    for (const id of port.contracts) {
      const contract = port.contract(id)
      const home = port.home(id)
      const among = home !== null ? [home] : shared.length ? shared : wanted.map((_, berth) => berth)
      for (const berth of among) wanted[berth] += contract.load / port.every(contract) / among.length
    }
    let left = pick * wanted.reduce((sum, w) => sum + w, 0)
    return Math.max(0, wanted.findIndex((w) => (left -= w) < 0))
  }

  // Unloaded, loaded (or out of exports to wait for) and with no crane still over her.
  private finished(ship: Ship): boolean {
    // A ship in for work is done when the work is, and once a lift has set her back in the water.
    const work = ship.call?.work
    if (work) return ship.stage === 'work' && ship.progress >= work.need && (work.built === true || ship.lift < 1e-3)
    if (ship.stage !== 'work' || ship.importsLeft > 0 || ship.pendingLoads > 0) return false
    if (this.cranes.some((c) => c.task?.ship === ship)) return false
    return ship.loaded >= ship.loadTarget || ship.starved > STARVE_LIMIT
  }

  // A ship is judged, and its bonus paid, as it lets go of the quay.
  private release(ship: Ship): void {
    const g = this.game
    const call = ship.call!
    const used = (g.time - call.arrivedAt) / call.window
    const onTime = used <= 1
    const reward = this.port.reward(call.bonus, used)
    // A ship that came for work pays for it as she leaves: the whole price, or what the stage payments left.
    const fee = call.work ? Math.round(call.fee * (1 - ship.stagesPaid * STAGE_PAY)) : 0
    if (fee) g.earn(fee, this.port)
    if (onTime) {
      g.earn(reward.sum, this.port)
      this.port.stats.best = Math.max(this.port.stats.best, reward.sum)
    }
    // Where the lines run to the minute, a late ship costs the port a share of the bonus she did not earn.
    const fine = !onTime && !call.work ? Math.round((call.bonus * (this.port.def.rules?.fine ?? 0)) / 10) * 10 : 0
    if (fine) g.earn(-fine, this.port)
    if (call.contract) this.port.last[call.contract] = { used, paid: onTime ? reward.sum : -fine }
    // A ship built for the player joins the fleet as she leaves the slip; one of the fleet goes back to sea.
    const keel = call.work?.own ? this.port.keels[this.ships.indexOf(ship)] : undefined
    if (keel) {
      g.commission(this.port, keel.design)
      delete this.port.keels[this.ships.indexOf(ship)]
    }
    const own = g.fleet.find((vessel) => vessel.id === call.own)
    if (own) {
      const cost = g.voyageCost(own)
      g.earn(-cost, this.port)
      own.earned -= cost
      own.voyages++
      // Overseas she fills up again for the way back; between two of the player's ports she lands what she took on.
      own.aboard = own.away === null ? g.capacity(own) : ship.loaded
      own.at = own.away !== null && this.port.def.id === own.home ? own.away : own.home
      own.due = g.time + g.seaTime(own)
      own.calling = false
      this.onVoyage(ship.deck, cost)
    }
    if (call.work) {
      this.port.stats.jobs++
      // The slip is cleared before the next keel is laid; a dock is sent its next ship after a while.
      const berth = this.ships.indexOf(ship)
      if (!WORKS[call.work.yard].booked) this.nextJob.set(berth, g.time + (call.work.built ? 25 : 40 + this.roll() * 60))
    }
    this.port.score(onTime)
    if (fee && !onTime) this.onPay(ship.deck, fee)
    this.onDeparture(ship.deck, (onTime ? reward.sum : -fine) + fee, onTime, g.stamp(onTime), reward.note)
    ship.castOff()
  }

  // The idle tractor with the shortest drive to a quay crane at x.
  private idleCarrier(x: number): Carrier | null {
    let best: Carrier | null = null
    let least = Infinity
    for (const carrier of this.carriers) {
      if (!carrier.idle || !carrier.manned) continue
      const far = carrier.distanceTo({ x, place: 'quay' })
      if (far < least) {
        least = far
        best = carrier
      }
    }
    return best
  }

  private dispatch(dt: number): void {
    // Tractors are handed out crane by crane, so the cranes of the berth that comes first are served first.
    const first = this.port.first
    const order = this.cranes.map((_, i) => i).sort((a, b) =>
      Number(this.cranes[b].berth === first) - Number(this.cranes[a].berth === first) || a - b)
    for (const i of order) this.work(this.cranes[i], i, dt)
  }

  private work(crane: Crane, i: number, dt: number): void {
    {
      const ship = this.ships[crane.berth]
      if (ship.stage !== 'work' || (!crane.manned && !crane.task)) return
      const heft = CARGO[ship.call!.cargo].heft
      const reachable = (x: number) => crane.canStart(x, this.cranes, i)

      if (crane.task) {
        this.lost.working += dt
        const task = crane.task
        if (task.kind === 'unload' && !task.carrier) {
          const carrier = this.summon(task.x)
          const slot = carrier ? this.yard.reserveSlot('import', this.haul(task.x), this.bayOpen(carrier)) : null
          if (carrier && slot) {
            const stackX = this.yard.colX(slot.col)
            task.carrier = carrier
            this.assign(carrier, task.x, stackX)
            carrier.fetchImport(task.x, slot, stackX)
          } else if (crane.waitingForCarrier) {
            if (carrier) this.lost.yard += dt
            else this.lost.tractors += dt
          }
        } else if (crane.waitingForCarrier) {
          this.lost.tractors += dt
        }
        return
      }

      const unload = ship.nextUnload(crane.zone[0], crane.zone[1], reachable) ?? ship.nextUnload(0, 1, reachable)
      if (unload !== null) {
        crane.start({ kind: 'unload', ship, col: unload, x: ship.colX(unload), carrier: null, heft })
        return
      }
      if (ship.loaded + ship.pendingLoads >= ship.loadTarget) return
      const load = ship.nextLoad(crane.zone[0], crane.zone[1], reachable) ?? ship.nextLoad(0, 1, reachable)
      if (load === null) return
      const x = ship.colX(load)
      const carrier = this.summon(x)
      const pick = carrier ? this.yard.reserveBox('export', this.haul(x), Infinity, this.bayOpen(carrier)) : null
      if (!carrier) {
        this.lost.tractors += dt
        return
      }
      if (!pick) {
        this.lost.exports += dt
        if (ship.pendingLoads === 0) ship.starved += dt
        return
      }
      ship.starved = 0
      ship.pendingLoads++
      const stackX = this.yard.colX(pick.ref.col)
      this.assign(carrier, x, stackX)
      carrier.fetchExport(x, pick.ref, pick.box, stackX)
      crane.start({ kind: 'load', ship, col: load, x, carrier, heft })
    }
  }

  private craneOver = (x: number): boolean => this.cranes.some((crane) => Math.abs(crane.x - x) < CRANE_REACH)

  // How far a tractor working a quay crane at x has to drive to each column of the yard and back.
  private haul(x: number): (col: number) => number {
    return (col) => tour(x, this.yard.colX(col), this.craneOver)
  }

  private near(x: number): (col: number) => number {
    return (col) => Math.abs(this.yard.colX(col) - x)
  }

  // Whether a vehicle could pull in beside a column of the yard and be served there: the bay has to be
  // free and the block's crane has to have someone on it.
  private bayOpen(by: Vehicle | null): (col: number) => boolean {
    return (col) => !this.unworked.has(this.yard.blockOf(col)) && !this.taken({ x: this.yard.colX(col), place: 'bay' }, by)
  }

  private lift(col: number, lift: Lift): void {
    this.gantries.get(this.yard.blockOf(col))!.request(lift)
  }

  private stow(vehicle: Carrier | Truck, slot: StackRef, kind: 'import' | 'export', done: () => void): Lift {
    const yard = this.yard
    return {
      from: () => vehicle.deckWorld(),
      to: () => yard.slotPos(slot, yard.height(slot)),
      dig: () => 0,
      pick: () => vehicle.unmount(),
      drop: (mesh) => {
        // How long an import waits for its truck depends on what is in it.
        const [soonest, latest] = CARGO[(mesh.userData.cargo as CargoId | undefined) ?? 'goods'].dwell
        const slow = this.port.def.rules?.dwell ?? 1
        const ready = kind === 'import' ? this.game.time + (soonest + random() * (latest - soonest)) * slow : 0
        yard.deposit(slot, mesh.userData.color as number, kind, ready)
        this.pool.release(mesh)
        done()
      },
    }
  }

  private fetch(vehicle: Carrier | Truck, ref: StackRef, box: YardBox, done: () => void): Lift {
    const yard = this.yard
    return {
      from: () => yard.posOf(ref, box),
      to: () => vehicle.deckWorld(),
      dig: () => DIG_TIME * yard.above(ref, box),
      pick: () => {
        yard.extract(ref, box)
        return this.pool.get(box.color)
      },
      drop: (mesh) => {
        vehicle.mount(mesh)
        done()
      },
    }
  }

  private runCarrier(carrier: Carrier, dt: number): void {
    // Done, and nothing new for it yet: off to the idle strip.
    if (carrier.idle && !this.resting.has(carrier)) this.park(carrier)
    if (!carrier.advance(dt)) return
    const job = carrier.job!
    if (job.kind === 'import') {
      const lift = this.stow(carrier, job.slot, 'import', () => {})
      const pick = lift.pick
      lift.pick = () => {
        const mesh = pick()
        carrier.finish()
        return mesh
      }
      this.lift(job.slot.col, lift)
    } else {
      this.lift(job.ref.col, this.fetch(carrier, job.ref, job.box, () => carrier.toApron()))
    }
  }

  private gate(dt: number): void {
    const g = this.game
    const port = this.port
    // A lane works only with a clerk in its booth, and at the clerk's pace.
    const clerks = port.crew('gate')
    const lanes = clerks.length
    // Customs can slow the gate, and so can the road: in the rush only some of the trucks get through.
    const slow = (g.time < port.gateSlowUntil ? 2 : 1) / (this.rush ? port.def.rules!.rush!.crawl : 1)
    this.gateClock += dt
    if (!lanes || this.gateClock < (GATE_INTERVAL * slow) / clerks.reduce((sum, clerk) => sum + pace(clerk, 'gate'), 0)) return
    if (this.trucks.filter((t) => t.active).length >= lanes * TRUCKS_PER_LANE) return

    let wanted = 0
    for (const id of port.contracts) wanted += port.contract(id).load * 1.5
    for (const call of this.queue) wanted += call.load
    // The player's own ships that trade here need their exports waiting too.
    for (const vessel of g.fleet) if (vessel.home === port.def.id || vessel.away === port.def.id) wanted += g.capacity(vessel) * 1.2
    wanted = Math.min(wanted, this.yard.capacity * 0.4)
    const needExport = this.yard.count('export') + this.exportsInbound < wanted
    // The road in from town has to be clear where a truck would appear.
    if (this.trucks.some((t) => t.active && t.x > TRUCK_SPAWN_X - 0.6 && Math.abs(t.z - TOWN_IN_Z) < 0.05)) return
    const berthX = BERTH_X[this.staging()]
    const open = this.bayOpen(null)
    const drop = needExport ? this.yard.reserveSlot('export', this.near(berthX), open) : null
    const pick = this.yard.reserveBox('import', this.near(drop ? this.yard.colX(drop.col) : GATE_STOP_X), g.time, open)
    if (!drop && !pick) return
    this.gateClock = 0
    this.sendTruck(drop, pick, this.truckSerial++ % lanes)
  }

  private sendTruck(drop: StackRef | null, pick: { ref: StackRef; box: YardBox } | null, lane: number): void {
    let truck = this.trucks.find((t) => !t.active)
    if (!truck) {
      truck = new Truck()
      this.join(truck)
      this.trucks.push(truck)
      this.roadside.add(truck.group)
    }
    const t = truck
    const yard = this.yard
    const bay = (col: number): Spot => ({ x: yard.colX(col), place: 'bay' })
    this.claims.set(t, [...(drop ? [bay(drop.col)] : []), ...(pick ? [bay(pick.ref.col)] : [])])
    // Ask the block's yard crane for a lift, then wait until it is done.
    const lifted = (col: number, make: (done: () => void) => Lift) => {
      let state = 0
      return () => {
        if (state === 0) {
          state = 1
          this.lift(col, make(() => (state = 2)))
        }
        return state === 2
      }
    }
    t.speed = 1.2
    t.place(TRUCK_SPAWN_X, TOWN_IN_Z, Math.PI)
    const stopX = GATE_STOP_X + BOOTH_STOP - lane * BOOTH_PITCH
    const steps = [
      // It waits back from the junction until it can turn in through the gate in one go,
      // so that it never stands in the way of trucks coming out.
      t.trip(() => t.follow([
        { x: GATE_X + 0.7, z: TOWN_IN_Z }, { x: GATE_X, z: TOWN_IN_Z, chain: true }, { x: GATE_X, z: BAY_Z }, { x: stopX, z: BAY_Z },
      ])),
      t.wait(() => 1.2),
    ]
    if (drop) {
      t.mount(this.pool.get(Math.floor(random() * LIVERIES.length)))
      this.exportsInbound++
      steps.push(
        t.trip(() => t.go(bay(drop.col))),
        lifted(drop.col, (done) => this.stow(t, drop, 'export', () => {
          this.exportsInbound--
          this.flow.gateIn++
          done()
        })),
      )
    }
    if (pick) {
      steps.push(
        t.trip(() => t.go(bay(pick.ref.col))),
        lifted(pick.ref.col, (done) => this.fetch(t, pick.ref, pick.box, done)),
      )
    }
    steps.push(
      t.trip(() => {
        this.claims.delete(t)
        t.leave()
      }),
      () => {
        if (t.cargo) {
          this.pool.release(t.unmount())
          this.flow.gateOut++
        }
        this.port.stats.trucks++
        return true
      },
    )
    t.run(steps)
  }
}
