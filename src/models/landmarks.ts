import * as THREE from 'three/webgpu'
import { ball, bar, bulb, chip, cone, cyl, fuse, hull, pane, prism, rand, rbox, torus } from '../kit'
import { C } from '../style'

// What the famous harbours are known by. Every builder returns a model standing on the ground at its own
// origin and facing the water; `models/town.ts` and `harbor.ts` place them.

const home = rand(97)
// A window: most have someone in after dark, some come on late and a few stay dark.
function win(w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh {
  const who = home()
  return who < 0.25 ? chip(w, h, d, C.glass, x, y, z) : pane(w, h, d, x, y, z, who > 0.66)
}
// Rows of windows across the front of a block.
function rows(g: THREE.Group, width: number, y0: number, y1: number, z: number, cols: number, floors: number, w = 0.018, h = 0.024, x = 0): void {
  for (let f = 0; f < floors; f++) {
    const y = floors === 1 ? (y0 + y1) / 2 : y0 + ((y1 - y0) * f) / (floors - 1)
    for (let i = 0; i < cols; i++) g.add(win(w, h, 0.008, x + ((i + 0.5) / cols - 0.5) * width * 0.86, y, z))
  }
}
// A four-sided roof standing on its base.
function pyramid(side: number, h: number, color: string, x: number, y: number, z: number): THREE.Mesh {
  const roof = cone(side * 0.74, h, color, x, y + h / 2, z, 4)
  roof.rotation.y = Math.PI / 4
  return roof
}
// A roof with its eaves turned out, as on a temple or a pagoda.
function eaves(side: number, h: number, color: string, x: number, y: number, z: number): THREE.Mesh[] {
  const skirt = cyl(side * 0.52, side * 0.86, h * 0.45, color, x, y + h * 0.22, z, 4)
  const crown = cyl(side * 0.2, side * 0.52, h * 0.55, color, x, y + h * 0.72, z, 4)
  skirt.rotation.y = crown.rotation.y = Math.PI / 4
  return [skirt, crown]
}
const dial = (r: number, x: number, y: number, z: number): THREE.Mesh[] => {
  const face = cyl(r, r, 0.008, C.white, x, y, z, 20)
  face.rotation.x = Math.PI / 2
  return [face, chip(0.004, r * 0.75, 0.004, C.iron, x, y + r * 0.3, z + 0.005), chip(r * 0.6, 0.004, 0.004, C.iron, x + r * 0.22, y, z + 0.005)]
}

// ---------------------------------------------------------------------------------------------- Shanghai

// A stone bank or trading house of the Bund: pilasters, a heavy cornice, and something on the roof.
export function bundBlock(w: number, h: number, stone: string, top: number): THREE.Group {
  const g = new THREE.Group()
  const d = 0.2
  g.add(
    rbox(w, h, d, stone, 0, h / 2, 0, 0.01), rbox(w + 0.012, 0.03, d + 0.012, C.rock, 0, 0.015, 0, 0.006),
    rbox(w + 0.02, 0.016, d + 0.02, C.cream, 0, h - 0.012, 0, 0.005), rbox(w - 0.02, 0.02, d - 0.02, stone, 0, h + 0.008, 0, 0.005),
  )
  const bays = Math.max(2, Math.round(w / 0.055))
  for (let i = 0; i <= bays; i++) g.add(chip(0.012, h - 0.06, 0.012, C.cream, (i / bays - 0.5) * (w - 0.016), h / 2 + 0.006, d / 2))
  rows(g, w, 0.075, h - 0.05, d / 2, bays, Math.max(1, Math.round((h - 0.08) / 0.055)), 0.02, 0.028)
  g.add(chip(0.034, 0.05, 0.01, C.timberDark, 0, 0.026, d / 2 + 0.002))
  if (top === 1) g.add(pyramid(w * 0.55, 0.07, C.copper, 0, h + 0.018, 0))
  if (top === 2) {
    g.add(cyl(w * 0.2, w * 0.2, 0.03, stone, 0, h + 0.03, 0, 14), ball(w * 0.2, C.copper, 0, h + 0.046, 0), cyl(0.003, 0.003, 0.05, C.ochre, 0, h + 0.046 + w * 0.2 + 0.02, 0, 6))
  }
  if (top === 3) for (const x of [-w * 0.3, w * 0.3]) g.add(rbox(0.04, 0.05, 0.04, stone, x, h + 0.04, d * 0.2, 0.006), pyramid(0.046, 0.03, C.copper, x, h + 0.065, d * 0.2))
  return g
}

// The Customs House: a long stone front with a portico and the clock tower that the waterfront keeps time by.
export function customsHouse(): THREE.Group {
  const g = new THREE.Group()
  g.add(
    rbox(0.3, 0.17, 0.22, C.cream, 0, 0.085, 0, 0.01), rbox(0.32, 0.03, 0.24, C.rock, 0, 0.015, 0, 0.006),
    rbox(0.32, 0.016, 0.24, C.stone, 0, 0.176, 0, 0.005),
    rbox(0.1, 0.2, 0.1, C.cream, 0, 0.28, 0.05, 0.008), rbox(0.115, 0.014, 0.115, C.stone, 0, 0.3, 0.05, 0.004),
    rbox(0.08, 0.06, 0.08, C.cream, 0, 0.41, 0.05, 0.008), rbox(0.056, 0.05, 0.056, C.stone, 0, 0.462, 0.05, 0.008),
    pyramid(0.06, 0.04, C.copper, 0, 0.487, 0.05), cyl(0.003, 0.003, 0.07, C.white, 0, 0.56, 0.05, 6),
    chip(0.036, 0.022, 0.003, C.signalRed, 0.02, 0.58, 0.05),
  )
  for (const turn of [0, Math.PI / 2, -Math.PI / 2]) {
    const face = new THREE.Group()
    face.add(...dial(0.03, 0, 0, 0.051))
    face.position.set(0, 0.345, 0.05)
    face.rotation.y = turn
    g.add(face)
  }
  for (let i = 0; i < 6; i++) g.add(cyl(0.008, 0.009, 0.12, C.white, -0.1 + i * 0.04, 0.09, 0.118, 8))
  g.add(rbox(0.25, 0.02, 0.03, C.stone, 0, 0.158, 0.118, 0.005), rbox(0.25, 0.014, 0.04, C.rock, 0, 0.024, 0.122, 0.004))
  rows(g, 0.3, 0.07, 0.13, 0.111, 5, 2, 0.02, 0.03)
  return g
}

// The Oriental Pearl: eleven spheres on three columns, on three splayed legs.
export function pearlTower(): THREE.Group {
  const g = new THREE.Group()
  for (let k = 0; k < 3; k++) {
    const turn = (k / 3) * Math.PI * 2 + Math.PI / 6
    const x = Math.cos(turn)
    const z = Math.sin(turn)
    g.add(
      bar([x * 0.12, 0, z * 0.12], [x * 0.03, 0.17, z * 0.03], 0.012, C.concrete),
      cyl(0.011, 0.012, 0.3, C.concrete, x * 0.026, 0.3, z * 0.026, 10),
      ball(0.016, C.berry, x * 0.026, 0.27, z * 0.026), ball(0.014, C.berry, x * 0.026, 0.33, z * 0.026),
    )
  }
  const low = ball(0.078, C.berry, 0, 0.19, 0)
  const high = ball(0.056, C.berry, 0, 0.43, 0)
  g.add(
    cyl(0.1, 0.11, 0.016, C.concrete, 0, 0.008, 0, 20), cyl(0.05, 0.05, 0.02, C.glass, 0, 0.026, 0, 16),
    low, cyl(0.079, 0.079, 0.012, C.pink, 0, 0.19, 0, 24), high, cyl(0.057, 0.057, 0.01, C.pink, 0, 0.43, 0, 24),
    cyl(0.014, 0.02, 0.08, C.concrete, 0, 0.51, 0, 10), ball(0.022, C.berry, 0, 0.545, 0),
    cyl(0.004, 0.008, 0.1, C.white, 0, 0.61, 0, 8), bulb(0.007, C.lampRed, 0, 0.664, 0, 2),
  )
  return g
}

// The towers of Pudong. 0 the twisting one, 1 the one with a square hole at its top, 2 the tiered pagoda in
// steel, and plain glass slabs after that.
export function skyscraper(kind: number, h: number): THREE.Group {
  const g = new THREE.Group()
  const bands = (w: number, y0: number, y1: number, z: number, tone: string = C.glass) => {
    for (let y = y0; y < y1; y += 0.034) g.add(chip(w * 0.84, 0.012, 0.006, tone, 0, y, z))
  }
  if (kind === 0) {
    const steps = 14
    for (let k = 0; k < steps; k++) {
      const s = 0.1 - k * 0.0034
      const part = rbox(s, h / steps + 0.006, s, k % 2 ? C.paleBlue : C.mackerel, 0, (k + 0.5) * (h / steps), 0, 0.02)
      part.rotation.y = k * 0.11
      g.add(part)
    }
    const tip = prism([[-0.022, 0], [-0.016, 0.05], [0.02, 0.03], [0.022, 0]], 0.04, C.mackerel, 0.004)
    tip.position.y = h
    g.add(tip)
  } else if (kind === 1) {
    const body = prism([[-0.055, 0], [-0.03, h * 0.86], [0.03, h * 0.86], [0.055, 0]], 0.07, C.herring, 0.006)
    g.add(body, rbox(0.014, h * 0.12, 0.06, C.herring, -0.024, h * 0.91, 0, 0.004), rbox(0.014, h * 0.12, 0.06, C.herring, 0.024, h * 0.91, 0, 0.004), rbox(0.062, 0.016, 0.06, C.herring, 0, h * 0.975, 0, 0.004))
    bands(0.08, 0.03, h * 0.8, 0.036, C.mackerel)
  } else if (kind === 2) {
    let y = 0
    for (let k = 0; k < 6; k++) {
      const s = 0.09 - k * 0.011
      const part = h * (0.26 - k * 0.03)
      g.add(rbox(s, part, s, C.steel, 0, y + part / 2, 0, 0.006), rbox(s + 0.012, 0.008, s + 0.012, C.slate, 0, y + part, 0, 0.003))
      for (let wy = y + 0.02; wy < y + part - 0.012; wy += 0.03) g.add(chip(s * 0.8, 0.01, 0.006, C.glass, 0, wy, s / 2))
      y += part
    }
    g.add(cyl(0.003, 0.006, 0.07, C.steel, 0, y + 0.035, 0, 6))
  } else {
    const w = 0.07 + (kind % 3) * 0.012
    const tone = [C.mackerel, C.steel, C.herring, C.slate][kind % 4]
    g.add(rbox(w, h, w * 0.8, tone, 0, h / 2, 0, 0.008), rbox(w * 0.6, 0.02, w * 0.5, C.slate, 0, h + 0.01, 0, 0.004))
    bands(w, 0.03, h - 0.02, w * 0.4)
    rows(g, w, h * 0.3, h * 0.8, w * 0.4 + 0.001, 2, 3, 0.014, 0.012)
    if (kind % 2) g.add(cyl(0.002, 0.004, 0.06, C.white, 0, h + 0.05, 0, 6), bulb(0.006, C.lampRed, 0, h + 0.082, 0, 2))
  }
  return g
}

// A pagoda: one storey on another, each under a roof with its eaves turned out.
export function pagoda(storeys: number, wall: string, roof: string): THREE.Group {
  const g = new THREE.Group()
  let y = 0
  g.add(rbox(0.16, 0.02, 0.16, C.stone, 0, 0.01, 0, 0.005))
  y = 0.02
  for (let k = 0; k < storeys; k++) {
    const s = 0.1 - k * 0.012
    g.add(rbox(s, 0.05, s, wall, 0, y + 0.025, 0, 0.006), chip(s * 0.3, 0.03, 0.006, C.timberDark, 0, y + 0.018, s / 2), ...eaves(s * 1.05, 0.034, roof, 0, y + 0.046, 0))
    y += 0.072
  }
  g.add(cyl(0.004, 0.007, 0.07, C.ochre, 0, y + 0.03, 0, 8), ball(0.009, C.ochre, 0, y + 0.012, 0), ball(0.006, C.ochre, 0, y + 0.07, 0))
  return g
}

// A ceremonial gateway: four red columns under three tiled roofs.
export function pailou(): THREE.Group {
  const g = new THREE.Group()
  for (const x of [-0.13, -0.05, 0.05, 0.13]) g.add(cyl(0.008, 0.009, Math.abs(x) < 0.1 ? 0.19 : 0.15, C.signalRed, x, Math.abs(x) < 0.1 ? 0.095 : 0.075, 0, 10), chip(0.026, 0.016, 0.03, C.stone, x, 0.008, 0))
  const roofAt = (x: number, y: number, w: number) => {
    const roof = prism([[-w / 2 - 0.016, 0.006], [-w / 2, 0], [w / 2, 0], [w / 2 + 0.016, 0.006], [w * 0.3, 0.022], [-w * 0.3, 0.022]], 0.05, C.tealDeep, 0.003)
    roof.position.set(x, y, 0)
    g.add(roof, rbox(w, 0.022, 0.014, C.signalBlue, x, y - 0.014, 0, 0.003))
  }
  roofAt(0, 0.19, 0.12)
  roofAt(-0.09, 0.15, 0.08)
  roofAt(0.09, 0.15, 0.08)
  g.add(chip(0.05, 0.02, 0.016, C.ochre, 0, 0.158, 0))
  return g
}

// A string of red lanterns between two points.
export function lanterns(from: [number, number, number], to: [number, number, number], count: number): THREE.Group {
  const g = new THREE.Group()
  g.add(bar(from, to, 0.0012, C.iron, 4))
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count
    const sag = Math.sin(t * Math.PI) * 0.012
    const at = [0, 1, 2].map((k) => from[k] + (to[k] - from[k]) * t)
    g.add(bulb(0.0085, C.lampRed, at[0], at[1] - sag - 0.008, at[2], 1.1), chip(0.006, 0.003, 0.006, C.ochre, at[0], at[1] - sag, at[2]))
  }
  return g
}

