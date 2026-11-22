import * as THREE from 'three/webgpu'
import {
  BLOCK, BOX, QUAY_TOP, QUAY_Z, SEABED, TERMINAL_X1,
  ball, bar, bulb, chip, cone, cyl, fuse, pane, prism, rand, rbox, slab, torus,
} from './kit'
import { QUAY_CRANE, YARD_CRANE } from './models/cranes'
import { brickWarehouse, marineTower, sakura, stoneLantern } from './models/landmarks'
import { buildTown, type Floater } from './models/town'
import type { Look, PortDef } from './sim/game'
import { APRON_Z, BAY_Z, BERTH_X, BOLLARDS, GROUND_Y, LANE_EAST, LANE_WEST, TUG_QUAY } from './sim/layout'
import { AISLES, BLOCK_PITCH, YARD, YARD_SIZE } from './sim/yard'
import { C, FINISH } from './style'

export type { Floater }

export interface Harbor {
  group: THREE.Group
  floaters: Floater[]
  lamp: THREE.Object3D
  // Things that turn on their own axis, in radians a second.
  spinners: { object: THREE.Object3D; speed: number }[]
}

const LENGTH = BLOCK.x1 - BLOCK.x0
// About four stones and a dozen weed blades to every unit of seabed.
const STONES = Math.round(LENGTH * 4.4)
const WEEDS = Math.round(LENGTH * 2.5) * 5
const PAINT = 0.0015
const random = rand(7)

// A flat mark painted on the ground.
function paint(x0: number, x1: number, z0: number, z1: number, color: string, y = GROUND_Y): THREE.Mesh {
  return slab(x0, x1, y, y + PAINT, z0, z1, color)
}

