import * as THREE from 'three/webgpu'
import {
  BLOCK, QUAY_TOP, QUAY_Z, SEABED, TERMINAL_X1,
  ball, bar, bulb, chip, cone, cyl, fuse, glow, hull, mat, pane, prism, rand, rbox, slab,
} from '../kit'
import type { Look } from '../sim/game'
import { C } from '../style'
import {
  barge, bicycle, bigWheel, bundBlock, canalHouse, carpPole, cityHall, cubeHouses, customsHouse, decoBlock, derrick,
  euromast, fanPalm, greatChurch, hillSign, jackTower, junk, landmarkTower, lanterns, lifeguardTower, liner,
  linerOffice, machiya, observatory, pagoda, pailou, pearlTower, pleasureBoat, recordTower, sailHotel, sakura,
  shrine, skyscraper, stoneLantern, surfboard, torii, towerMill, tulips, turbine, waveTowers,
} from './landmarks'

export interface Floater {
  object: THREE.Object3D
  x: number
  z: number
  span: number
}

export interface Town {
  group: THREE.Group
  floaters: Floater[]
  lamp: THREE.Object3D
  spinners: { object: THREE.Object3D; speed: number }[]
}

// What changes from one port's surroundings to the next. The terminal itself is the same everywhere.
const LOOKS: Record<Look, {
  houses: string[]; roofs: string[]; land: string; spire: string; bands: string[]; cap: string
  palms: boolean; flat: boolean; trim: string; door: string
}> = {
  nordic: {
    houses: [C.faluRed, C.ochre, C.white, C.paleBlue, C.mint, C.pink], roofs: [C.roofTile, C.slate, C.roofTerracotta],
    land: C.grass, spire: C.copper, bands: [C.signalRed, C.white, C.signalRed, C.white], cap: C.signalRed,
    palms: false, flat: false, trim: C.white, door: C.timberDark,
  },
  sunbelt: {
    houses: [C.white, C.cream, C.ochre, C.pink, C.clay], roofs: [C.roofTerracotta, C.roofTile],
    land: C.sand, spire: C.signalBlue, bands: [C.white, C.signalBlue, C.white, C.signalBlue], cap: C.signalBlue,
    palms: true, flat: true, trim: C.signalBlue, door: C.signalBlue,
  },
  rotterdam: {
    houses: [C.brick, C.roofTile, C.timberDark, C.cream, C.ochre, C.faluRed], roofs: [C.roofTile, C.slate],
    land: C.grass, spire: C.copper, bands: [C.faluRed, C.faluRed, C.white, C.faluRed], cap: C.iron,
    palms: false, flat: false, trim: C.white, door: C.tealDeep,
  },
  yokohama: {
    houses: [C.white, C.cream, C.white, C.brick], roofs: [C.slate, C.iron],
    land: C.grass, spire: C.copper, bands: [C.white, C.white, C.white, C.signalRed], cap: C.signalRed,
    palms: false, flat: false, trim: C.timberDark, door: C.timberDark,
  },
  losangeles: {
    houses: [C.white, C.cream, C.mint, C.pink, C.paleBlue], roofs: [C.roofTerracotta, C.roofTile],
    land: C.sand, spire: C.slate, bands: [C.white, C.iron, C.white, C.white], cap: C.iron,
    palms: true, flat: true, trim: C.teal, door: C.tealDeep,
  },
  shanghai: {
    houses: [C.cream, C.stone, C.concrete, C.rock], roofs: [C.slate, C.timberDark],
    land: C.cobble, spire: C.copper, bands: [C.white, C.signalRed, C.white, C.signalRed], cap: C.signalRed,
    palms: false, flat: false, trim: C.signalRed, door: C.timberDark,
  },
}
const SEEDS: Record<Look, number> = { nordic: 7, sunbelt: 23, rotterdam: 31, yokohama: 43, losangeles: 59, shanghai: 71 }
// The famous harbours have a skyline of their own on the terrace, in place of the church and the upper row.
const FAMOUS: Look[] = ['rotterdam', 'yokohama', 'losangeles', 'shanghai']

const TERRACE = 0.22
const WALL_Z = -0.72
const ROAD = { z0: -0.41, z1: -0.2 }
const PEOPLE = [C.signalBlue, C.faluRed, C.ochre, C.teal, C.violet, C.cream, C.berry, C.green]