// A junk: a high stern and battened sails.
export function junk(sail: string): THREE.Group {
  const g = new THREE.Group()
  g.add(hull(0.34, 0.11, 0.04, 0.03, C.timber, C.timberDark))
  g.add(rbox(0.09, 0.04, 0.09, C.timberDark, -0.12, 0.06, 0, 0.008), chip(0.1, 0.006, 0.1, C.timber, -0.12, 0.083, 0), chip(0.016, 0.02, 0.06, C.signalRed, 0.14, 0.05, 0))
  for (const [x, h, w] of [[0.05, 0.3, 0.13], [-0.07, 0.22, 0.1]] as const) {
    g.add(cyl(0.004, 0.005, h, C.timberDark, x, 0.04 + h / 2, 0, 6), rbox(w, h * 0.72, 0.006, sail, x - 0.012, 0.07 + h * 0.5, 0.004, 0.003))
    for (let k = 0; k < 5; k++) g.add(chip(w + 0.008, 0.004, 0.009, C.timberDark, x - 0.012, 0.09 + (k / 4) * h * 0.62, 0.004))
  }
  return g
}

// --------------------------------------------------------------------------------------------- Yokohama

// A merchant's town house: plaster over a timber lattice, under a tiled roof with deep eaves.
export function machiya(w: number, h: number, brick = false): THREE.Group {
  const g = new THREE.Group()
  const d = 0.17
  const wall = brick ? C.brick : C.white
  const roof = prism([[-d / 2 - 0.03, 0], [-d * 0.08, d * 0.34], [d * 0.08, d * 0.34], [d / 2 + 0.03, 0]], w + 0.03, C.slate, 0.006)
  roof.rotation.y = Math.PI / 2
  roof.position.y = h
  g.add(rbox(w, h, d, wall, 0, h / 2, 0, 0.01), roof, chip(w + 0.036, 0.008, 0.016, C.iron, 0, h + d * 0.34, 0))
  if (h > 0.12) {
    const lean = prism([[0, 0], [0.05, -0.018], [0.05, -0.026], [0, -0.008]], w + 0.01, C.slate, 0.002)
    lean.rotation.y = -Math.PI / 2
    lean.position.set(0, 0.082, d / 2)
    g.add(lean)
    rows(g, w, h - 0.03, h - 0.03, d / 2, w > 0.19 ? 3 : 2, 1, 0.026, 0.022)
  }
  g.add(rbox(w - 0.016, 0.06, 0.008, C.timberDark, 0, 0.034, d / 2 + 0.001, 0.003))
  for (let x = -w / 2 + 0.02; x < w / 2 - 0.012; x += 0.014) g.add(chip(0.004, 0.056, 0.004, C.timber, x, 0.034, d / 2 + 0.006))
  g.add(chip(0.05, 0.022, 0.004, brick ? C.cream : C.navy, w * 0.18, 0.058, d / 2 + 0.01), bulb(0.008, C.lampWarm, -w * 0.32, 0.066, d / 2 + 0.014, 1.2))
  return g
}