function ground(g: THREE.Group): void {
  const { x0, x1, z0, z1 } = BLOCK
  g.add(
    slab(x0, x1, SEABED - 0.05, SEABED, z0, z1, C.sand),
    slab(x0, x1, SEABED - 0.1, SEABED - 0.05, z0, z1, C.clay),
    slab(x0, TERMINAL_X1, SEABED, QUAY_TOP, z0, QUAY_Z, C.concrete),
    slab(TERMINAL_X1, x1, SEABED, QUAY_TOP, z0, QUAY_Z, C.stone),
    slab(x0, TERMINAL_X1, QUAY_TOP, GROUND_Y, z0, -0.5, C.asphalt),
  )
  // The apron is cast in bays; the joints between them show.
  for (let x = x0 + 1.13; x < TERMINAL_X1; x += 1.13) g.add(paint(x - 0.004, x + 0.004, -0.5, -0.052, C.stone, QUAY_TOP))

  // Quay wall: steel sheet piling under a concrete cap, coping stones along the edge.
  for (let x = x0 + 0.07; x < TERMINAL_X1; x += 0.14) g.add(chip(0.075, 0.32, 0.024, C.steel, x, -0.09, QUAY_Z + 0.004))
  for (let x = x0; x < TERMINAL_X1 - 0.01; x += 1.85) {
    const length = Math.min(1.84, TERMINAL_X1 - x)
    g.add(rbox(length, 0.07, 0.034, C.concrete, x + length / 2, 0.104, QUAY_Z + 0.008, 0.008))
  }
  for (let x = x0; x < TERMINAL_X1 - 0.01; x += 0.6) {
    const length = Math.min(0.59, TERMINAL_X1 - x)
    g.add(rbox(length, 0.016, 0.054, C.cream, x + length / 2, QUAY_TOP + 0.007, -0.022, 0.006))
  }
  g.add(paint(x0, TERMINAL_X1, -0.056, -0.046, C.signalYellow, QUAY_TOP + 0.0005))
  for (let x = BOLLARDS.x0; x < TERMINAL_X1; x += BOLLARDS.pitch) {
    g.add(
      cyl(0.013, 0.018, 0.03, C.iron, x, QUAY_TOP + 0.03, BOLLARDS.z, 12),
      cyl(0.021, 0.017, 0.012, C.signalYellow, x, QUAY_TOP + 0.05, BOLLARDS.z, 12),
    )
  }
  for (const berth of BERTH_X) {
    for (let x = berth - 1.4; x <= berth + 1.41; x += 0.35) {
      const fender = cyl(0.046, 0.05, 0.03, C.rubber, x, 0.05, QUAY_Z + 0.016, 16)
      fender.rotation.x = Math.PI / 2
      const boss = cyl(0.016, 0.016, 0.034, C.steel, x, 0.05, QUAY_Z + 0.016, 10)
      boss.rotation.x = Math.PI / 2
      g.add(fender, boss)
    }
    // A safety ladder at each end of the berth.
    for (const end of [-1.58, 1.58]) {
      for (const dx of [-0.02, 0.02]) g.add(chip(0.007, 0.24, 0.007, C.signalYellow, berth + end + dx, 0.02, QUAY_Z + 0.03))
      for (let y = -0.08; y < 0.13; y += 0.035) g.add(chip(0.04, 0.006, 0.006, C.signalYellow, berth + end, y, QUAY_Z + 0.03))
    }
  }
  for (let x = x0 + 0.4; x < x1; x += 0.5) {
    const crust = ball(0.02 + random() * 0.015, random() < 0.5 ? C.mussel : C.moss, x + random() * 0.3, -0.06 - random() * 0.15, QUAY_Z + 0.014)
    crust.scale.z = 0.4
    g.add(crust)
  }

  // Crane rails with a buffer at each end, and the yard road with its lane markings.
  for (const z of [QUAY_CRANE.waterside, QUAY_CRANE.landside]) {
    g.add(slab(x0 + 0.2, TERMINAL_X1 - 0.2, QUAY_TOP, QUAY_TOP + 0.008, z - 0.012, z + 0.012, C.iron))
    for (const x of [x0 + 0.2, TERMINAL_X1 - 0.2]) g.add(chip(0.03, 0.04, 0.05, C.signalYellow, x, QUAY_TOP + 0.02, z))
  }
  // Traffic goes west along the yard road and back east under the quay cranes. A broken line parts each
  // through lane from the bays beside it, and a yellow box marks every crossing, which is kept clear.
  const lines: [number, number][] = [[(BAY_Z + LANE_WEST) / 2, GROUND_Y], [(LANE_EAST + APRON_Z) / 2, QUAY_TOP]]
  for (const [z, y] of lines) {
    for (let x = x0 + 0.3; x < TERMINAL_X1 - 0.9; x += 0.32) g.add(paint(x, x + 0.14, z - 0.004, z + 0.004, C.white, y))
  }
  g.add(paint(x0 + 0.2, TERMINAL_X1, -0.488, -0.482, C.white), paint(x0 + 0.2, TERMINAL_X1 - 0.9, -0.681, -0.676, C.white))
  for (const aisle of AISLES) {
    for (const [from, to, y] of [[-0.585, -0.49, GROUND_Y], [-0.425, -0.325, QUAY_TOP]]) {
      for (const dx of [-0.37, 0.37]) g.add(paint(aisle + dx - 0.004, aisle + dx + 0.004, from, to, C.signalYellow, y))
      for (const z of [from, to]) g.add(paint(aisle - 0.37, aisle + 0.37, z - 0.004, z + 0.004, C.signalYellow, y))
      for (const dx of [-0.17, 0.17]) g.add(paint(aisle + dx - 0.05, aisle + dx + 0.05, (from + to) / 2 - 0.004, (from + to) / 2 + 0.004, C.signalYellow, y))
    }
  }
}

// A numeral painted on the apron at each berth.
function numeral(berth: number): THREE.Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = C.signalBlue
  ctx.font = '900 96px "Helvetica Neue", Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${berth + 1}`, 128, 68)
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.13),
    new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, roughness: FINISH.ground }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(BERTH_X[berth], QUAY_TOP + 0.001, -0.15)
  mesh.receiveShadow = true
  return mesh
}