// The town east of the terminal: a waterfront street of wharf houses round a market square, an upper
// row on the terrace behind, a jetty of small boats and a lighthouse on the mole at the harbour mouth.
export function buildTown(style: Look): Town {
  const look = LOOKS[style]
  const random = rand(SEEDS[style])
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)]
  const g = new THREE.Group()
  const floaters: Floater[] = []
  const spinners: Town['spinners'] = []
  const famous = FAMOUS.includes(style)
  // Parts that move, kept out of the one fused model.
  const loose: THREE.Object3D[] = []
  const put = (model: THREE.Object3D, x: number, y: number, z: number, turn = 0): void => {
    model.position.set(x, y, z)
    model.rotation.y = turn
    g.add(model)
  }
  const W = TERMINAL_X1
  const E = BLOCK.x1
  const Y = QUAY_TOP

  g.add(
    slab(W + 0.5, E, Y, TERRACE, BLOCK.z0, WALL_Z, look.land),
    slab(W + 0.5, E, Y, TERRACE + 0.014, WALL_Z, WALL_Z + 0.022, C.stone),
    slab(W + 0.488, W + 0.51, Y, TERRACE + 0.014, BLOCK.z0, WALL_Z + 0.022, C.stone),
    slab(W, E, Y, Y + 0.004, ROAD.z0, ROAD.z1, C.asphalt),
    slab(W, W + 0.488, Y, Y + 0.004, WALL_Z + 0.022, ROAD.z0, C.asphalt),
    slab(W + 0.51, E, Y, Y + 0.003, WALL_Z + 0.022, ROAD.z0 - 0.012, C.cobble),
    slab(W, E, Y, Y + 0.003, ROAD.z1 + 0.012, QUAY_Z, C.cobble),
    slab(W + 0.51, E, Y, Y + 0.009, ROAD.z0 - 0.012, ROAD.z0, C.stone),
    slab(W, E, Y, Y + 0.009, ROAD.z1, ROAD.z1 + 0.012, C.stone),
  )
  for (let x = W + 0.08; x < E - 0.1; x += 0.24) g.add(slab(x, x + 0.1, Y + 0.004, Y + 0.0055, -0.308, -0.302, C.white))

  // The old harbour wall: courses of dressed stone under a coping.
  for (let row = 0; row < 6; row++) {
    const y = Y - 0.045 - row * 0.066
    for (let x = W + (row % 2 ? 0.02 : 0.12); x < E - 0.1; x += 0.205) {
      g.add(chip(0.19, 0.056, 0.02, random() < 0.5 ? C.stone : C.rock, x + 0.095, y, QUAY_Z + 0.004))
    }
  }
  for (let x = W + 0.01; x < E - 0.2; x += 0.41) g.add(chip(0.4, 0.02, 0.06, C.cream, x + 0.2, Y + 0.008, QUAY_Z - 0.022))

  // Most windows have someone at home after dark; some come on later than others and a few stay dark.
  const home = rand(53)
  const glass = (w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh => {
    const who = home()
    return who < 0.28 ? chip(w, h, d, C.glass, x, y, z) : pane(w, h, d, x, y, z, who > 0.66)
  }
  const windows = (b: THREE.Group, w: number, y: number, z: number, count: number, shutters = false): void => {
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5) / count - 0.5) * w * 0.86
      b.add(chip(0.03, 0.036, 0.006, C.white, x, y, z), glass(0.018, 0.024, 0.009, x, y, z))
      if (shutters) for (const sx of [-0.02, 0.02]) b.add(chip(0.009, 0.034, 0.007, look.trim, x + sx, y, z))
    }
  }

  // Tall wharf house with its gable to the water.
  const wharf = (x: number, z: number, y: number, w: number, h: number, d = 0.2): void => {
    const b = new THREE.Group()
    const wall = pick(look.houses)
    const rise = w * 0.5
    const roof = prism([[-w / 2 - 0.014, 0], [0, rise], [w / 2 + 0.014, 0]], d + 0.02, pick(look.roofs), 0.008)
    const face = prism([[-w / 2 + 0.012, 0], [0, rise - 0.026], [w / 2 - 0.012, 0]], 0.012, wall, 0.003)
    roof.position.y = h
    face.position.set(0, h, d / 2 + 0.012)
    b.add(rbox(w, h, d, wall, 0, h / 2, 0, 0.012), roof, face)
    const floors = Math.max(1, Math.round((h - 0.06) / 0.066))
    for (let f = 0; f < floors; f++) windows(b, w, 0.085 + f * 0.066, d / 2, w > 0.17 ? 3 : 2)
    b.add(
      chip(0.03, 0.052, 0.008, look.door, (random() - 0.5) * w * 0.4, 0.026, d / 2 + 0.001),
      chip(0.024, 0.03, 0.008, C.timberDark, 0, h + rise * 0.3, d / 2 + 0.017),
      chip(0.008, 0.008, 0.05, C.timberDark, 0, h + rise * 0.62, d / 2 + 0.03),
      chip(0.024, 0.06, 0.024, C.brick, w * 0.24, h + rise * 0.5, -d * 0.2),
    )
    b.position.set(x, y, z)
    g.add(b)
  }

  // Low house with its ridge along the street.
  const cottage = (x: number, z: number, y: number, w: number, h: number, d = 0.15): void => {
    const b = new THREE.Group()
    const wall = pick(look.houses)
    const roof = prism([[-d / 2 - 0.014, 0], [0, d * 0.56], [d / 2 + 0.014, 0]], w + 0.024, pick(look.roofs), 0.008)
    roof.rotation.y = Math.PI / 2
    roof.position.y = h
    b.add(rbox(w, h, d, wall, 0, h / 2, 0, 0.012), roof)
    windows(b, w, h * 0.6, d / 2, w > 0.2 ? 3 : 2)
    b.add(
      chip(0.028, 0.048, 0.008, look.door, w * 0.3, 0.024, d / 2 + 0.001),
      chip(0.034, 0.034, 0.03, wall, -w * 0.18, h + d * 0.2, d * 0.3),
      glass(0.018, 0.02, 0.008, -w * 0.18, h + d * 0.2, d * 0.3 + 0.013),
      chip(0.024, 0.05, 0.024, C.brick, w * 0.26, h + d * 0.42, 0),
    )
    b.position.set(x, y, z)
    g.add(b)
  }

  // Flat-roofed house of the sunbelt: a white block with shutters, a roof terrace and sometimes a dome.
  const villa = (x: number, z: number, y: number, w: number, h: number, d = 0.2): void => {
    const b = new THREE.Group()
    const wall = pick(look.houses)
    b.add(rbox(w, h, d, wall, 0, h / 2, 0, 0.014), rbox(w + 0.014, 0.014, d + 0.014, C.white, 0, h + 0.002, 0, 0.005))
    const floors = Math.max(1, Math.round((h - 0.05) / 0.07))
    for (let f = 0; f < floors; f++) windows(b, w, 0.085 + f * 0.07, d / 2, 2, true)
    b.add(chip(0.03, 0.052, 0.008, look.door, 0, 0.026, d / 2 + 0.001))
    const awning = prism([[0, 0], [0.04, -0.02], [0, -0.004]], w * 0.7, pick(look.roofs), 0.002)
    awning.rotation.y = -Math.PI / 2
    awning.position.set(0, 0.07, d / 2)
    b.add(awning)
    const top = random()
    if (top < 0.3) {
      const dome = ball(w * 0.26, look.spire, 0, h + 0.008, 0)
      dome.scale.y = 0.8
      b.add(dome)
    } else if (top < 0.7) {
      b.add(rbox(w * 0.55, 0.07, d * 0.7, wall, -w * 0.18, h + 0.04, -d * 0.1, 0.012), glass(0.02, 0.026, 0.008, -w * 0.18, h + 0.045, d * 0.25 + 0.001))
    } else {
      b.add(cyl(0.02, 0.02, 0.03, C.cream, w * 0.2, h + 0.024, -0.03, 12), chip(0.05, 0.004, 0.05, pick(look.roofs), -w * 0.15, h + 0.05, 0.02))
      for (const [dx, dz] of [[-0.02, -0.02], [0.02, -0.02], [-0.02, 0.02], [0.02, 0.02]]) b.add(chip(0.005, 0.04, 0.005, C.timber, -w * 0.15 + dx, h + 0.03, 0.02 + dz))
    }
    b.position.set(x, y, z)
    g.add(b)
  }

  const palm = (x: number, y: number, z: number, r: number): void => {
    const b = new THREE.Group()
    const height = r * 2.6
    const trunk = cyl(0.006, 0.01, height, C.timber, 0, height / 2, 0, 8)
    trunk.rotation.z = (random() - 0.5) * 0.3
    b.add(trunk)
    for (let i = 0; i < 6; i++) {
      const turn = (i / 6) * Math.PI * 2 + random()
      const frond = ball(r * 0.62, i % 2 ? C.leaf : C.leafLight, Math.cos(turn) * r * 0.6, height - r * 0.12, Math.sin(turn) * r * 0.6)
      frond.scale.set(1, 0.3, 0.42)
      frond.rotation.set(0, -turn, -0.45, 'YXZ')
      b.add(frond)
    }
    b.position.set(x, y, z)
    g.add(b)
  }
  const tree = (x: number, y: number, z: number, r: number): void => {
    if (style === 'yokohama' && random() < 0.65) return put(sakura(r * 1.1, random), x, y, z)
    if (style === 'losangeles' && random() < 0.55) return put(fanPalm(r * 5.5, random), x, y, z)
    if (look.palms) return palm(x, y, z, r)
    if (random() < 0.35) {
      g.add(cyl(0.007, 0.01, 0.04, C.timber, x, y + 0.02, z, 8))
      for (let i = 0; i < 3; i++) g.add(cone(r * (1 - i * 0.24), r * 1.5, i % 2 ? C.weed : C.moss, x, y + 0.04 + r * (0.6 + i * 0.62), z, 10))
      return
    }
    g.add(
      cyl(0.008, 0.012, 0.06, C.timber, x, y + 0.03, z, 8),
      ball(r, C.leaf, x, y + 0.06 + r * 0.8, z),
      ball(r * 0.7, C.leafLight, x + r * 0.5, y + 0.06 + r * 0.5, z + 0.01),
      ball(r * 0.6, C.leafLight, x - r * 0.45, y + 0.06 + r * 1.2, z - 0.01),
    )
  }
  const person = (x: number, y: number, z: number): void => {
    g.add(cyl(0.008, 0.011, 0.03, pick(PEOPLE), x, y + 0.015, z, 8), ball(0.008, C.clay, x, y + 0.037, z))
  }
  const lampPost = (x: number, z: number): void => {
    g.add(cyl(0.005, 0.007, 0.16, C.iron, x, Y + 0.08, z, 8), chip(0.03, 0.008, 0.008, C.iron, x + 0.012, Y + 0.16, z), bulb(0.012, C.lampWarm, x + 0.026, Y + 0.152, z))
  }
  const parasol = (x: number, y: number, z: number, color: string): void => {
    g.add(cyl(0.003, 0.003, 0.07, C.white, x, y + 0.035, z, 6), cone(0.04, 0.022, color, x, y + 0.078, z, 12), cyl(0.014, 0.014, 0.004, C.white, x, y + 0.03, z, 10))
  }
  const car = (x: number, z: number, color: string, turn = 0): void => {
    const b = new THREE.Group()
    b.add(rbox(0.075, 0.022, 0.04, color, 0, 0.02, 0, 0.008), rbox(0.04, 0.02, 0.036, C.glass, -0.004, 0.038, 0, 0.007), chip(0.036, 0.004, 0.038, color, -0.004, 0.049, 0))
    for (const wx of [-0.022, 0.022]) b.add(chip(0.016, 0.016, 0.044, C.rubber, wx, 0.01, 0))
    b.position.set(x, Y + 0.003, z)
    b.rotation.y = turn
    g.add(b)
  }

  // Brick warehouse between the gate and the town, with a sawtooth roof and a stack.
  const mill = new THREE.Group()
  mill.add(rbox(0.4, 0.15, 0.3, C.brick, 0, 0.075, 0, 0.012))
  for (let i = 0; i < 3; i++) {
    const tooth = prism([[-0.066, 0], [-0.066, 0.055], [0.066, 0]], 0.31, C.slate, 0.006)
    tooth.position.set(-0.133 + i * 0.133, 0.15, 0)
    mill.add(tooth, chip(0.006, 0.03, 0.26, C.glass, -0.2 + i * 0.133, 0.176, 0))
  }
  for (const x of [-0.11, 0.07]) mill.add(chip(0.07, 0.085, 0.008, C.timberDark, x, 0.044, 0.151), chip(0.076, 0.012, 0.01, C.cream, x, 0.092, 0.151))
  windows(mill, 0.4, 0.118, 0.15, 5)
  mill.add(cyl(0.02, 0.028, 0.3, C.brick, 0.15, 0.15, -0.08, 12), cyl(0.023, 0.023, 0.02, C.iron, 0.15, 0.305, -0.08, 12))
  mill.position.set(W + 0.25, Y, -0.98)
  g.add(mill)
  for (const [x, z, c] of [[W + 0.1, -0.76, C.teal], [W + 0.22, -0.76, C.cream], [W + 0.4, -0.76, C.berry]] as const) car(x, z, c)

  // Waterfront street. The square is left open in front of the stairs to the church.
  const SQUARE = { x0: 5.28, x1: 5.98 }
  const front = (x: number, w: number, h: number): void => {
    if (style === 'shanghai') return put(bundBlock(w + 0.03, h * 1.1 + 0.03, pick(look.houses), Math.floor(random() * 4)), x, Y, -0.59)
    if (style === 'yokohama') return put(machiya(w + 0.02, h * 0.75, random() < 0.25), x, Y, -0.59)
    if (style === 'rotterdam') return put(canalHouse(w, h * 1.2, pick(look.houses), Math.floor(random() * 3)), x, Y, -0.59)
    if (style === 'losangeles' && random() < 0.5) {
      return put(decoBlock(w + 0.02, h * 0.9, pick(look.houses), pick([C.teal, C.coral, C.signalYellow])), x, Y, -0.59)
    }
    return look.flat ? villa(x, -0.59, Y, w, h * 0.8) : wharf(x, -0.59, Y, w, h)
  }
  // Canal houses are narrow and stand wall to wall.
  const terraced = style === 'rotterdam'
  for (let x = W + 0.62; x < E - 1.0;) {
    const w = (0.16 + random() * 0.06) * (terraced ? 0.72 : 1)
    if (x + w > SQUARE.x0 && x < SQUARE.x1 + 0.34) {
      x = SQUARE.x1 + 0.34
      continue
    }
    front(x + w / 2, w, 0.17 + random() * 0.13)
    x += w + (terraced ? 0.006 : 0.035 + random() * 0.03)
  }

  if (style === 'losangeles') {
    // The beach at the east end: a lifeguard tower, boards stood in the sand, parasols.
    g.add(slab(E - 0.95, E, Y, Y + 0.006, WALL_Z + 0.03, ROAD.z0 - 0.02, C.sand))
    put(lifeguardTower(C.paleBlue), E - 0.62, Y, -0.6)
    ;[C.coral, C.signalYellow, C.teal, C.white].forEach((color, k) => put(surfboard(color), E - 0.4 + k * 0.035, Y, -0.6, 0.2 * k))
    for (let k = 0; k < 3; k++) parasol(E - 0.84 + k * 0.2, Y + 0.006, -0.5, [C.signalRed, C.teal, C.signalYellow][k])
  } else {
    // Boathouse at the east end, kept low so the windmill behind it shows.
    const shed = new THREE.Group()
    const shedRoof = prism([[-0.15, 0], [0, 0.06], [0.15, 0]], 0.22, look.roofs[0], 0.008)
    shedRoof.position.y = 0.09
    shed.add(
      rbox(0.27, 0.09, 0.2, look.flat ? C.white : C.faluRed, 0, 0.045, 0, 0.012), shedRoof,
      chip(0.13, 0.075, 0.008, C.timberDark, -0.03, 0.038, 0.101), glass(0.03, 0.03, 0.008, 0.09, 0.055, 0.101),
    )
    shed.position.set(E - 0.7, Y, -0.59)
    g.add(shed)
    const upturned = hull(0.16, 0.07, 0.022, 0.016, C.timberDark, C.paleBlue)
    upturned.rotation.x = Math.PI
    upturned.position.set(E - 0.42, Y + 0.03, -0.5)
    g.add(upturned, cyl(0.016, 0.016, 0.034, C.timber, E - 0.26, Y + 0.02, -0.56, 10), cyl(0.016, 0.016, 0.034, C.timber, E - 0.22, Y + 0.02, -0.54, 10))
    for (let k = 0; k < 4; k++) g.add(chip(0.03, 0.024, 0.03, k % 2 ? C.timber : C.orange, E - 0.3 + (k % 2) * 0.032, Y + 0.015 + Math.floor(k / 2) * 0.025, -0.47))
  }

  // Shanghai's tallest landmark stands here at the front, where the strip has room for its height.
  const pearl = (): THREE.Group => {
    const tower = pearlTower()
    tower.scale.setScalar(0.82)
    return tower
  }
  const halls: Partial<Record<Look, () => THREE.Group>> = {
    shanghai: pearl, yokohama: jackTower, rotterdam: linerOffice, losangeles: cityHall,
  }
  if (halls[style]) put(halls[style]!(), SQUARE.x1 + 0.16, Y, -0.59)
  else {
    // Town hall on the east side of the square, with its clock tower.
    const hall = new THREE.Group()
    const hallWall = look.flat ? C.cream : C.white
    const hip = prism([[-0.16, 0], [-0.09, 0.07], [0.09, 0.07], [0.16, 0]], 0.24, look.roofs[0], 0.008)
    hip.position.y = 0.19
    hall.add(rbox(0.28, 0.19, 0.22, hallWall, 0, 0.095, 0, 0.012), hip, rbox(0.08, 0.2, 0.08, hallWall, 0, 0.32, 0.07, 0.01))
    const hallCap = cone(0.062, 0.09, look.spire, 0, 0.465, 0.07, 4)
    hallCap.rotation.y = Math.PI / 4
    const dial = cyl(0.027, 0.027, 0.008, C.white, 0, 0.37, 0.111, 20)
    dial.rotation.x = Math.PI / 2
    hall.add(hallCap, dial, chip(0.004, 0.02, 0.004, C.iron, 0, 0.378, 0.116), chip(0.016, 0.004, 0.004, C.iron, 0.006, 0.37, 0.116))
    for (const x of [-0.09, 0, 0.09]) hall.add(chip(0.05, 0.07, 0.008, C.slate, x, 0.036, 0.111), chip(0.056, 0.012, 0.012, C.cream, x, 0.076, 0.111))
    windows(hall, 0.28, 0.13, 0.11, 4, look.flat)
    for (const x of [-0.17, 0.17]) {
      hall.add(cyl(0.003, 0.004, 0.2, C.white, x, 0.1, 0.14, 6), chip(0.04, 0.024, 0.003, x < 0 ? C.signalRed : C.signalBlue, x + 0.022, 0.186, 0.14))
    }
    hall.position.set(SQUARE.x1 + 0.16, Y, -0.59)
    g.add(hall)
  }

  // The square: a fountain, market stalls under striped awnings, and stairs up to the church.
  const cx = (SQUARE.x0 + SQUARE.x1) / 2
  g.add(
    cyl(0.07, 0.076, 0.022, C.stone, cx - 0.05, Y + 0.012, -0.54, 20),
    cyl(0.058, 0.058, 0.006, C.paleBlue, cx - 0.05, Y + 0.024, -0.54, 20),
    cyl(0.01, 0.014, 0.06, C.stone, cx - 0.05, Y + 0.045, -0.54, 10),
    ball(0.016, C.copper, cx - 0.05, Y + 0.082, -0.54),
  )
  for (let i = 0; i < 5; i++) {
    g.add(chip(0.22, 0.014, 0.034, i % 2 ? C.cream : C.stone, cx + 0.04, Y + 0.008 + i * 0.016, WALL_Z + 0.12 - i * 0.022))
  }
  for (const [x, z, a, b] of [[SQUARE.x0 + 0.1, -0.47, C.signalRed, C.white], [SQUARE.x0 + 0.27, -0.46, C.signalBlue, C.white], [SQUARE.x1 - 0.12, -0.47, C.amber, C.cream]] as const) {
    g.add(chip(0.09, 0.006, 0.05, C.timber, x, Y + 0.03, z))
    for (const dx of [-0.04, 0.04]) g.add(chip(0.005, 0.07, 0.005, C.timber, x + dx, Y + 0.035, z - 0.02), chip(0.005, 0.05, 0.005, C.timber, x + dx, Y + 0.025, z + 0.022))
    for (let s = 0; s < 5; s++) {
      const stripe = chip(0.021, 0.004, 0.066, s % 2 ? a : b, x - 0.042 + s * 0.021, Y + 0.064, z)
      stripe.rotation.x = 0.3
      g.add(stripe)
    }
    for (let k = 0; k < 3; k++) g.add(ball(0.008, pick([C.orange, C.signalRed, C.leaf, C.signalYellow]), x - 0.025 + k * 0.025, Y + 0.038, z))
  }
  for (const [x, z] of [[cx - 0.2, -0.5], [cx + 0.12, -0.5], [cx + 0.02, -0.62], [cx - 0.16, -0.6], [cx + 0.2, -0.56]]) person(x, Y + 0.003, z)

  if (!famous) {
    // Upper row on the terrace, with the church above the stairs.
    const church = new THREE.Group()
    const nave = prism([[-0.1, 0], [0, 0.085], [0.1, 0]], 0.3, C.slate, 0.008)
    nave.rotation.y = Math.PI / 2
    nave.position.set(0.1, 0.15, 0)
    church.add(rbox(0.3, 0.15, 0.17, C.white, 0.1, 0.075, 0, 0.012), nave, rbox(0.12, 0.27, 0.12, C.white, -0.11, 0.135, 0.01, 0.012))
    if (look.flat) {
      const dome = ball(0.055, look.spire, -0.11, 0.3, 0.01)
      church.add(dome, rbox(0.14, 0.014, 0.14, C.white, -0.11, 0.272, 0.01, 0.005), ball(0.012, C.ochre, -0.11, 0.362, 0.01))
    } else {
      const spire = cone(0.082, 0.19, look.spire, -0.11, 0.365, 0.01, 4)
      spire.rotation.y = Math.PI / 4
      church.add(spire, ball(0.01, C.ochre, -0.11, 0.466, 0.01))
    }
    church.add(chip(0.034, 0.06, 0.008, look.door, -0.11, 0.03, 0.071), pane(0.03, 0.04, 0.008, -0.11, 0.2, 0.071))
    for (const x of [0.02, 0.1, 0.18]) church.add(pane(0.022, 0.06, 0.008, x, 0.085, 0.086), chip(0.028, 0.008, 0.01, C.slate, x, 0.118, 0.086))
    church.position.set(cx - 0.02, TERRACE, -0.98)
    g.add(church)

    for (let x = W + 0.68; x < E - 0.2;) {
      if (x > cx - 0.3 && x < cx + 0.36) {
        x = cx + 0.36
        continue
      }
      const w = 0.16 + random() * 0.07
      const kind = random()
      if (kind < 0.16) {
        tree(x + 0.05, TERRACE, -0.98 + (random() - 0.5) * 0.1, 0.05 + random() * 0.02)
        x += 0.14
        continue
      }
      const h = 0.11 + random() * 0.05
      if (look.flat) villa(x + w / 2, -1.0, TERRACE, w, h, 0.17)
      else if (kind < 0.62) cottage(x + w / 2, -1.0, TERRACE, w + 0.04, h)
      else wharf(x + w / 2, -1.0, TERRACE, w, h + 0.02, 0.16)
      x += w + (kind < 0.62 && !look.flat ? 0.08 : 0.04) + random() * 0.03
    }
    // Along the terrace edge: a hedge, trees and a few gardens.
    for (let x = W + 0.62; x < E - 0.15; x += 0.3 + random() * 0.25) {
      if (x > cx - 0.14 && x < cx + 0.22) continue
      if (random() < 0.55) tree(x, TERRACE, -0.8 + (random() - 0.5) * 0.04, 0.035 + random() * 0.015)
      else {
        g.add(rbox(0.16, 0.026, 0.03, C.moss, x, TERRACE + 0.013, -0.775, 0.01))
        for (let k = 0; k < 4; k++) g.add(ball(0.007, pick([C.pink, C.signalYellow, C.white, C.coral]), x - 0.06 + k * 0.04, TERRACE + 0.012, -0.845 + (k % 2) * 0.02))
      }
    }

    // Windmill on the terrace at the east end. Its sails turn.
    const millX = E - 0.42
    const tower = cyl(0.04, 0.06, 0.2, look.flat ? C.white : C.cream, millX, TERRACE + 0.1, -0.84, 16)
    const hat = cone(0.05, 0.06, look.roofs[0], millX, TERRACE + 0.23, -0.84, 16)
    g.add(tower, hat, chip(0.022, 0.036, 0.008, look.door, millX, TERRACE + 0.02, -0.782), pane(0.016, 0.02, 0.008, millX, TERRACE + 0.12, -0.792, true))
    const sails = new THREE.Group()
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group()
      arm.add(chip(0.006, 0.12, 0.006, C.timberDark, 0, 0.06, 0), chip(0.03, 0.085, 0.004, C.white, 0.017, 0.072, 0))
      arm.rotation.z = (i * Math.PI) / 2
      sails.add(arm)
    }
    sails.add(cyl(0.01, 0.01, 0.016, C.timberDark, 0, 0, 0, 8).rotateX(Math.PI / 2))
    const rotor = fuse(sails)
    rotor.position.set(millX, TERRACE + 0.2, -0.78)
    spinners.push({ object: rotor, speed: -0.5 })
    loose.push(rotor)
  }

  // The skylines of the famous harbours, west to east along the terrace.
  const windmill = (x: number, h: number, speed: number): void => {
    const { body, sails, hub } = towerMill(h)
    put(body, x, TERRACE, -0.88)
    sails.position.set(x, TERRACE + hub[0], -0.88 + hub[1])
    spinners.push({ object: sails, speed })
    loose.push(sails)
  }
  if (style === 'shanghai') {
    // Pudong: the three tall towers and glass between, with the Customs House above the stairs. The old town
    // keeps the east end.
    put(skyscraper(2, 0.3), W + 0.74, TERRACE, -1.0)
    put(skyscraper(4, 0.2), W + 0.93, TERRACE, -0.93)
    put(skyscraper(1, 0.36), W + 1.12, TERRACE, -1.03)
    put(skyscraper(0, 0.4), W + 1.36, TERRACE, -1.0)
    const customs = customsHouse()
    customs.scale.setScalar(0.62)
    put(customs, cx + 0.03, TERRACE, -0.97)
    put(pailou(), cx + 0.04, TERRACE, -0.775)
    put(skyscraper(5, 0.24), cx + 0.44, TERRACE, -1.03)
    put(skyscraper(3, 0.3), cx + 0.64, TERRACE, -0.98)
    put(skyscraper(6, 0.19), cx + 0.84, TERRACE, -1.04)
    put(shrine(C.ochre, C.timberDark), E - 0.98, TERRACE, -0.98)
    put(pagoda(4, C.cream, C.timberDark), E - 0.5, TERRACE, -0.92)
    for (const x of [W + 0.62, W + 1.0, cx + 0.3, cx + 1.02, E - 1.25, E - 0.74, E - 0.2]) tree(x, TERRACE, -0.8 + (random() - 0.5) * 0.04, 0.04 + random() * 0.012)
    for (const [y, z] of [[0.2, -0.5], [0.17, -0.42]]) g.add(lanterns([SQUARE.x0 + 0.02, Y + y, z], [SQUARE.x1 - 0.02, Y + y, z], 12))
  }
  if (style === 'yokohama') {
    // The new waterfront to the west, the shrine behind its gate above the stairs, old streets and the big wheel.
    put(landmarkTower(0.38), W + 0.78, TERRACE, -1.0)
    put(waveTowers(), W + 1.1, TERRACE, -1.03)
    put(sailHotel(0.3), W + 1.4, TERRACE, -0.92)
    put(shrine(), cx - 0.02, TERRACE, -1.0)
    put(torii(0.17), cx + 0.04, TERRACE, -0.775)
    for (const side of [-0.13, 0.21]) put(stoneLantern(), cx + side, TERRACE, -0.78)
    put(pagoda(4, C.signalRed, C.slate), cx + 0.38, TERRACE, -0.98)
    for (let x = cx + 0.62; x < E - 0.85;) {
      const w = 0.17 + random() * 0.06
      put(machiya(w, 0.1 + random() * 0.04, random() < 0.2), x + w / 2, TERRACE, -1.0)
      x += w + 0.05
    }
    const { stand, wheel, hub } = bigWheel(0.165)
    put(stand, E - 0.42, TERRACE, -0.88)
    wheel.position.set(E - 0.42, TERRACE + hub, -0.88)
    spinners.push({ object: wheel, speed: 0.22 })
    loose.push(wheel)
    for (const x of [W + 0.6, W + 0.96, W + 1.24, cx - 0.3, cx + 0.56, cx + 0.9, cx + 1.24, E - 0.86]) {
      put(sakura(0.045 + random() * 0.012, random), x, TERRACE, -0.79 + (random() - 0.5) * 0.03)
    }
    put(carpPole(), cx + 0.24, Y, -0.62)
  }
  if (style === 'rotterdam') {
    // Along the dike: the cube houses, the mast, the great church, a row of gables, and two mills among the bulb fields.
    put(cubeHouses(3), W + 0.84, TERRACE, -0.95)
    put(euromast(0.4), W + 1.24, TERRACE, -1.02)
    put(greatChurch(), cx - 0.02, TERRACE, -0.98)
    for (let x = cx + 0.4; x < E - 1.35;) {
      const w = 0.12 + random() * 0.03
      put(canalHouse(w, 0.13 + random() * 0.05, pick(look.houses), Math.floor(random() * 3)), x + w / 2, TERRACE, -1.02)
      x += w + 0.006
    }
    windmill(E - 0.98, 0.25, -0.5)
    windmill(E - 0.42, 0.28, -0.42)
    for (const x of [W + 0.6, E - 0.7]) {
      const { mast, rotor, hub } = turbine(0.24)
      put(mast, x, TERRACE, -1.13)
      rotor.position.set(x, TERRACE + hub, -1.094)
      spinners.push({ object: rotor, speed: 1.3 })
      loose.push(rotor)
    }
    for (const [from, to] of [[W + 0.62, cx - 0.2], [cx + 0.28, E - 1.24]]) put(tulips(to - from, 0.08), (from + to) / 2, TERRACE, -0.775)
  }
  if (style === 'losangeles') {
    // The hills behind the town with the sign on them, the observatory above the stairs, and the round tower.
    for (const [x, w, h, tone] of [[E - 1.1, 0.8, 0.2, C.stone], [E - 0.35, 0.5, 0.15, C.moss], [W + 0.9, 0.5, 0.1, C.cobble]] as const) {
      const hill = ball(1, tone, x, TERRACE - 0.02, -1.1)
      hill.scale.set(w, h, 0.3)
      g.add(hill)
    }
    put(hillSign('HOLLYWOOD', 0.011), E - 1.1, TERRACE + 0.115, -0.9)
    put(observatory(), cx - 0.02, TERRACE, -0.98)
    put(recordTower(0.28), W + 1.3, TERRACE, -0.98)
    villa(W + 0.84, -0.98, TERRACE, 0.2, 0.12, 0.17)
    villa(cx + 0.46, -0.94, TERRACE, 0.18, 0.11, 0.17)
    put(derrick(0.26), E - 0.36, TERRACE, -0.86)
    for (const x of [W + 0.62, W + 1.08, cx - 0.32, cx + 0.3, cx + 0.72, E - 1.0, E - 0.66, E - 0.14]) {
      put(fanPalm(0.2 + random() * 0.08, random), x, TERRACE, -0.79 + (random() - 0.5) * 0.04)
    }
  }

  // Promenade: lamps, benches, trees, a café under parasols, people out walking, cars parked by the kerb.
  for (let x = W + 0.75; x < E - 0.5; x += 0.72) lampPost(x, -0.175)
  for (let x = W + 1.1; x < E - 0.6; x += 0.9 + random() * 0.3) {
    g.add(chip(0.06, 0.006, 0.02, C.timber, x, Y + 0.02, -0.05), chip(0.06, 0.02, 0.005, C.timber, x, Y + 0.03, -0.062))
    for (const dx of [-0.024, 0.024]) g.add(chip(0.006, 0.02, 0.018, C.iron, x + dx, Y + 0.01, -0.05))
    tree(x + 0.3, Y, -0.1, 0.04)
  }
  for (let k = 0; k < 3; k++) {
    const x = W + 0.95 + k * 0.11
    parasol(x, Y + 0.003, -0.455, k % 2 ? C.cream : C.signalRed)
  }
  for (let k = 0; k < 3; k++) parasol(SQUARE.x1 + 0.5 + k * 0.11, Y + 0.003, -0.455, k % 2 ? C.amber : C.teal)
  for (let i = 0; i < 9; i++) person(W + 0.7 + random() * (E - W - 1.3), Y + 0.003, -0.03 - random() * 0.13)
  for (let x = W + 1.5; x < E - 0.4; x += 0.5 + random() * 0.5) {
    if (x > SQUARE.x0 - 0.1 && x < SQUARE.x1 + 0.1) continue
    car(x, -0.445, pick([C.teal, C.cream, C.berry, C.amber, C.paleBlue, C.faluRed]))
  }

  if (style === 'shanghai') for (let x = W + 0.75; x < E - 1.25; x += 0.72) g.add(lanterns([x, Y + 0.15, -0.175], [x + 0.72, Y + 0.15, -0.175], 9))
  if (style === 'yokohama') for (let x = W + 1.3; x < E - 0.6; x += 1.1) put(stoneLantern(), x, Y, -0.21)
  if (style === 'rotterdam') {
    for (let x = W + 0.9; x < E - 0.6; x += 0.19 + random() * 0.5) {
      put(bicycle(pick([C.signalRed, C.tealDeep, C.ochre, C.iron, C.signalBlue])), x, Y + 0.003, -0.2, (random() - 0.5) * 0.5)
    }
  }

  // The jetty: planks on piles, with the town's boats alongside.
  const jetty = cx - 0.55
  g.add(rbox(0.1, 0.012, 0.44, C.timber, jetty, 0.07, 0.2, 0.004), rbox(0.36, 0.012, 0.09, C.timber, jetty, 0.07, 0.4, 0.004))
  for (let i = 0; i < 3; i++) g.add(chip(0.1, 0.012, 0.03, C.timber, jetty, 0.082 + i * 0.016, 0.03 - i * 0.022))
  for (const [x, z] of [[-0.04, 0.1], [0.04, 0.1], [-0.04, 0.26], [0.04, 0.26], [-0.16, 0.4], [0.16, 0.4], [-0.04, 0.42], [0.04, 0.42]]) {
    g.add(cyl(0.01, 0.01, 0.36, C.timberDark, jetty + x, -0.1, z, 8))
  }
  g.add(cyl(0.006, 0.008, 0.1, C.white, jetty + 0.16, 0.126, 0.42, 8), bulb(0.01, C.lampGreen, jetty + 0.16, 0.184, 0.42, 2))
  const boat = (x: number, z: number, turn: number, build: (b: THREE.Group) => void): void => {
    const inner = new THREE.Group()
    build(inner)
    inner.rotation.y = turn
    const object = new THREE.Group()
    object.add(fuse(inner))
    floaters.push({ object, x, z, span: 0.08 })
  }
  const fishing = (color: string) => (b: THREE.Group): void => {
    b.add(hull(0.3, 0.11, 0.04, 0.03, color, C.antifoul))
    b.add(
      rbox(0.07, 0.05, 0.07, C.white, -0.06, 0.075, 0, 0.012),
      pane(0.074, 0.018, 0.074, -0.06, 0.084, 0, true),
      chip(0.084, 0.008, 0.084, color, -0.06, 0.104, 0),
      cyl(0.004, 0.005, 0.14, C.timber, 0.03, 0.12, 0, 6),
      bar([0.03, 0.15, 0], [0.12, 0.09, 0], 0.003, C.timber, 5),
      chip(0.05, 0.02, 0.05, C.orange, 0.07, 0.06, 0),
      ball(0.012, C.signalRed, 0.125, 0.06, 0.03),
    )
  }
  const sailing = (b: THREE.Group): void => {
    b.add(hull(0.3, 0.09, 0.035, 0.03, C.white, C.navy))
    b.add(
      rbox(0.1, 0.02, 0.05, C.cream, -0.02, 0.055, 0, 0.008),
      cyl(0.004, 0.005, 0.3, C.timber, 0.03, 0.2, 0, 6),
      bar([0.03, 0.09, 0], [-0.13, 0.085, 0], 0.004, C.timber, 5),
      bar([0.02, 0.09, 0], [-0.12, 0.085, 0], 0.011, C.white, 8),
      chip(0.02, 0.014, 0.003, C.signalRed, 0.042, 0.34, 0),
    )
  }
  const rowing = (color: string) => (b: THREE.Group): void => {
    b.add(hull(0.16, 0.07, 0.022, 0.016, color, C.timberDark))
    b.add(chip(0.012, 0.006, 0.06, C.timber, -0.02, 0.03, 0), chip(0.012, 0.006, 0.055, C.timber, 0.03, 0.03, 0))
  }
  // Each harbour has its own craft among them: junks, a sailing barge, a pleasure boat, the old liner.
  const craft = (make: () => THREE.Group) => (b: THREE.Group): void => void b.add(make())
  const tall = style === 'shanghai' ? craft(() => junk(C.maroon)) : style === 'rotterdam' ? craft(barge) : sailing
  const small = style === 'shanghai' ? craft(() => junk(C.faluRed)) : style === 'yokohama' ? craft(pleasureBoat) : fishing(C.navy)
  boat(jetty - 0.13, 0.17, Math.PI / 2, fishing(look.houses[0]))
  boat(jetty + 0.13, 0.2, -Math.PI / 2, tall)
  boat(jetty + 0.32, 0.3, 0.2, rowing(C.paleBlue))
  boat(jetty - 0.42, 0.1, 0.05, fishing(C.tealDeep))
  if (style === 'losangeles') {
    boat(cx + 0.98, 0.2, 0, craft(liner))
    floaters[floaters.length - 1].span = 0.5
  } else {
    boat(cx + 0.5, 0.09, 0, rowing(C.ochre))
    boat(cx + 1.25, 0.12, 0.08, small)
    boat(cx + 1.75, 0.1, -0.05, tall)
  }

  // The mole at the harbour mouth, and the lighthouse on it.
  const rock = new THREE.DodecahedronGeometry(1, 1)
  const moleX = E - 0.42
  for (let i = 0; i < 26; i++) {
    const s = 0.05 + random() * 0.06
    const stone = new THREE.Mesh(rock, mat(i % 3 ? C.stone : C.steel, 0.95))
    const z = 0.03 + random() * 0.4
    stone.position.set(moleX + (random() - 0.5) * 0.5, SEABED + 0.02 + random() * (0.22 + (z < 0.34 ? 0.1 : 0)), z)
    stone.scale.set(s, s * 0.7, s)
    stone.rotation.set(random() * 6, random() * 6, 0)
    stone.castShadow = true
    stone.receiveShadow = true
    g.add(stone)
  }
  const light = new THREE.Group()
  light.add(cyl(0.1, 0.12, 0.14, C.concrete, 0, -0.03, 0))
  look.bands.forEach((c, i) => {
    const r0 = 0.07 - i * 0.008
    light.add(cyl(r0 - 0.008, r0, 0.09, c, 0, 0.085 + i * 0.09, 0, 28))
  })
  light.add(
    cyl(0.062, 0.062, 0.012, C.iron, 0, 0.406, 0, 28),
    new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.06, 20), glow(C.lampWarm, 0.9)).translateY(0.44),
    cone(0.046, 0.05, look.cap, 0, 0.495, 0, 20),
    chip(0.022, 0.04, 0.008, look.door, 0, 0.06, 0.068),
  )
  light.position.set(moleX, 0.1, 0.2)
  g.add(light)
  const lamp = new THREE.Group()
  lamp.add(bulb(0.016, C.lampWhite, 0.036, 0, 0, 3))
  lamp.position.set(moleX, 0.54, 0.2)

  const group = fuse(g)
  group.add(...loose, lamp, ...floaters.map((f) => f.object))
  return { group, floaters, lamp, spinners }
}