// The Port Opening Memorial Hall: red brick banded with white stone, and a clock tower on its corner.
export function jackTower(): THREE.Group {
  const g = new THREE.Group()
  g.add(rbox(0.28, 0.15, 0.2, C.faluRed, 0, 0.075, 0, 0.01), rbox(0.3, 0.014, 0.22, C.slate, 0, 0.157, 0, 0.005), rbox(0.085, 0.36, 0.085, C.faluRed, -0.1, 0.18, 0.06, 0.008))
  for (let y = 0.03; y < 0.35; y += 0.045) g.add(chip(0.09, 0.008, 0.09, C.cream, -0.1, y, 0.06))
  for (let y = 0.03; y < 0.14; y += 0.045) g.add(chip(0.19, 0.008, 0.012, C.cream, 0.045, y, 0.1))
  g.add(...dial(0.026, -0.1, 0.3, 0.104), rbox(0.1, 0.014, 0.1, C.cream, -0.1, 0.365, 0.06, 0.004))
  const dome = ball(0.046, C.copper, -0.1, 0.372, 0.06)
  dome.scale.y = 1.25
  g.add(dome, cyl(0.003, 0.004, 0.06, C.ochre, -0.1, 0.45, 0.06, 6), chip(0.04, 0.07, 0.01, C.timberDark, 0.05, 0.035, 0.101))
  rows(g, 0.2, 0.075, 0.12, 0.101, 3, 2, 0.022, 0.03)
  return g
}

export function torii(w: number): THREE.Group {
  const g = new THREE.Group()
  const h = w * 0.95
  for (const x of [-w * 0.36, w * 0.36]) g.add(cyl(w * 0.04, w * 0.05, h, C.signalRed, x, h / 2, 0, 12), cyl(w * 0.06, w * 0.065, w * 0.05, C.iron, x, w * 0.025, 0, 12))
  const lintel = prism([[-w * 0.62, w * 0.03], [-w * 0.56, -w * 0.035], [w * 0.56, -w * 0.035], [w * 0.62, w * 0.03], [w * 0.6, w * 0.06], [-w * 0.6, w * 0.06]], w * 0.09, C.signalRed, 0.003)
  lintel.position.y = h + w * 0.02
  g.add(lintel, rbox(w * 1.22, w * 0.03, w * 0.11, C.rubber, 0, h + w * 0.09, 0, 0.003), rbox(w * 0.92, w * 0.06, w * 0.06, C.signalRed, 0, h * 0.74, 0, 0.003), chip(w * 0.1, w * 0.16, w * 0.04, C.ochre, 0, h * 0.86, 0))
  return g
}

// A shrine hall: a small timber room under a great sweep of roof.
export function shrine(wall: string = C.signalRed, tiles: string = C.copper): THREE.Group {
  const g = new THREE.Group()
  g.add(rbox(0.24, 0.03, 0.18, C.stone, 0, 0.015, 0, 0.005), rbox(0.17, 0.07, 0.12, wall, 0, 0.065, 0, 0.008), rbox(0.172, 0.022, 0.122, C.white, 0, 0.09, 0, 0.004))
  const roof = prism([[-0.15, 0.012], [-0.13, 0], [0.13, 0], [0.15, 0.012], [0.04, 0.085], [-0.04, 0.085]], 0.2, tiles, 0.006)
  roof.position.y = 0.1
  g.add(roof, rbox(0.12, 0.012, 0.21, C.ochre, 0, 0.19, 0, 0.004), chip(0.05, 0.045, 0.008, C.timberDark, 0, 0.055, 0.061))
  for (let i = 0; i < 3; i++) g.add(chip(0.11, 0.01, 0.024, C.stone, 0, 0.005 + i * 0.01, 0.1 + (2 - i) * 0.022))
  for (const x of [-0.07, 0.07]) g.add(cyl(0.006, 0.006, 0.08, C.signalRed, x, 0.07, 0.085, 8))
  return g
}