// Ground the city keeps along the back of the terminal, where another port would have yard blocks: a park
// behind a hedge, and at Yokohama the old brick warehouses and the tower by the water.
function cityside(g: THREE.Group, look: Look, from: number, to: number): void {
  const chance = rand(11 + from)
  const x0 = YARD.x0 + from * BLOCK_PITCH - 0.11
  const x1 = YARD.x0 + to * BLOCK_PITCH - 0.07 + YARD_SIZE.x
  const front = -0.7
  const put = (model: THREE.Object3D, x: number, z: number): void => {
    model.position.set(x, GROUND_Y + 0.005, z)
    g.add(model)
  }
  g.add(
    slab(x0, x1, GROUND_Y, GROUND_Y + 0.005, BLOCK.z0 + 0.02, front, C.grass),
    slab(x0, x1, GROUND_Y + 0.005, GROUND_Y + 0.007, front - 0.1, front - 0.04, C.cobble),
    rbox(x1 - x0, 0.024, 0.02, C.moss, (x0 + x1) / 2, GROUND_Y + 0.017, front, 0.008),
  )
  const length = x1 - x0
  if (look === 'yokohama' && length > 3) {
    g.add(slab(x0 + 0.15, x0 + 3.3, GROUND_Y + 0.005, GROUND_Y + 0.007, -1.16, front - 0.1, C.cobble))
    put(brickWarehouse(1.5), x0 + 1.0, -0.99)
    put(brickWarehouse(1.1), x0 + 2.6, -0.99)
  } else if (look === 'yokohama') {
    put(marineTower(0.44), x0 + 0.5, -1.0)
    g.add(
      cyl(0.09, 0.096, 0.02, C.stone, x0 + 1.3, GROUND_Y + 0.015, -0.95, 20), cyl(0.078, 0.078, 0.006, C.paleBlue, x0 + 1.3, GROUND_Y + 0.026, -0.95, 20),
      cyl(0.012, 0.016, 0.05, C.stone, x0 + 1.3, GROUND_Y + 0.045, -0.95, 10),
    )
  }
  for (let x = x0 + 0.15; x < x1 - 0.1; x += 0.3 + chance() * 0.25) {
    const cherry = look === 'yokohama'
    if (cherry) put(sakura(0.045 + chance() * 0.015, chance), x, front - 0.2 + (chance() - 0.5) * 0.05)
    else put(fuse(new THREE.Group().add(cyl(0.008, 0.012, 0.06, C.timber, 0, 0.03, 0, 8), ball(0.05, C.leaf, 0, 0.1, 0))), x, front - 0.2)
    if (chance() < 0.4) put(stoneLantern(), x + 0.12, front - 0.13)
  }
  for (let x = x0 + 0.5; x < x1 - 0.3; x += 0.9) {
    g.add(chip(0.06, 0.006, 0.02, C.timber, x, GROUND_Y + 0.026, front - 0.12), chip(0.06, 0.02, 0.005, C.timber, x, GROUND_Y + 0.036, front - 0.132))
  }
}

