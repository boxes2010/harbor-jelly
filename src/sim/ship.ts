import * as THREE from 'three/webgpu'
import { BLOCK, BOX, BOX_GEO, LIVERIES, QUAY_TOP, cyl, smooth, stretch } from '../kit'
import { bayXs, rigFor, shipBody } from '../models/ships'
import { LIFT, VESSELS, vesselBody, type Size } from '../models/vessels'
import { C, FINISH } from '../style'
import type { Water } from '../water'
import { CARGO, type CargoId, type VesselId, type Works } from './game'
import {
  BERTH_X, BOLLARDS, CLASSES, DECK, LANE_Z, OFF_EAST, OFF_WEST, ROW_PITCH, bollardNear, type ClassId, type ShipClass,
} from './layout'
import { random } from './random'

export interface Call {
  name: string
  ship: ClassId
  hull: string
  unload: number
  load: number
  fee: number
  bonus: number
  window: number
  arrivedAt: number
  contract: string | null
  cargo: CargoId
  // Set for a ship that comes to a yard for work rather than with boxes.
  work?: Work
  // Set for one of the player's own ships: her number in the fleet.
  own?: number
}

export interface Work {
  yard: Works
  vessel: VesselId
  // Seconds of one gang's work.
  need: number
  // Built here: she starts on the slip instead of coming in from the sea, and is paid for in stages.
  built?: boolean
  // A container ship for the player's own fleet, rather than a customer's vessel.
  own?: boolean
}

export type Stage = 'away' | 'arrive' | 'berth' | 'work' | 'cast' | 'depart'

interface Column { through: number; imports: number; exports: number }

const SIDE_TIME = 4
const CRUISE = 0.9
// The approach is a long way on a big port, so a ship makes most of it at sea speed:
// a few seconds to slow down, plus the distance at this pace.
const APPROACH = { settle: 5, speed: 2.4 }

export function berthZ(spec: { beam: number }): number {
  return 0.05 + spec.beam / 2
}

// One size class as a berth shows it: the bodies of its designs, a nameplate and the boxes on deck.
class Form {
  readonly group = new THREE.Group()
  readonly boxes: THREE.InstancedMesh
  // The line's own colours, shared by every design of this class at this berth.
  readonly paint = {
    line: new THREE.MeshStandardMaterial({ roughness: FINISH.hull }),
    trim: new THREE.MeshStandardMaterial({ roughness: FINISH.matte }),
  }
  bays: number[] = []
  radar: THREE.Object3D | null = null
  stack = new THREE.Vector3()
  private bodies = new Map<string, THREE.Group>()
  private nameplate = document.createElement('canvas')
  private nameTexture: THREE.CanvasTexture

  // A size class of container ship, or with `vessel` one of the craft that come for other work.
  constructor(readonly spec: Size, private vessel: VesselId | null = null) {
    const g = this.group
    this.nameplate.width = 1024
    this.nameplate.height = 96
    this.nameTexture = new THREE.CanvasTexture(this.nameplate)
    this.nameTexture.colorSpace = THREE.SRGBColorSpace
    this.nameTexture.anisotropy = 8
    const width = Math.min(1.28, spec.length * 0.5)
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(width, width * 0.094),
      new THREE.MeshStandardMaterial({ map: this.nameTexture, alphaTest: 0.5, roughness: FINISH.hull }),
    )
    // A small craft carries her name lower, on a side that stands straight up.
    if (vessel && vessel !== 'coaster') plate.position.set(0, 0.052, spec.beam / 2 + 0.013)
    else plate.position.set(-0.1, 0.1, spec.beam / 2 + 0.0255)
    g.add(plate)