// A big wheel. The rim, spokes and gondolas turn; the legs and the clock at the hub stand still.
export function bigWheel(r: number): { stand: THREE.Group; wheel: THREE.Group; hub: number } {
  const hub = r + 0.035
  const stand = new THREE.Group()
  for (const z of [-0.03, 0.03]) {
    for (const x of [-r * 0.55, r * 0.55]) stand.add(bar([x, 0, z * 1.6], [0, hub, z], 0.007, C.white, 8))
  }
  const axle = cyl(0.016, 0.016, 0.085, C.iron, 0, hub, 0, 12)
  axle.rotation.x = Math.PI / 2
  stand.add(axle, rbox(r * 1.4, 0.02, 0.14, C.concrete, 0, 0.01, 0, 0.006), rbox(0.14, 0.05, 0.1, C.cream, 0, 0.045, 0.02, 0.008), chip(0.05, 0.024, 0.006, C.iron, 0, hub, 0.046), chip(0.036, 0.012, 0.004, C.lampAmber, 0, hub, 0.05))
  const turning = new THREE.Group()
  for (const z of [-0.02, 0.02]) turning.add(torus(r, 0.005, C.white, 0, 0, z), torus(r * 0.55, 0.003, C.white, 0, 0, z))
  const colors = [C.signalRed, C.signalYellow, C.signalBlue, C.green, C.orange, C.violet]
  const cars = 12
  for (let k = 0; k < cars; k++) {
    const turn = (k / cars) * Math.PI * 2
    const x = Math.cos(turn) * r
    const y = Math.sin(turn) * r
    turning.add(bar([0, 0, 0], [x, y, 0], 0.0028, C.white, 5), ball(0.016, colors[k % colors.length], x, y, 0))
  }
  return { stand, wheel: fuse(turning), hub }
}

// The tall tower of the new waterfront: square, tapering in three steps, with buttressed corners.
export function landmarkTower(h: number): THREE.Group {
  const g = new THREE.Group()
  g.add(rbox(0.13, h * 0.5, 0.12, C.herring, 0, h * 0.25, 0, 0.01), rbox(0.115, h * 0.34, 0.105, C.herring, 0, h * 0.66, 0, 0.01), rbox(0.1, h * 0.18, 0.09, C.herring, 0, h * 0.91, 0, 0.01), rbox(0.07, 0.016, 0.06, C.slate, 0, h + 0.006, 0, 0.004))
  for (const x of [-0.062, 0.062]) g.add(prism([[-0.012, 0], [0.012, 0], [0.004, h * 0.86], [-0.004, h * 0.86]], 0.125, C.cream, 0.003).translateX(x))
  for (let y = 0.03; y < h - 0.02; y += 0.03) g.add(chip(0.085, 0.011, 0.006, C.glass, 0, y, y < h * 0.5 ? 0.06 : y < h * 0.82 ? 0.053 : 0.046))
  rows(g, 0.1, h * 0.2, h * 0.75, 0.064, 2, 4, 0.016, 0.011)
  g.add(bulb(0.006, C.lampRed, 0, h + 0.022, 0, 2))
  return g
}

// The hotel shaped like a sail filled with wind.
export function sailHotel(h: number): THREE.Group {
  const g = new THREE.Group()
  const body = prism([[-0.07, 0], [0.07, 0], [0.066, h * 0.4], [0.05, h * 0.7], [0.018, h * 0.92], [-0.03, h], [-0.07, h * 0.98]], 0.07, C.white, 0.008)
  g.add(body, rbox(0.18, 0.03, 0.1, C.cream, 0, 0.015, 0, 0.006))
  for (let y = 0.05; y < h * 0.9; y += 0.03) {
    const reach = y < h * 0.4 ? 0.058 : y < h * 0.7 ? 0.046 : 0.02
    g.add(chip(0.07 + reach - 0.012, 0.011, 0.006, C.glass, (reach - 0.07) / 2, y, 0.036))
  }
  return g
}

// Three office towers stepping down to the water, as a wave.
export function waveTowers(): THREE.Group {
  const g = new THREE.Group()
  ;[0.34, 0.27, 0.2].forEach((h, k) => {
    const x = -0.11 + k * 0.11
    g.add(rbox(0.09, h, 0.085, k % 2 ? C.cream : C.paleBlue, x, h / 2, 0, 0.01))
    const cap = prism([[-0.045, 0], [0.045, 0], [0.045, 0.012], [-0.045, 0.04]], 0.085, C.steel, 0.004)
    cap.position.set(x, h, 0)
    g.add(cap)
    for (let y = 0.03; y < h - 0.01; y += 0.03) g.add(chip(0.074, 0.011, 0.006, C.glass, x, y, 0.043))
    rows(g, 0.07, h * 0.3, h * 0.7, 0.047, 2, 2, 0.014, 0.011, x)
  })
  return g
}

// A flowering cherry.
export function sakura(r: number, random: () => number): THREE.Group {
  const g = new THREE.Group()
  const trunk = cyl(0.007, 0.011, r * 1.3, C.timberDark, 0, r * 0.65, 0, 8)
  trunk.rotation.z = (random() - 0.5) * 0.3
  g.add(trunk)
  for (let k = 0; k < 5; k++) {
    const turn = (k / 5) * Math.PI * 2 + random()
    g.add(ball(r * (0.55 + random() * 0.2), k % 2 ? C.pink : C.jellyBell, Math.cos(turn) * r * 0.5, r * (1.45 + random() * 0.3), Math.sin(turn) * r * 0.5))
  }
  g.add(ball(r * 0.62, C.pink, 0, r * 1.85, 0))
  return g
}

export function stoneLantern(): THREE.Group {
  const g = new THREE.Group()
  g.add(cyl(0.012, 0.016, 0.012, C.stone, 0, 0.006, 0, 8), cyl(0.006, 0.006, 0.04, C.stone, 0, 0.03, 0, 8), chip(0.022, 0.02, 0.022, C.rock, 0, 0.06, 0), pyramid(0.036, 0.018, C.stone, 0, 0.07, 0), bulb(0.006, C.lampWarm, 0, 0.06, 0.008, 1.2))
  return g
}

// Carp streamers on a pole.
export function carpPole(): THREE.Group {
  const g = new THREE.Group()
  g.add(cyl(0.004, 0.005, 0.3, C.white, 0, 0.15, 0, 6), ball(0.008, C.ochre, 0, 0.305, 0))
  ;[C.rubber, C.signalRed, C.signalBlue].forEach((color, k) => {
    const fish = prism([[0, -0.012], [0.07, -0.008], [0.09, -0.016], [0.09, 0.016], [0.07, 0.008], [0, 0.012]], 0.012, color, 0.003)
    fish.position.set(0.006, 0.27 - k * 0.045, 0)
    fish.rotation.z = -0.12
    g.add(fish, ball(0.004, C.white, 0.018, 0.272 - k * 0.045, 0.006))
  })
  return g
}

// One of the red brick bonded warehouses of the old port, kept by the city.
export function brickWarehouse(length: number): THREE.Group {
  const g = new THREE.Group()
  const d = 0.26
  const h = 0.17
  const roof = prism([[-d / 2 - 0.012, 0], [0, 0.07], [d / 2 + 0.012, 0]], length + 0.02, C.slate, 0.006)
  roof.rotation.y = Math.PI / 2
  roof.position.y = h
  g.add(rbox(length, h, d, C.faluRed, 0, h / 2, 0, 0.01), roof, rbox(length + 0.01, 0.012, d + 0.01, C.cream, 0, 0.085, 0, 0.004), rbox(length + 0.012, 0.022, d + 0.012, C.rock, 0, 0.011, 0, 0.004))
  const bays = Math.round(length / 0.09)
  for (let i = 0; i < bays; i++) {
    const x = ((i + 0.5) / bays - 0.5) * (length - 0.04)
    g.add(win(0.03, 0.04, 0.008, x, 0.05, d / 2), win(0.03, 0.04, 0.008, x, 0.128, d / 2), chip(0.036, 0.008, 0.01, C.cream, x, 0.153, d / 2), chip(0.036, 0.008, 0.01, C.cream, x, 0.075, d / 2))
    if (i % 4 === 1) g.add(rbox(0.016, h + 0.02, 0.02, C.brick, x + 0.045, h / 2, d / 2, 0.004))
  }
  g.add(rbox(length * 0.9, 0.006, 0.05, C.iron, 0, 0.094, d / 2 + 0.022, 0.002))
  for (let x = -length * 0.44; x <= length * 0.44; x += 0.11) g.add(chip(0.005, 0.03, 0.005, C.iron, x, 0.108, d / 2 + 0.044))
  g.add(rbox(length * 0.9, 0.005, 0.005, C.iron, 0, 0.124, d / 2 + 0.044, 0.002))
  for (const x of [-length * 0.3, length * 0.3]) g.add(cyl(0.012, 0.014, 0.05, C.brick, x, h + 0.07, 0, 8))
  return g
}

