import * as THREE from 'three/webgpu'
import { ball, bar, bulb, chip, cyl, fuse, hull, pane, prism, rbox, torus } from '../kit'
import { C } from '../style'

// Every road vehicle faces +x and carries its box on a bed centred at x = -0.02, with its top at y = 0.04.
function chassis(g: THREE.Group, axles: number[]): void {
  g.add(
    rbox(0.2, 0.012, 0.074, C.iron, -0.02, 0.034, 0, 0.004),
    chip(0.27, 0.012, 0.03, C.rubber, 0.01, 0.022, 0),
    chip(0.008, 0.012, 0.07, C.signalRed, -0.122, 0.03, 0),
  )
  for (const x of axles) {
    for (const z of [-0.033, 0.033]) {
      const wheel = cyl(0.014, 0.014, 0.018, C.rubber, x, 0.014, z, 12)
      wheel.rotation.x = Math.PI / 2
      g.add(wheel)
    }
    g.add(chip(0.008, 0.008, 0.086, C.steel, x, 0.014, 0))
  }
}

export const TRACTOR_TIERS = 2
const tractors = new Map<number, THREE.Group>()

// Yard tractor. tier 0 is the diesel one in signal yellow; tier 1 is the quicker electric one.
export function tractor(tier: number): THREE.Group {
  if (!tractors.has(tier)) {
    const g = new THREE.Group()
    chassis(g, [-0.09, -0.052, 0.125])
    g.add(
      rbox(0.058, 0.05, 0.07, tier ? C.white : C.signalYellow, 0.125, 0.052, 0, 0.012),
      chip(0.006, 0.022, 0.056, C.glass, 0.1535, 0.06, 0),
      chip(0.03, 0.02, 0.073, C.glass, 0.128, 0.06, 0),
      bulb(0.006, C.lampAmber, 0.115, 0.082, 0),
    )
    if (tier) {
      g.add(chip(0.061, 0.01, 0.073, C.green, 0.125, 0.036, 0), rbox(0.026, 0.034, 0.06, C.green, 0.082, 0.044, 0, 0.006))
    } else {
      g.add(cyl(0.004, 0.004, 0.05, C.iron, 0.092, 0.07, 0.026, 6), chip(0.02, 0.022, 0.05, C.iron, 0.086, 0.04, 0))
    }
    tractors.set(tier, fuse(g))
  }
  return tractors.get(tier)!.clone(true)
}

export const TRUCK_STYLES = 3
const trucks = new Map<string, THREE.Group>()

// Road truck from town: 0 a flat-nosed cab, 1 a long bonnet with twin stacks, 2 a cab with a sleeper.
export function truck(style: number, color: string): THREE.Group {
  const key = `${style}|${color}`
  if (!trucks.has(key)) {
    const g = new THREE.Group()
    chassis(g, [-0.095, -0.06, 0.09, 0.135])
    if (style === 0) {
      g.add(
        rbox(0.05, 0.066, 0.07, color, 0.128, 0.06, 0, 0.012),
        chip(0.006, 0.026, 0.058, C.glass, 0.1525, 0.072, 0),
        chip(0.026, 0.022, 0.073, C.glass, 0.134, 0.072, 0),
        chip(0.03, 0.012, 0.06, color, 0.118, 0.098, 0),
      )
    } else if (style === 1) {
      g.add(
        rbox(0.042, 0.058, 0.068, color, 0.108, 0.056, 0, 0.012),
        rbox(0.04, 0.034, 0.058, color, 0.146, 0.044, 0, 0.01),
        chip(0.006, 0.022, 0.054, C.glass, 0.1295, 0.07, 0),
        chip(0.022, 0.02, 0.071, C.glass, 0.112, 0.07, 0),
        chip(0.006, 0.02, 0.05, C.steel, 0.167, 0.04, 0),
      )
      for (const z of [-0.03, 0.03]) g.add(cyl(0.004, 0.004, 0.07, C.steel, 0.083, 0.07, z, 6))
    } else {
      g.add(
        rbox(0.04, 0.056, 0.07, color, 0.135, 0.055, 0, 0.012),
        rbox(0.034, 0.064, 0.068, C.cream, 0.098, 0.059, 0, 0.01),
        chip(0.006, 0.022, 0.056, C.glass, 0.1555, 0.066, 0),
        chip(0.02, 0.02, 0.073, C.glass, 0.138, 0.066, 0),
      )
    }
    trucks.set(key, fuse(g))
  }
  return trucks.get(key)!.clone(true)
}