function terminal(g: THREE.Group, def: PortDef): void {
  const [first, last] = def.rules?.plots ?? [0, YARD.blocks - 1]
  const open = (block: number) => block >= first && block <= last
  if (first > 0) cityside(g, def.look, 0, first - 1)
  if (last < YARD.blocks - 1) cityside(g, def.look, last + 1, YARD.blocks - 1)
  // Yard blocks: a painted outline for every plot, rails for the yard cranes, a light mast in every aisle.
  for (let block = 0; block < YARD.blocks; block++) {
    if (!open(block)) continue
    const x0 = YARD.x0 + block * BLOCK_PITCH - 0.11
    const x1 = x0 + YARD_SIZE.x + 0.04
    for (const z of [-0.698, -1.118]) g.add(paint(x0, x1, z, z + 0.006, C.white))
    for (const x of [x0, x1 - 0.006]) g.add(paint(x, x + 0.006, -1.112, -0.698, C.white))
    g.add(slab(x0 - 0.05, x1 + 0.05, GROUND_Y, GROUND_Y + 0.004, YARD_CRANE.back - 0.008, YARD_CRANE.back + 0.008, C.iron))
  }
  for (let aisle = 0; aisle < YARD.blocks - 1; aisle++) {
    if (!open(aisle) || !open(aisle + 1)) continue
    const x = YARD.x0 + aisle * BLOCK_PITCH + YARD_SIZE.x - 0.09 + YARD.blockGap / 2
    g.add(
      cyl(0.008, 0.014, 0.44, C.steel, x, GROUND_Y + 0.22, -1.165, 8),
      rbox(0.11, 0.02, 0.03, C.steel, x, GROUND_Y + 0.44, -1.155, 0.006),
      chip(0.03, 0.03, 0.03, C.iron, x, GROUND_Y + 0.02, -1.165),
    )
    for (const dx of [-0.036, 0, 0.036]) g.add(bulb(0.011, C.lampWarm, x + dx, GROUND_Y + 0.426, -1.146))
  }

  // Terminal office with its control tower, and staff cars beside it.
  const office = new THREE.Group()
  office.add(
    rbox(0.36, 0.15, 0.2, C.cream, 0, 0.075, 0, 0.012),
    rbox(0.39, 0.016, 0.23, C.slate, 0, 0.155, 0, 0.006),
    chip(0.07, 0.03, 0.06, C.steel, -0.09, 0.176, -0.03),
    chip(0.036, 0.056, 0.008, C.signalBlue, -0.02, 0.028, 0.101),
    chip(0.3, 0.012, 0.01, C.signalBlue, 0, 0.139, 0.101),
    rbox(0.08, 0.34, 0.08, C.white, 0.2, 0.17, -0.04, 0.012),
    rbox(0.13, 0.05, 0.13, C.glass, 0.2, 0.36, -0.04, 0.014),
    rbox(0.15, 0.014, 0.15, C.slate, 0.2, 0.392, -0.04, 0.005),
    cyl(0.003, 0.004, 0.08, C.rope, 0.2, 0.44, -0.04, 6),
    bulb(0.007, C.lampRed, 0.2, 0.484, -0.04),
  )
  for (const y of [0.05, 0.105]) {
    for (let i = 0; i < 5; i++) {
      if (y < 0.06 && i === 2) continue
      office.add(pane(0.034, 0.03, 0.006, -0.14 + i * 0.062, y, 0.1, (i + (y < 0.06 ? 1 : 0)) % 3 === 0))
    }
  }
  const dish = ball(0.022, C.white, 0.235, 0.41, -0.04)
  dish.scale.set(0.35, 1, 1)
  office.add(dish)
  office.position.set(3.4, GROUND_Y, -0.98)
  g.add(office)
  for (const [x, z, color] of [[3.04, -1.06, C.pink], [3.04, -0.97, C.teal], [3.04, -0.88, C.cream]] as const) {
    g.add(rbox(0.075, 0.022, 0.04, color, x, GROUND_Y + 0.02, z, 0.008), rbox(0.04, 0.02, 0.036, C.glass, x - 0.004, GROUND_Y + 0.038, z, 0.007))
    for (const dx of [-0.022, 0.022]) g.add(chip(0.016, 0.016, 0.044, C.rubber, x + dx, GROUND_Y + 0.01, z))
  }

  // The gate: a sign bridge over the road and a fence along the boundary with the town.
  // Trucks come in on the yard side and leave on the quay side.
  const gateX = TERMINAL_X1 - 0.03
  for (const z of [-0.72, -0.255]) g.add(rbox(0.024, 0.24, 0.024, C.white, gateX, GROUND_Y + 0.12, z, 0.006))
  g.add(
    rbox(0.03, 0.03, 0.49, C.white, gateX, GROUND_Y + 0.24, -0.4875, 0.008),
    chip(0.01, 0.045, 0.2, C.signalBlue, gateX + 0.014, GROUND_Y + 0.235, -0.4875),
    bulb(0.009, C.lampGreen, gateX + 0.02, GROUND_Y + 0.212, BAY_Z, 2),
    bulb(0.009, C.lampRed, gateX + 0.02, GROUND_Y + 0.212, -0.335, 2),
  )
  for (const [from, to] of [[BLOCK.z0 + 0.03, -0.74], [-0.235, -0.1]]) {
    g.add(rbox(0.008, 0.008, to - from, C.white, TERMINAL_X1, GROUND_Y + 0.05, (from + to) / 2, 0.003))
    g.add(rbox(0.008, 0.008, to - from, C.white, TERMINAL_X1, GROUND_Y + 0.028, (from + to) / 2, 0.003))
    for (let z = from; z <= to + 0.001; z += (to - from) / Math.round((to - from) / 0.09)) {
      g.add(chip(0.012, 0.064, 0.012, C.white, TERMINAL_X1, GROUND_Y + 0.032, z))
    }
  }

  // Service yard at the west end: the workshop, fuel tanks and spare gear.
  const west = BLOCK.x0
  const shop = new THREE.Group()
  const vault = prism([[-0.27, 0], [-0.2, 0.07], [0, 0.1], [0.2, 0.07], [0.27, 0]], 0.36, C.slate, 0.008)
  vault.position.y = 0.16
  shop.add(rbox(0.52, 0.16, 0.34, C.cream, 0, 0.08, 0, 0.012), vault)
  for (const x of [-0.13, 0.11]) {
    shop.add(chip(0.16, 0.12, 0.008, C.signalBlue, x, 0.062, 0.171))
    for (let k = 1; k < 5; k++) shop.add(chip(0.16, 0.004, 0.01, C.navy, x, k * 0.025, 0.171))
  }
  shop.add(chip(0.03, 0.05, 0.008, C.timberDark, 0.235, 0.027, 0.171), chip(0.42, 0.014, 0.01, C.signalYellow, 0, 0.142, 0.171))
  shop.position.set(west + 0.42, GROUND_Y, -0.98)
  g.add(shop)
  for (const x of [west + 0.86, west + 1.06]) {
    g.add(
      cyl(0.085, 0.085, 0.2, C.white, x, GROUND_Y + 0.1, -1.04, 20),
      cyl(0.087, 0.087, 0.024, C.signalRed, x, GROUND_Y + 0.14, -1.04, 20),
      cone(0.085, 0.03, C.white, x, GROUND_Y + 0.215, -1.04, 20),
      chip(0.008, 0.2, 0.008, C.steel, x + 0.06, GROUND_Y + 0.1, -0.975),
    )
  }
  g.add(rbox(0.44, 0.03, 0.012, C.concrete, west + 0.96, GROUND_Y + 0.015, -0.93, 0.004))
  g.add(rbox(BOX.l, 0.014, BOX.w, C.signalYellow, west + 0.9, GROUND_Y + 0.03, -0.8, 0.004), chip(0.05, 0.03, 0.04, C.iron, west + 0.9, GROUND_Y + 0.02, -0.8))
  for (let k = 0; k < 3; k++) {
    const tyre = torus(0.022, 0.011, C.rubber, west + 1.12, GROUND_Y + 0.012 + k * 0.021, -0.8)
    tyre.rotation.x = Math.PI / 2
    g.add(tyre)
  }
  // Tyre fenders along the stretch of quay where the tugs lie.
  for (let x = TUG_QUAY.x - 0.2; x < TUG_QUAY.x + 1.4; x += 0.4) {
    g.add(torus(0.032, 0.013, C.rubber, x, 0.05, QUAY_Z + 0.03), bar([x, 0.08, QUAY_Z + 0.03], [x, QUAY_TOP, QUAY_Z + 0.008], 0.003, C.rope, 5))
  }
}