// The lattice lighthouse tower on the park by the water.
export function marineTower(h: number): THREE.Group {
  const g = new THREE.Group()
  for (let k = 0; k < 10; k++) {
    const turn = (k / 10) * Math.PI * 2
    g.add(bar([Math.cos(turn) * 0.045, 0, Math.sin(turn) * 0.045], [Math.cos(turn + 0.5) * 0.016, h * 0.8, Math.sin(turn + 0.5) * 0.016], 0.003, k % 2 ? C.white : C.signalRed, 5))
  }
  g.add(cyl(0.012, 0.014, h * 0.8, C.white, 0, h * 0.4, 0, 10), cyl(0.034, 0.03, 0.03, C.cream, 0, h * 0.8 + 0.015, 0, 14), cyl(0.036, 0.036, 0.008, C.signalRed, 0, h * 0.8 + 0.034, 0, 14), cyl(0.014, 0.018, 0.04, C.glass, 0, h * 0.8 + 0.058, 0, 10), cone(0.02, 0.03, C.signalRed, 0, h * 0.8 + 0.093, 0, 10), bulb(0.008, C.lampGreen, 0, h * 0.8 + 0.06, 0.018, 2))
  return g
}

// A roofed pleasure boat hung with lanterns.
export function pleasureBoat(): THREE.Group {
  const g = new THREE.Group()
  g.add(hull(0.36, 0.1, 0.03, 0.025, C.timberDark, C.rubber))
  g.add(rbox(0.22, 0.04, 0.075, C.white, -0.02, 0.05, 0, 0.006), rbox(0.25, 0.01, 0.095, C.slate, -0.02, 0.076, 0, 0.004))
  for (let i = 0; i < 5; i++) g.add(win(0.024, 0.02, 0.078, -0.1 + i * 0.04, 0.052, 0), bulb(0.006, C.lampRed, -0.1 + i * 0.04, 0.066, 0.05, 1.2))
  return g
}

// -------------------------------------------------------------------------------------------- Rotterdam

// A canal house: narrow, tall, brick, with its gable to the street. 0 stepped, 1 bell, 2 neck.
export function canalHouse(w: number, h: number, wall: string, gable: number): THREE.Group {
  const g = new THREE.Group()
  const d = 0.2
  const roof = prism([[-w / 2, 0], [0, w * 0.62], [w / 2, 0]], d - 0.02, C.roofTile, 0.006)
  roof.position.set(0, h, -0.012)
  g.add(rbox(w, h, d, wall, 0, h / 2, 0, 0.008), roof)
  const z = d / 2 - 0.004
  if (gable === 0) {
    for (let k = 0; k < 4; k++) g.add(rbox(w * (1 - k * 0.24), w * 0.17, 0.02, wall, 0, h + w * 0.085 + k * w * 0.16, z, 0.003), chip(w * (1 - k * 0.24) + 0.006, 0.006, 0.024, C.white, 0, h + w * 0.17 + k * w * 0.16, z))
  } else if (gable === 1) {
    const bell = prism([[-w / 2, 0], [-w * 0.42, w * 0.22], [-w * 0.2, w * 0.34], [-w * 0.16, w * 0.62], [0, w * 0.72], [w * 0.16, w * 0.62], [w * 0.2, w * 0.34], [w * 0.42, w * 0.22], [w / 2, 0]], 0.02, wall, 0.003)
    bell.position.set(0, h, z)
    g.add(bell, chip(w * 0.36, 0.008, 0.026, C.white, 0, h + w * 0.72, z))
  } else {
    g.add(rbox(w * 0.46, w * 0.62, 0.02, wall, 0, h + w * 0.31, z, 0.003), chip(w * 0.56, 0.01, 0.026, C.white, 0, h + w * 0.63, z))
    for (const side of [-1, 1]) {
      const scroll = prism([[0, 0], [w * 0.27, 0], [0, w * 0.4]], 0.02, C.white, 0.003)
      scroll.position.set(side * w * 0.23, h, z)
      scroll.scale.x = side
      g.add(scroll)
    }
  }
  g.add(chip(0.008, 0.008, 0.05, C.timberDark, 0, h + w * 0.5, d / 2 + 0.02), chip(0.018, 0.022, 0.006, C.timberDark, 0, h + w * 0.3, d / 2 + 0.008))
  const floors = Math.max(2, Math.round((h - 0.05) / 0.062))
  const cols = w > 0.13 ? 3 : 2
  for (let f = 0; f < floors; f++) {
    const y = 0.085 + f * ((h - 0.1) / Math.max(1, floors - 1))
    for (let i = 0; i < cols; i++) {
      const x = ((i + 0.5) / cols - 0.5) * w * 0.82
      g.add(chip(0.03, 0.044, 0.006, C.white, x, y, d / 2), win(0.02, 0.034, 0.009, x, y, d / 2))
    }
  }
  g.add(chip(0.03, 0.052, 0.008, C.tealDeep, -w * 0.18, 0.03, d / 2 + 0.001), chip(0.044, 0.008, 0.02, C.stone, -w * 0.18, 0.004, d / 2 + 0.01))
  return g
}

// The great church: a long nave and a heavy square tower that never got its spire.
export function greatChurch(): THREE.Group {
  const g = new THREE.Group()
  const nave = prism([[-0.085, 0], [0, 0.08], [0.085, 0]], 0.3, C.slate, 0.008)
  nave.rotation.y = Math.PI / 2
  nave.position.set(0.1, 0.14, 0)
  g.add(rbox(0.3, 0.14, 0.15, C.brick, 0.1, 0.07, 0, 0.01), nave, rbox(0.12, 0.34, 0.12, C.stone, -0.11, 0.17, 0.01, 0.01), rbox(0.134, 0.014, 0.134, C.cream, -0.11, 0.2, 0.01, 0.004), rbox(0.134, 0.016, 0.134, C.cream, -0.11, 0.345, 0.01, 0.004), rbox(0.07, 0.05, 0.07, C.stone, -0.11, 0.378, 0.01, 0.008), pyramid(0.07, 0.03, C.copper, -0.11, 0.403, 0.01))
  for (const [x, z] of [[-0.165, 0.065], [-0.055, 0.065], [-0.165, -0.045], [-0.055, -0.045]]) g.add(cone(0.008, 0.04, C.stone, x, 0.372, z, 6))
  g.add(...dial(0.026, -0.11, 0.27, 0.074), chip(0.036, 0.07, 0.008, C.timberDark, -0.11, 0.035, 0.071), pane(0.024, 0.06, 0.008, -0.11, 0.15, 0.071))
  for (const x of [0.01, 0.08, 0.15, 0.22]) g.add(pane(0.022, 0.075, 0.008, x, 0.08, 0.076), chip(0.012, 0.13, 0.03, C.stone, x + 0.035, 0.065, 0.08))
  return g
}