let boothModel: THREE.Group | null = null

// One gate lane: a booth with a lit window and a signal.
export function booth(): THREE.Group {
  if (!boothModel) {
    const g = new THREE.Group()
    g.add(
      rbox(0.1, 0.09, 0.08, C.cream, 0, 0.045, 0, 0.012),
      rbox(0.13, 0.015, 0.11, C.signalRed, 0, 0.097, 0, 0.005),
      pane(0.06, 0.03, 0.006, 0, 0.058, 0.041),
      pane(0.006, 0.03, 0.05, -0.051, 0.058, 0),
      cyl(0.004, 0.005, 0.11, C.iron, 0.055, 0.055, 0.06, 6),
      bulb(0.008, C.lampGreen, 0.055, 0.116, 0.06, 2),
    )
    boothModel = fuse(g)
  }
  return boothModel.clone(true)
}

let barrierModel: THREE.Group | null = null

// A gate barrier: a post, and an arm (named 'arm') that reaches out along z and lifts about the post.
export function barrier(): THREE.Group {
  if (!barrierModel) {
    const arm = new THREE.Group()
    arm.add(bar([0, 0, 0], [0, 0, 0.125], 0.005, C.white, 6))
    for (const z of [0.03, 0.075, 0.118]) arm.add(chip(0.012, 0.012, 0.014, C.signalRed, 0, 0, z))
    const lift = fuse(arm)
    lift.name = 'arm'
    lift.position.y = 0.05
    const post = new THREE.Group()
    post.add(cyl(0.007, 0.009, 0.056, C.iron, 0, 0.028, 0, 8), chip(0.02, 0.016, 0.02, C.signalYellow, 0, 0.052, -0.004))
    barrierModel = fuse(post)
    barrierModel.add(lift)
  }
  return barrierModel.clone(true)
}

let dockerModel: THREE.Group | null = null

// A docker in a hard hat.
export function docker(): THREE.Group {
  if (!dockerModel) {
    const g = new THREE.Group()
    const hat = ball(0.0105, C.signalYellow, 0, 0.048, 0)
    hat.scale.y = 0.6
    g.add(cyl(0.01, 0.013, 0.034, C.orange, 0, 0.017, 0, 10), ball(0.009, C.clay, 0, 0.042, 0), hat)
    dockerModel = fuse(g)
  }
  return dockerModel.clone(true)
}

let tugModel: THREE.Group | null = null

// Harbour tug: short, fat and ringed with fenders. One lies at the service quay for every tug the port owns.
export function tug(): THREE.Group {
  if (!tugModel) {
    const g = new THREE.Group()
    g.add(hull(0.4, 0.15, 0.055, 0.045, C.navy, C.antifoul))
    g.add(
      rbox(0.3, 0.012, 0.13, C.deck, -0.02, 0.066, 0, 0.004),
      rbox(0.13, 0.07, 0.1, C.white, 0.02, 0.106, 0, 0.014),
      pane(0.134, 0.022, 0.104, 0.02, 0.118, 0),
      rbox(0.15, 0.01, 0.12, C.signalRed, 0.02, 0.146, 0, 0.004),
      cyl(0.02, 0.024, 0.07, C.signalRed, -0.065, 0.105, 0, 12),
      cyl(0.021, 0.022, 0.016, C.white, -0.065, 0.125, 0, 12),
      cyl(0.004, 0.005, 0.06, C.rope, 0.03, 0.18, 0, 6),
      bulb(0.006, C.lampWhite, 0.03, 0.214, 0),
      chip(0.03, 0.02, 0.04, C.iron, -0.13, 0.08, 0),
    )
    for (const [x, z] of [[0.19, 0], [0.15, 0.05], [0.15, -0.05], [0.02, 0.092], [-0.1, 0.086]] as const) {
      const fender = torus(0.02, 0.009, C.rubber, x, 0.04, z)
      fender.rotation.y = x > 0.1 ? Math.PI / 2 - z * 12 : 0
      g.add(fender)
    }
    tugModel = fuse(g)
  }
  return tugModel.clone(true)
}