function buoy(color: string, tall: boolean): THREE.Group {
  const g = new THREE.Group()
  g.add(cyl(0.035, 0.04, 0.05, color, 0, 0.01, 0, 18), cyl(0.037, 0.039, 0.012, C.white, 0, 0.022, 0, 18))
  if (tall) {
    g.add(cyl(0.012, 0.022, 0.1, color, 0, 0.08, 0, 12), bulb(0.01, C.lampGreen, 0, 0.14, 0, 2))
    for (const turn of [0, Math.PI / 2]) {
      const vane = chip(0.05, 0.03, 0.004, color, 0, 0.1, 0)
      vane.rotation.y = turn
      g.add(vane)
    }
  } else {
    g.add(ball(0.02, color, 0, 0.045, 0))
  }
  return fuse(g)
}

function seabed(group: THREE.Group, g: THREE.Group): void {
  const stones = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: C.rock, roughness: 0.95 }),
    STONES,
  )
  const m = new THREE.Matrix4()
  for (let i = 0; i < STONES; i++) {
    const s = 0.012 + random() * 0.025
    m.compose(
      new THREE.Vector3(BLOCK.x0 + 0.2 + random() * (LENGTH - 0.4), SEABED + s * 0.3, QUAY_Z + 0.06 + random() * 0.9),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(random() * 6, random() * 6, 0)),
      new THREE.Vector3(s, s * 0.6, s),
    )
    stones.setMatrixAt(i, m)
  }
  stones.receiveShadow = true
  group.add(stones)

  const weed = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.01, 1, 6),
    new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    WEEDS,
  )
  const color = new THREE.Color()
  for (let i = 0; i < WEEDS; i++) {
    const tuft = Math.floor(i / 5)
    const tx = BLOCK.x0 + 0.3 + ((tuft * 0.618) % 1) * (LENGTH - 0.6)
    const tz = QUAY_Z + 0.5 + ((tuft * 0.377) % 1) * 0.45
    const hgt = 0.04 + random() * 0.08
    m.compose(
      new THREE.Vector3(tx + (random() - 0.5) * 0.05, SEABED + hgt / 2, tz + (random() - 0.5) * 0.05),
      new THREE.Quaternion().setFromEuler(new THREE.Euler((random() - 0.5) * 0.4, 0, (random() - 0.5) * 0.4)),
      new THREE.Vector3(1, hgt, 1),
    )
    weed.setMatrixAt(i, m)
    weed.setColorAt(i, color.set(random() < 0.5 ? C.weed : C.leafLight))
  }
  group.add(weed)

  for (let i = 0; i * 2.05 < LENGTH - 1.5; i++) {
    const star = ball(0.02, i % 2 ? C.wrasse : C.coral, BLOCK.x0 + 1 + i * 2.05, SEABED + 0.004, 0.75 + ((i * 0.37) % 1) * 0.2)
    star.scale.y = 0.3
    g.add(star)
  }
  // Things lost overboard over the years.
  const lost = rbox(BOX.l, BOX.h, BOX.w, C.teal, -6.2, SEABED + 0.025, 0.93, 0.012)
  lost.rotation.set(0.25, 0.5, 0.12)
  const tyre = torus(0.03, 0.013, C.rubber, 1.6, SEABED + 0.012, 0.86)
  tyre.rotation.x = Math.PI / 2 - 0.2
  const anchor = new THREE.Group()
  anchor.add(chip(0.012, 0.09, 0.012, C.iron, 0, 0.045, 0), chip(0.07, 0.012, 0.012, C.iron, 0, 0.012, 0), torus(0.012, 0.004, C.iron, 0, 0.098, 0))
  anchor.position.set(-10.3, SEABED, 0.9)
  anchor.rotation.set(1.2, 0.4, 0.2)
  g.add(lost, tyre, anchor)
}

export function buildHarbor(def: PortDef): Harbor {
  const style = def.look
  const group = new THREE.Group()
  const still = new THREE.Group()
  ground(still)
  terminal(still, def)
  seabed(group, still)
  group.add(fuse(still), ...BERTH_X.map((_, berth) => numeral(berth)))

  const town = buildTown(style)
  group.add(town.group)
  const floaters = [...town.floaters]
  const buoys: [THREE.Group, number][] = [
    [buoy(C.buoyGreen, true), -12.2], [buoy(C.signalYellow, false), -8.4], [buoy(C.signalYellow, false), -4.6],
    [buoy(C.buoyGreen, true), 2.4], [buoy(C.signalYellow, false), 5.2],
  ]
  for (const [object, x] of buoys) {
    group.add(object)
    // Out at the very edge, clear of the widest ship in the channel.
    object.scale.setScalar(0.8)
    floaters.push({ object, x, z: 1.075, span: 0.04 })
  }
  return { group, floaters, lamp: town.lamp, spinners: town.spinners }
}