// The old liner company's head office on the pier, now a hotel: brick, with two green-capped towers.
export function linerOffice(): THREE.Group {
  const g = new THREE.Group()
  g.add(rbox(0.28, 0.17, 0.2, C.brick, 0, 0.085, 0, 0.01), rbox(0.3, 0.016, 0.22, C.cream, 0, 0.178, 0, 0.005), rbox(0.3, 0.026, 0.22, C.rock, 0, 0.013, 0, 0.005))
  const gable = prism([[-0.06, 0], [-0.05, 0.05], [0, 0.085], [0.05, 0.05], [0.06, 0]], 0.03, C.brick, 0.004)
  gable.position.set(0, 0.18, 0.09)
  g.add(gable, ...dial(0.022, 0, 0.215, 0.108))
  for (const x of [-0.11, 0.11]) {
    g.add(rbox(0.06, 0.27, 0.06, C.brick, x, 0.135, 0.075, 0.006), rbox(0.07, 0.012, 0.07, C.cream, x, 0.274, 0.075, 0.004), pyramid(0.062, 0.08, C.copper, x, 0.28, 0.075), ball(0.007, C.ochre, x, 0.364, 0.075), win(0.02, 0.03, 0.008, x, 0.225, 0.106))
  }
  rows(g, 0.16, 0.07, 0.135, 0.101, 3, 2, 0.022, 0.032)
  g.add(chip(0.04, 0.06, 0.01, C.tealDeep, 0, 0.03, 0.101), chip(0.12, 0.016, 0.006, C.white, 0, 0.165, 0.102))
  return g
}

// A tower mill with a stage round it. The sails are a part of their own, to turn.
export function towerMill(h: number): { body: THREE.Group; sails: THREE.Group; hub: [number, number] } {
  const body = new THREE.Group()
  body.add(
    cyl(h * 0.2, h * 0.27, h * 0.45, C.brick, 0, h * 0.225, 0, 8), cyl(h * 0.15, h * 0.2, h * 0.42, C.timberDark, 0, h * 0.66, 0, 8),
    cyl(h * 0.32, h * 0.32, 0.008, C.timber, 0, h * 0.45, 0, 8), ball(h * 0.16, C.timberDark, 0, h * 0.86, 0),
    chip(0.024, 0.04, 0.008, C.white, 0, 0.022, h * 0.265), pane(0.016, 0.022, 0.008, 0, h * 0.3, h * 0.245), pane(0.014, 0.02, 0.008, 0, h * 0.62, h * 0.18, true),
  )
  for (let k = 0; k < 8; k++) {
    const turn = (k / 8) * Math.PI * 2
    const [x, z] = [Math.cos(turn) * h * 0.31, Math.sin(turn) * h * 0.31]
    body.add(chip(0.005, 0.026, 0.005, C.white, x, h * 0.45 + 0.015, z), bar([x, h * 0.45, z], [x * 0.72, h * 0.28, z * 0.72], 0.003, C.timber, 5))
  }
  const turning = new THREE.Group()
  const reach = h * 0.62
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group()
    arm.add(chip(0.007, reach, 0.007, C.timberDark, 0, reach / 2, 0), chip(reach * 0.2, reach * 0.74, 0.004, C.cream, reach * 0.11, reach * 0.6, 0))
    for (let k = 0; k < 5; k++) arm.add(chip(reach * 0.2, 0.003, 0.006, C.timberDark, reach * 0.11, reach * (0.26 + k * 0.17), 0))
    arm.rotation.z = (i * Math.PI) / 2
    turning.add(arm)
  }
  turning.add(cyl(0.011, 0.011, 0.02, C.timberDark, 0, 0, 0, 8).rotateX(Math.PI / 2))
  return { body, sails: fuse(turning), hub: [h * 0.88, h * 0.2] }
}

// Cube houses: each a cube stood on its corner on a hexagonal stem.
export function cubeHouses(count: number): THREE.Group {
  const g = new THREE.Group()
  for (let k = 0; k < count; k++) {
    const x = (k - (count - 1) / 2) * 0.115
    const cube = new THREE.Group()
    cube.add(rbox(0.1, 0.1, 0.1, C.signalYellow, 0, 0, 0, 0.008))
    for (const [wx, wy, wz] of [[0.051, 0.01, 0.01], [0.01, 0.051, 0.01], [0.01, 0.01, 0.051]]) cube.add(chip(wx > 0.05 ? 0.004 : 0.03, wy > 0.05 ? 0.004 : 0.03, wz > 0.05 ? 0.004 : 0.03, C.glass, wx, wy, wz))
    // Turned so that one corner points straight down.
    cube.rotation.set(-Math.atan(Math.SQRT1_2), 0, Math.PI / 4)
    cube.position.set(x, 0.165, 0)
    g.add(cube, cyl(0.022, 0.026, 0.09, C.concrete, x, 0.045, 0, 6), chip(0.014, 0.03, 0.006, C.timberDark, x, 0.016, 0.024))
  }
  return g
}

// The observation mast: a concrete shaft with a crow's nest, and a thin tower on top of that.
export function euromast(h: number): THREE.Group {
  const g = new THREE.Group()
  g.add(cyl(0.02, 0.028, h * 0.58, C.concrete, 0, h * 0.29, 0, 12), cyl(0.05, 0.03, 0.03, C.cream, 0, h * 0.58, 0, 16), cyl(0.052, 0.052, 0.014, C.glass, 0, h * 0.58 + 0.022, 0, 16), cyl(0.036, 0.05, 0.016, C.cream, 0, h * 0.58 + 0.036, 0, 16), cyl(0.008, 0.012, h * 0.38, C.white, 0, h * 0.8, 0, 8), cyl(0.014, 0.014, 0.012, C.signalRed, 0, h * 0.86, 0, 10), bulb(0.006, C.lampRed, 0, h + 0.002, 0, 2), rbox(0.1, 0.03, 0.1, C.concrete, 0, 0.015, 0, 0.006))
  return g
}

// A wind turbine. The rotor is a part of its own, to turn.
export function turbine(h: number): { mast: THREE.Group; rotor: THREE.Group; hub: number } {
  const mast = new THREE.Group()
  mast.add(cyl(0.008, 0.016, h, C.white, 0, h / 2, 0, 10), rbox(0.03, 0.022, 0.05, C.white, 0, h + 0.008, 0.008, 0.006), cyl(0.024, 0.026, 0.012, C.concrete, 0, 0.006, 0, 10), chip(0.03, 0.006, 0.03, C.signalRed, 0, h * 0.2, 0))
  const turning = new THREE.Group()
  for (let k = 0; k < 3; k++) {
    const blade = prism([[-0.009, 0], [0.009, 0], [0.003, h * 0.55], [-0.002, h * 0.55]], 0.004, C.white, 0.0015)
    blade.rotation.z = (k / 3) * Math.PI * 2
    turning.add(blade)
  }
  turning.add(cone(0.012, 0.022, C.white, 0, 0, 0.006, 10).rotateX(Math.PI / 2))
  return { mast, rotor: fuse(turning), hub: h + 0.008 }
}