    this.boxes = new THREE.InstancedMesh(
      BOX_GEO, new THREE.MeshStandardMaterial({ roughness: FINISH.paint }), Math.max(1, spec.bays * spec.rows * spec.tiers),
    )
    this.boxes.setColorAt(0, new THREE.Color())
    this.boxes.count = 0
    this.boxes.castShadow = true
    this.boxes.receiveShadow = true
    this.boxes.frustumCulled = false
    g.add(this.boxes)
    g.visible = false
  }

  local(col: number, tier: number): THREE.Vector3 {
    const { rows } = this.spec
    return new THREE.Vector3(
      this.bays[Math.floor(col / rows)],
      DECK + BOX.h * (tier + 0.5),
      ((col % rows) - (rows - 1) / 2) * ROW_PITCH,
    )
  }

  // Fit out for a call: the design that goes with the ship's name, in the line's colours.
  dress(name: string, color: string): void {
    // A coaster is a feeder's hull, so she has a design of her own like any container ship.
    const spec = this.vessel === null || this.vessel === 'coaster' ? (this.vessel ? CLASSES.feeder : (this.spec as ShipClass)) : null
    const rig = rigFor(spec ?? CLASSES.feeder, name)
    const key = spec ? rig.key : this.vessel!
    this.bays = this.vessel ? [] : bayXs(spec!, rig.plan)
    for (const body of this.bodies.values()) body.visible = false
    let body = this.bodies.get(key)
    if (!body) {
      body = this.vessel ? vesselBody(this.vessel, name, this.paint) : shipBody(spec!, rig, this.paint)
      this.bodies.set(key, body)
      this.group.add(body)
    }
    body.visible = true
    this.radar = body.getObjectByName('radar') ?? null
    this.stack.fromArray(body.userData.stack as number[])
    this.paint.line.color.set(color)
    this.paint.trim.color.set(rig.accent)

    const ctx = this.nameplate.getContext('2d')!
    ctx.clearRect(0, 0, 1024, 96)
    ctx.fillStyle = C.white
    ctx.font = '800 84px "Helvetica Neue", Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.letterSpacing = '10px'
    ctx.fillText(name, 512, 52)
    this.nameTexture.needsUpdate = true
  }
}