// A signal mast at a berth: a pennant in the colours of each line whose ships are kept for it, and a
// gold burgee at the top when its cranes have the first call on tractors.
export function signalMast(lines: string[], first: boolean): THREE.Group {
  const g = new THREE.Group()
  g.add(
    cyl(0.005, 0.008, 0.38, C.white, 0, 0.19, 0, 8),
    chip(0.03, 0.02, 0.03, C.iron, 0, 0.01, 0),
    ball(0.009, first ? C.signalYellow : C.white, 0, 0.385, 0),
  )
  if (first) {
    const burgee = prism([[0, -0.022], [0.09, 0], [0, 0.022]], 0.008, C.signalYellow, 0.002)
    burgee.position.set(0.006, 0.345, 0)
    g.add(burgee)
  }
  lines.forEach((color, i) => g.add(chip(0.075, 0.03, 0.008, color, 0.045, (first ? 0.295 : 0.345) - i * 0.038, 0)))
  return fuse(g)
}

let dredgerModel: THREE.Group | null = null

// A trailing suction hopper dredger: it steams along the channel with its pipe on the bottom, and the hopper
// fills with sand as it goes. The sand is a part of its own, named 'spoil', so its level can be shown.
export function dredger(): THREE.Group {
  if (!dredgerModel) {
    const g = new THREE.Group()
    g.add(hull(0.9, 0.2, 0.07, 0.06, C.iron, C.antifoul))
    g.add(
      rbox(0.8, 0.012, 0.17, C.deck, -0.02, 0.078, 0, 0.004),
      rbox(0.44, 0.04, 0.15, C.steel, -0.04, 0.1, 0, 0.008),
      rbox(0.14, 0.09, 0.15, C.white, 0.3, 0.128, 0, 0.014),
      pane(0.144, 0.024, 0.154, 0.3, 0.145, 0),
      rbox(0.16, 0.012, 0.17, C.slate, 0.3, 0.178, 0, 0.004),
      cyl(0.022, 0.026, 0.09, C.signalYellow, -0.34, 0.125, 0, 12),
      cyl(0.023, 0.024, 0.018, C.iron, -0.34, 0.158, 0, 12),
      cyl(0.004, 0.005, 0.08, C.rope, 0.3, 0.22, 0, 6),
      bulb(0.007, C.lampAmber, 0.3, 0.264, 0),
      // The suction pipe, lowered over the side, with the two gantries that carry it.
      bar([0.2, 0.11, -0.118], [-0.34, -0.11, -0.135], 0.012, C.signalYellow),
      rbox(0.05, 0.03, 0.04, C.iron, -0.35, -0.115, -0.136, 0.008),
    )
    for (const x of [0.16, -0.14]) {
      g.add(rbox(0.022, 0.085, 0.022, C.signalYellow, x, 0.12, -0.085, 0.006), rbox(0.022, 0.02, 0.06, C.signalYellow, x, 0.158, -0.105, 0.006))
    }
    dredgerModel = fuse(g)
    const spoil = rbox(0.4, 0.05, 0.115, C.sand, -0.04, 0.115, 0, 0.012)
    spoil.name = 'spoil'
    dredgerModel.add(spoil)
  }
  return dredgerModel.clone(true)
}