// A bulb field: stripes of flowers down a strip of ground `depth` wide.
export function tulips(length: number, depth: number): THREE.Group {
  const g = new THREE.Group()
  const colors = [C.signalRed, C.signalYellow, C.pink, C.violet, C.orange, C.white]
  const beds = Math.round(depth / 0.022)
  g.add(rbox(length, 0.006, depth, C.leaf, 0, 0.003, 0, 0.002))
  for (let k = 0; k < beds; k++) g.add(rbox(length - 0.01, 0.012, 0.013, colors[k % colors.length], 0, 0.011, -depth / 2 + (k + 0.5) * (depth / beds), 0.004))
  return g
}

export function bicycle(color: string): THREE.Group {
  const g = new THREE.Group()
  for (const x of [-0.014, 0.014]) g.add(torus(0.0095, 0.0022, C.rubber, x, 0.0115, 0))
  g.add(bar([-0.014, 0.012, 0], [0.002, 0.026, 0], 0.002, color, 5), bar([0.014, 0.012, 0], [0.01, 0.032, 0], 0.002, color, 5), bar([0.002, 0.026, 0], [0.01, 0.028, 0], 0.002, color, 5), chip(0.008, 0.003, 0.004, C.timberDark, -0.001, 0.03, 0), chip(0.003, 0.003, 0.014, C.iron, 0.01, 0.034, 0))
  return g
}

// A sailing barge of the inland waters: flat, blunt, with a tan sail and a leeboard on her side.
export function barge(): THREE.Group {
  const g = new THREE.Group()
  g.add(hull(0.34, 0.11, 0.035, 0.025, C.timberDark, C.rubber))
  g.add(rbox(0.11, 0.022, 0.07, C.tealDeep, -0.08, 0.05, 0, 0.006), cyl(0.004, 0.005, 0.3, C.timber, 0.05, 0.19, 0, 6), bar([0.05, 0.09, 0], [-0.13, 0.1, 0], 0.004, C.timber, 5))
  const sail = prism([[0.045, 0.1], [-0.12, 0.105], [-0.07, 0.27], [0.045, 0.31]], 0.005, C.roofTerracotta, 0.002)
  const lee = prism([[0, 0], [0.03, -0.05], [-0.012, -0.05]], 0.006, C.timber, 0.002)
  lee.position.set(0.02, 0.03, 0.058)
  g.add(sail, lee, chip(0.03, 0.016, 0.003, C.signalRed, 0.064, 0.33, 0))
  return g
}

// ------------------------------------------------------------------------------------------ Los Angeles

// A pastel block of the thirties: a stepped parapet, fins up the front and a rounded corner.
export function decoBlock(w: number, h: number, wall: string, trim: string): THREE.Group {
  const g = new THREE.Group()
  const d = 0.2
  g.add(rbox(w, h, d, wall, 0, h / 2, 0, 0.022), rbox(w * 0.6, 0.026, d * 0.8, wall, 0, h + 0.011, 0, 0.008), rbox(w * 0.3, 0.05, 0.05, wall, 0, h + 0.03, d / 2 - 0.03, 0.006), rbox(w + 0.008, 0.008, d + 0.008, trim, 0, h - 0.018, 0, 0.004))
  for (const x of [-w * 0.1, 0, w * 0.1]) g.add(chip(0.008, h * 0.7 + 0.05, 0.012, trim, x, h * 0.65 + 0.025, d / 2 + 0.002))
  const floors = Math.max(1, Math.round((h - 0.07) / 0.062))
  for (let f = 0; f < floors; f++) {
    for (const side of [-1, 1]) g.add(win(w * 0.26, 0.022, 0.008, side * w * 0.3, 0.09 + f * 0.062, d / 2))
  }
  const canopy = rbox(w * 0.7, 0.008, 0.04, trim, 0, 0.066, d / 2 + 0.018, 0.003)
  g.add(canopy, chip(0.036, 0.054, 0.008, C.glass, 0, 0.03, d / 2 + 0.001))
  return g
}

// City Hall: a white tower stepping back to a pyramid, over a broad base.
export function cityHall(): THREE.Group {
  const g = new THREE.Group()
  g.add(rbox(0.3, 0.1, 0.2, C.white, 0, 0.05, 0, 0.01), rbox(0.2, 0.05, 0.16, C.white, 0, 0.125, 0, 0.008), rbox(0.1, 0.24, 0.1, C.white, 0, 0.27, 0.01, 0.008), rbox(0.085, 0.05, 0.085, C.cream, 0, 0.415, 0.01, 0.006))
  for (let k = 0; k < 3; k++) g.add(rbox(0.074 - k * 0.018, 0.02, 0.074 - k * 0.018, C.cream, 0, 0.45 + k * 0.02, 0.01, 0.003))
  g.add(pyramid(0.03, 0.03, C.slate, 0, 0.5, 0.01), bulb(0.006, C.lampWhite, 0, 0.535, 0.01, 2))
  for (let i = 0; i < 4; i++) g.add(chip(0.012, 0.2, 0.006, C.glass, -0.03 + i * 0.02, 0.27, 0.061), cyl(0.007, 0.008, 0.07, C.cream, -0.06 + i * 0.04, 0.045, 0.106, 8))
  g.add(rbox(0.18, 0.012, 0.03, C.cream, 0, 0.084, 0.106, 0.004), chip(0.03, 0.05, 0.008, C.timberDark, 0, 0.027, 0.101))
  rows(g, 0.3, 0.055, 0.055, 0.101, 6, 1, 0.02, 0.026)
  for (const x of [-0.17, 0.17]) g.add(cyl(0.003, 0.004, 0.18, C.white, x, 0.09, 0.12, 6), chip(0.04, 0.024, 0.003, x < 0 ? C.signalRed : C.signalBlue, x + 0.022, 0.166, 0.12))
  return g
}

// The observatory on the hill: a white hall with a big dome at its middle and a small one at each end.
export function observatory(): THREE.Group {
  const g = new THREE.Group()
  g.add(rbox(0.34, 0.07, 0.13, C.white, 0, 0.035, 0, 0.01), rbox(0.36, 0.01, 0.15, C.cream, 0, 0.074, 0, 0.004), rbox(0.11, 0.1, 0.15, C.white, 0, 0.05, 0.01, 0.01))
  const dome = (x: number, r: number, y: number) => g.add(cyl(r, r, 0.024, C.white, x, y, 0, 16), ball(r * 0.96, C.slate, x, y + 0.01, 0))
  dome(0, 0.058, 0.108)
  dome(-0.135, 0.03, 0.086)
  dome(0.135, 0.03, 0.086)
  g.add(chip(0.03, 0.05, 0.008, C.timberDark, 0, 0.03, 0.086), cyl(0.006, 0.01, 0.1, C.white, 0, 0.05, 0.18, 6))
  for (const x of [-0.09, -0.06, 0.06, 0.09]) g.add(pane(0.014, 0.034, 0.008, x, 0.04, 0.066))
  return g
}