export class Ship {
  readonly group = new THREE.ClippingGroup()
  stage: Stage = 'away'
  call: Call | null = null
  unloaded = 0
  loaded = 0
  loadTarget = 0
  pendingLoads = 0
  starved = 0
  // Seconds of gang work done on a ship that came for work, and the stage payments made for one built here.
  progress = 0
  stagesPaid = 0
  // How far she should stand clear of the water: on a slip or a ship lift.
  raise = 0
  private lifted = 0
  private crafts = new Map<VesselId, Form>()
  // Cuts off the part of a hull not yet built. Kept far away for every other ship.
  private unbuilt = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1e6)
  private forms: Record<ClassId, Form>
  private form: Form
  private cols: Column[] = []
  // The livery of the box in every slot, whether or not a box is there now.
  private tints: number[][] = []
  // Head and stern lines, made fast to the quay while the ship is worked.
  private lines = [0, 1].map(() => {
    const line = cyl(0.004, 0.004, 1, C.rope, 0, 0, 0, 6)
    line.castShadow = false
    line.visible = false
    return line
  })
  private clock = 0
  private pose = { x: OFF_WEST, z: LANE_Z }
  private last = new THREE.Vector3()
  private pace = 0
  private tilt = { heave: 0, pitch: 0, roll: 0 }

  constructor(readonly berthX: number, private water: Water) {
    this.group.clippingPlanes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -BLOCK.x0),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), BLOCK.x1),
      this.unbuilt,
    ]
    this.forms = {
      feeder: new Form(CLASSES.feeder), panamax: new Form(CLASSES.panamax), neo: new Form(CLASSES.neo),
    }
    this.form = this.forms.feeder
    for (const form of Object.values(this.forms)) this.group.add(form.group)
    this.group.add(...this.lines)
  }

  private get spec(): Size {
    return this.form.spec
  }

  // How far out of the water she stands at this moment.
  get lift(): number {
    return this.lifted
  }

  // The share of the work on her that is done, from 0 to 1.
  get done(): number {
    return this.call?.work ? Math.min(1, this.progress / this.call.work.need) : 0
  }

  private get berthZ(): number {
    return berthZ(this.spec)
  }

  // The visible model, or null while the berth is empty.
  get model(): THREE.Object3D | null {
    return this.stage === 'away' ? null : this.form.group
  }

  // Where smoke leaves the funnel while the ship is manoeuvring. At sea speed it is left behind unseen.
  get exhaust(): THREE.Vector3 | null {
    const manoeuvring = this.stage !== 'away' && this.stage !== 'work' && this.pace < 0.9
    if (!manoeuvring || this.pose.x < BLOCK.x0 + 0.3 || this.pose.x > BLOCK.x1 - 0.3) return null
    return this.form.group.localToWorld(this.form.stack.clone())
  }

  get deck(): THREE.Vector3 {
    return new THREE.Vector3(this.pose.x, DECK + 0.25, this.pose.z)
  }

  private height(col: number): number {
    const c = this.cols[col]
    return c.through + c.imports + c.exports
  }

  // Redraw the boxes on deck after the load has changed.
  private draw(): void {
    const { boxes } = this.form
    const m = new THREE.Matrix4()
    const color = new THREE.Color()
    let n = 0
    this.cols.forEach((_, col) => {
      for (let tier = 0; tier < this.height(col); tier++) {
        const p = this.form.local(col, tier)
        boxes.setMatrixAt(n, m.makeTranslation(p.x, p.y, p.z))
        boxes.setColorAt(n, color.set(LIVERIES[this.tints[col][tier]]))
        n++
      }
    })
    boxes.count = n
    boxes.boundingSphere = null
    boxes.instanceMatrix.needsUpdate = true
    if (boxes.instanceColor) boxes.instanceColor.needsUpdate = true
  }

  colX(col: number): number {
    return this.berthX + this.form.bays[Math.floor(col / this.spec.rows)]
  }

  get importsLeft(): number {
    return this.cols.reduce((n, c) => n + c.imports, 0)
  }

  // In the way of other ships: any manoeuvre, until a ship that is leaving has cleared the last berth.
  get channelBusy(): boolean {
    if (this.stage === 'depart') return this.pose.x < BERTH_X[0] + 3.2
    return this.stage !== 'away' && this.stage !== 'work'
  }

  get x(): number {
    return this.pose.x
  }

  get z(): number {
    return this.pose.z
  }

  get length(): number {
    return this.spec.length
  }

  get beam(): number {
    return this.spec.beam
  }

  dispatch(call: Call): void {
    this.call = call
    this.unloaded = 0
    this.loaded = 0
    this.pendingLoads = 0
    this.starved = 0
    this.progress = 0
    this.stagesPaid = 0
    this.raise = 0
    this.unbuilt.constant = 1e6
    for (const form of [...Object.values(this.forms), ...this.crafts.values()]) form.group.visible = false
    this.form = call.work && !call.work.own ? this.craft(call.work.vessel) : this.forms[call.ship]
    this.form.group.visible = true
    this.form.dress(call.name, call.hull)
    const { bays, rows, tiers } = this.spec
    this.cols = Array.from({ length: bays * rows }, () => ({ through: 0, imports: 0, exports: 0 }))
    let left = Math.min(call.unload, bays * rows * tiers)
    while (left > 0) {
      const c = this.cols[Math.floor(random() * this.cols.length)]
      if (c.imports < tiers) {
        c.imports++
        left--
      }
    }
    let room = 0
    for (const c of this.cols) {
      // The player's own ship carries nothing for anyone else.
      c.through = call.own !== undefined ? 0 : Math.floor(random() * (tiers - c.imports + 1))
      room += tiers - c.through
    }
    this.loadTarget = Math.min(call.load, room)
    // Her boxes come in the colours of what she carries.
    const { liveries } = CARGO[call.cargo]
    this.tints = this.cols.map(() => Array.from({ length: tiers }, () => liveries[Math.floor(random() * liveries.length)]))
    this.draw()

    this.pose = { x: OFF_WEST, z: LANE_Z }
    this.stage = 'arrive'
    this.clock = 0
    this.group.visible = true
    this.place(0)
  }

  private craft(vessel: VesselId): Form {
    let form = this.crafts.get(vessel)
    if (!form) {
      form = new Form(VESSELS[vessel], vessel)
      this.crafts.set(vessel, form)
      this.group.add(form.group)
    }
    return form
  }

  // Lays a keel: she starts on the slip at her berth, with nothing of her built yet.
  lay(call: Call): void {
    this.dispatch(call)
    this.pose = { x: this.berthX, z: this.berthZ }
    this.stage = 'work'
    this.raise = this.lifted = LIFT.up
    this.place(0)
  }

  castOff(): void {
    this.stage = 'cast'
    this.clock = 0
    this.raise = 0
  }

  // from, to: the crane's share of the ship's length, as fractions.
  private span(from: number, to: number): [number, number] {
    const { bays, rows } = this.spec
    return [Math.round(from * bays) * rows, Math.round(to * bays) * rows]
  }

  // Tallest stack of imports first, among bays the crane may reach right now.
  nextUnload(from: number, to: number, reachable: (x: number) => boolean): number | null {
    const [c0, c1] = this.span(from, to)
    let best: number | null = null
    for (let col = c0; col < c1; col++) {
      if (this.cols[col].imports === 0 || !reachable(this.colX(col))) continue
      if (best === null || this.height(col) > this.height(best)) best = col
    }
    return best
  }

  nextLoad(from: number, to: number, reachable: (x: number) => boolean): number | null {
    const [c0, c1] = this.span(from, to)
    let best: number | null = null
    for (let col = c0; col < c1; col++) {
      const c = this.cols[col]
      if (c.imports > 0 || this.height(col) >= this.spec.tiers || !reachable(this.colX(col))) continue
      if (best === null || this.height(col) < this.height(best)) best = col
    }
    return best
  }

  topPos(col: number): THREE.Vector3 {
    return this.form.group.localToWorld(this.form.local(col, this.height(col) - 1))
  }

  freePos(col: number): THREE.Vector3 {
    return this.form.group.localToWorld(this.form.local(col, this.height(col)))
  }

  takeImport(col: number): number {
    const color = this.tints[col][this.height(col) - 1]
    this.cols[col].imports--
    this.unloaded++
    this.draw()
    return color
  }

  placeExport(col: number, color: number): void {
    this.tints[col][this.height(col)] = color
    this.cols[col].exports++
    this.loaded++
    this.pendingLoads--
    this.draw()
  }

  // Returns 'berthed' or 'gone' on the frame a manoeuvre ends.
  update(dt: number, tug: number): 'berthed' | 'gone' | null {
    if (this.stage === 'away') return null
    this.clock += dt * tug
    if (this.form.radar) this.form.radar.rotation.y += dt * 2.5
    let result: 'berthed' | 'gone' | null = null
    switch (this.stage) {
      case 'arrive': {
        const run = this.berthX - OFF_WEST
        const t = Math.min(1, this.clock / (APPROACH.settle + run / APPROACH.speed))
        this.pose.x = OFF_WEST + run * (1 - (1 - t) * (1 - t))
        if (t >= 1) this.next('berth')
        break
      }
      case 'berth':
        this.pose.z = LANE_Z + (this.berthZ - LANE_Z) * smooth(this.clock / SIDE_TIME)
        if (this.clock >= SIDE_TIME) {
          this.next('work')
          result = 'berthed'
        }
        break
      case 'cast':
        this.pose.z = this.berthZ + (LANE_Z - this.berthZ) * smooth(this.clock / SIDE_TIME)
        if (this.clock >= SIDE_TIME) this.next('depart')
        break
      case 'depart': {
        const run = OFF_EAST - this.berthX
        const t = Math.min(1, this.clock / (run / CRUISE))
        this.pose.x = this.berthX + run * t * t
        if (t >= 1) {
          this.next('away')
          this.group.visible = false
          result = 'gone'
        }
        break
      }
    }
    this.place(dt)
    return result
  }

  private next(stage: Stage): void {
    this.stage = stage
    this.clock = 0
  }

  private place(dt: number): void {
    const { x, z } = this.pose
    const half = this.spec.length / 2 - 0.15
    const side = this.spec.beam * 0.45
    const h = (dx: number, dz: number) => this.water.height(x + dx, z + dz)
    const hb = h(half, 0)
    const hs = h(-half, 0)
    const hp = h(0, side)
    const hq = h(0, -side)
    const ease = dt ? Math.min(1, dt * 4) : 1
    this.tilt.heave += ((hb + hs + hp + hq) / 4 - this.tilt.heave) * ease
    this.tilt.pitch += (Math.atan2(hb - hs, half * 2) - this.tilt.pitch) * ease
    this.tilt.roll += (Math.atan2(hp - hq, side * 2) * 0.5 - this.tilt.roll) * ease
    // On a slip or a lift she rises clear of the water; a hull under construction shows only what is built,
    // from the stern forward.
    this.lifted += Math.sign(this.raise - this.lifted) * Math.min(Math.abs(this.raise - this.lifted), dt * 0.035)
    const building = this.call?.work?.built && this.stage === 'work'
    this.unbuilt.constant = building ? x - this.spec.length / 2 + this.done * this.spec.length : 1e6
    const afloat = 1 - this.lifted / LIFT.up
    this.group.position.set(x, this.tilt.heave * afloat + this.lifted, z)
    this.group.rotation.set(this.tilt.roll * afloat, 0, this.tilt.pitch * afloat, 'YXZ')

    if (dt) {
      const speed = Math.hypot(x - this.last.x, z - this.last.z) / dt
      this.pace = speed
      if (speed > 0.01) {
        this.water.disturb(x + half, z, 0.22 * speed * dt, 0.14)
        this.water.disturb(x - half, z, -0.22 * speed * dt, 0.14)
      }
    }
    this.last.set(x, 0, z)
    this.group.updateMatrixWorld(true)

    const fast = this.stage === 'work' && !this.call?.work?.built
    const end = this.spec.length / 2
    this.lines.forEach((line, bow) => {
      line.visible = fast
      if (!fast) return
      const from = new THREE.Vector3(bow ? end - 0.22 : -end + 0.04, DECK + (bow ? 0.03 : 0), -this.spec.beam * (bow ? 0.12 : 0.36))
      const post = bollardNear(x + (bow ? end + 0.2 : -end - 0.3))
      stretch(line, from, this.group.worldToLocal(new THREE.Vector3(post, QUAY_TOP + 0.03, BOLLARDS.z)))
    })
  }
}