const LETTERS: Record<string, string[]> = {
  H: ['101', '101', '111', '101', '101'], O: ['111', '101', '101', '101', '111'], L: ['100', '100', '100', '100', '111'],
  Y: ['101', '101', '010', '010', '010'], W: ['101', '101', '101', '111', '101'], D: ['110', '101', '101', '101', '110'],
}
// The sign on the hill: white letters on posts.
export function hillSign(word: string, cell: number): THREE.Group {
  const g = new THREE.Group()
  const pitch = cell * 4
  const x0 = (-(word.length * pitch - cell) / 2) + cell / 2
  word.split('').forEach((letter, n) => {
    LETTERS[letter].forEach((row, r) => row.split('').forEach((on, c) => {
      if (on === '1') g.add(chip(cell * 1.04, cell * 1.3, cell * 0.5, C.white, x0 + n * pitch + c * cell, cell * 1.6 + (4 - r) * cell * 1.3, 0))
    }))
    g.add(chip(cell * 0.3, cell * 1.4, cell * 0.3, C.steel, x0 + n * pitch + cell, cell * 0.7, -cell * 0.3))
  })
  return g
}

// A fan palm: a very tall thin trunk and a small head.
export function fanPalm(h: number, random: () => number): THREE.Group {
  const g = new THREE.Group()
  const trunk = cyl(0.004, 0.007, h, C.timber, 0, h / 2, 0, 6)
  const lean = (random() - 0.5) * 0.12
  trunk.rotation.z = lean
  g.add(trunk)
  const top = [-Math.sin(lean) * h * 0.5, h * 0.98]
  for (let i = 0; i < 7; i++) {
    const turn = (i / 7) * Math.PI * 2 + random()
    const frond = ball(0.034, i % 2 ? C.leaf : C.weed, top[0] + Math.cos(turn) * 0.03, top[1], Math.sin(turn) * 0.03)
    frond.scale.set(1, 0.28, 0.4)
    frond.rotation.set(0, -turn, -0.5, 'YXZ')
    g.add(frond)
  }
  g.add(ball(0.012, C.timber, top[0], top[1] - 0.014, 0))
  return g
}

// A lifeguard tower: a hut on stilts with a ramp down to the sand.
export function lifeguardTower(color: string): THREE.Group {
  const g = new THREE.Group()
  for (const [x, z] of [[-0.03, -0.025], [0.03, -0.025], [-0.03, 0.025], [0.03, 0.025]]) g.add(chip(0.006, 0.05, 0.006, C.white, x, 0.025, z))
  g.add(rbox(0.09, 0.008, 0.08, C.white, 0, 0.052, 0, 0.003), rbox(0.066, 0.045, 0.055, color, 0, 0.078, -0.006, 0.006), rbox(0.085, 0.008, 0.075, C.white, 0, 0.104, 0, 0.003), win(0.04, 0.02, 0.006, 0, 0.082, 0.022))
  const ramp = bar([0, 0.05, 0.04], [0, 0.004, 0.11], 0.006, C.white, 4)
  g.add(ramp, cyl(0.002, 0.002, 0.05, C.white, 0.036, 0.13, 0, 5), chip(0.022, 0.014, 0.002, C.signalRed, 0.048, 0.146, 0))
  return g
}

// The round record tower: a stack of discs under a needle.
export function recordTower(h: number): THREE.Group {
  const g = new THREE.Group()
  const floors = Math.round(h / 0.026)
  for (let k = 0; k < floors; k++) g.add(cyl(0.04, 0.04, 0.012, C.glass, 0, 0.014 + k * 0.026, 0, 18), cyl(0.05, 0.05, 0.012, C.white, 0, 0.027 + k * 0.026, 0, 18))
  g.add(cyl(0.03, 0.036, 0.02, C.white, 0, h + 0.016, 0, 14), cone(0.006, 0.09, C.white, 0, h + 0.07, 0, 8), bulb(0.006, C.lampRed, 0, h + 0.116, 0, 2))
  return g
}

// An oil derrick and its nodding pump, from the fields the town grew up on.
export function derrick(h: number): THREE.Group {
  const g = new THREE.Group()
  const base = 0.045
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(bar([sx * base, 0, sz * base], [sx * 0.008, h, sz * 0.008], 0.003, C.timberDark, 5))
  for (let k = 1; k < 5; k++) {
    const s = base - (base - 0.008) * (k / 5)
    const y = (h * k) / 5
    g.add(chip(s * 2, 0.004, 0.004, C.timberDark, 0, y, s), chip(s * 2, 0.004, 0.004, C.timberDark, 0, y, -s), chip(0.004, 0.004, s * 2, C.timberDark, s, y, 0), chip(0.004, 0.004, s * 2, C.timberDark, -s, y, 0))
  }
  g.add(chip(0.03, 0.01, 0.03, C.iron, 0, h + 0.005, 0), chip(0.006, 0.05, 0.006, C.iron, 0.1, 0.025, 0.02), bar([0.06, 0.056, 0.02], [0.14, 0.044, 0.02], 0.004, C.signalRed, 5), chip(0.014, 0.03, 0.01, C.iron, 0.062, 0.05, 0.02), chip(0.03, 0.02, 0.03, C.iron, 0.13, 0.01, 0.02))
  return g
}

// The old liner kept at her pier: a black hull, white upperworks and three red funnels.
export function liner(): THREE.Group {
  const g = new THREE.Group()
  g.add(hull(1.25, 0.17, 0.075, 0.05, C.rubber, C.antifoul))
  g.add(rbox(1.2, 0.012, 0.172, C.white, -0.01, 0.077, 0, 0.004), rbox(0.92, 0.035, 0.14, C.white, -0.04, 0.1, 0, 0.008), rbox(0.78, 0.03, 0.12, C.white, -0.06, 0.132, 0, 0.008), rbox(0.2, 0.026, 0.1, C.white, 0.2, 0.16, 0, 0.008))
  for (let x = -0.46; x < 0.4; x += 0.05) g.add(win(0.02, 0.012, 0.142, x, 0.104, 0), win(0.018, 0.01, 0.122, x, 0.136, 0))
  for (const x of [0.06, -0.14, -0.34]) {
    const funnel = cyl(0.03, 0.033, 0.09, C.orange, x, 0.192, 0, 14)
    funnel.scale.z = 0.75
    funnel.rotation.z = 0.08
    const cap = cyl(0.031, 0.03, 0.022, C.rubber, x - 0.006, 0.244, 0, 14)
    cap.scale.z = 0.75
    cap.rotation.z = 0.08
    g.add(funnel, cap)
  }
  for (const x of [0.4, -0.5]) g.add(cyl(0.003, 0.004, 0.2, C.timber, x, 0.18, 0, 6))
  for (let x = -0.4; x < 0.1; x += 0.1) g.add(rbox(0.07, 0.014, 0.022, C.white, x, 0.156, 0.062, 0.005), rbox(0.07, 0.014, 0.022, C.white, x, 0.156, -0.062, 0.005))
  g.add(bar([0.4, 0.27, 0], [-0.5, 0.27, 0], 0.001, C.iron, 4))
  return g
}

export function surfboard(color: string): THREE.Group {
  const g = new THREE.Group()
  const board = ball(0.03, color, 0, 0.03, 0)
  board.scale.set(0.28, 1, 0.08)
  board.rotation.x = -0.2
  g.add(board)
  return g
}
