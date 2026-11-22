import * as THREE from 'three/webgpu'
import { QUAY_TOP, SEABED, bar, bulb, chip, cone, cyl, fuse, hull, pane, prism, rbox, slab, torus } from '../kit'
import type { VesselId, Works } from '../sim/game'
import { CLASSES } from '../sim/layout'
import { C } from '../style'
import { rigFor, shipBody } from './ships'

// The vessels that come to a yard for something other than containers. A hull this size carries no boxes.
export interface Size { length: number; beam: number; bays: number; rows: number; tiers: number }
const none = { bays: 0, rows: 1, tiers: 1 }
export const VESSELS: Record<VesselId, Size> = {
  tugboat: { length: 0.8, beam: 0.26, ...none },
  trawler: { length: 1.1, beam: 0.24, ...none },
  patrol: { length: 1.3, beam: 0.22, ...none },
  ferry: { length: 1.9, beam: 0.36, ...none },
  frigate: { length: 2.2, beam: 0.3, ...none },
  coaster: { length: CLASSES.feeder.length, beam: CLASSES.feeder.beam, ...none },
}
// How far a vessel on a slip or a ship lift sits above the water, and how far the lift goes down to let her on.
export const LIFT = { up: 0.1, down: 0.13 }

function tugboat(g: THREE.Group): number[] {
  g.add(hull(0.8, 0.26, 0.09, 0.07, C.maroon, C.antifoul))
  g.add(
    rbox(0.66, 0.012, 0.22, C.deck, -0.02, 0.096, 0, 0.004),
    rbox(0.26, 0.11, 0.17, C.white, 0.06, 0.155, 0, 0.016),
    pane(0.264, 0.03, 0.174, 0.06, 0.176, 0),
    rbox(0.29, 0.012, 0.2, C.signalRed, 0.06, 0.216, 0, 0.004),
    cyl(0.03, 0.036, 0.11, C.signalRed, -0.13, 0.16, 0, 12),
    cyl(0.031, 0.032, 0.02, C.white, -0.13, 0.19, 0, 12),
    cyl(0.005, 0.006, 0.1, C.rope, 0.08, 0.27, 0, 6),
    bulb(0.008, C.lampWhite, 0.08, 0.325, 0),
    chip(0.04, 0.03, 0.07, C.iron, -0.27, 0.115, 0),
  )
  for (const z of [-0.07, 0, 0.07]) g.add(torus(0.026, 0.011, C.rubber, 0.37 - Math.abs(z) * 0.9, 0.06, z))
  return [-0.13, 0.23, 0]
}

function trawler(g: THREE.Group): number[] {
  g.add(hull(1.1, 0.24, 0.1, 0.07, C.tealDeep, C.antifoul))
  g.add(
    rbox(0.94, 0.012, 0.2, C.deck, -0.03, 0.106, 0, 0.004),
    rbox(0.24, 0.035, 0.19, C.tealDeep, 0.36, 0.125, 0, 0.01),
    rbox(0.22, 0.12, 0.17, C.white, 0.2, 0.17, 0, 0.016),
    pane(0.224, 0.03, 0.174, 0.2, 0.195, 0),
    rbox(0.25, 0.012, 0.19, C.slate, 0.2, 0.236, 0, 0.004),
    cyl(0.022, 0.026, 0.08, C.orange, 0.06, 0.16, 0, 10),
    cyl(0.005, 0.006, 0.12, C.rope, 0.2, 0.3, 0, 6),
    bulb(0.008, C.lampWhite, 0.2, 0.365, 0),
    chip(0.16, 0.02, 0.12, C.steel, -0.12, 0.122, 0),
  )
  const drum = cyl(0.034, 0.034, 0.14, C.iron, -0.3, 0.15, 0, 12)
  drum.rotation.x = Math.PI / 2
  g.add(drum, chip(0.03, 0.03, 0.15, C.green, -0.3, 0.15, 0))
  // The stern gantry the trawl is hauled over.
  for (const z of [-0.09, 0.09]) g.add(bar([-0.4, 0.11, z], [-0.47, 0.3, z * 0.6], 0.011, C.signalYellow))
  g.add(bar([-0.47, 0.3, -0.054], [-0.47, 0.3, 0.054], 0.011, C.signalYellow))
  return [0.06, 0.22, 0]
}

function patrol(g: THREE.Group): number[] {
  g.add(hull(1.3, 0.22, 0.09, 0.06, C.slate, C.antifoul))
  g.add(
    rbox(1.14, 0.012, 0.18, C.steel, -0.03, 0.096, 0, 0.004),
    rbox(0.38, 0.08, 0.16, C.steel, 0.02, 0.14, 0, 0.014),
    pane(0.384, 0.022, 0.164, 0.02, 0.152, 0),
    rbox(0.2, 0.06, 0.14, C.steel, 0.09, 0.21, 0, 0.012),
    pane(0.204, 0.024, 0.144, 0.09, 0.216, 0),
    cone(0.03, 0.14, C.steel, 0, 0.31, 0, 4),
    chip(0.09, 0.012, 0.02, C.iron, 0, 0.32, 0),
    bulb(0.007, C.lampRed, 0, 0.385, 0),
    cyl(0.032, 0.036, 0.03, C.steel, 0.4, 0.117, 0, 10),
    bar([0.41, 0.125, 0], [0.54, 0.135, 0], 0.006, C.iron, 6),
    rbox(0.07, 0.06, 0.09, C.steel, -0.22, 0.13, 0, 0.012),
    rbox(0.15, 0.032, 0.07, C.orange, -0.47, 0.117, 0, 0.012),
  )
  return [-0.22, 0.18, 0]
}

function frigate(g: THREE.Group): number[] {
  g.add(hull(2.2, 0.3, 0.11, 0.08, C.slate, C.antifoul))
  g.add(
    rbox(1.98, 0.012, 0.25, C.steel, -0.04, 0.116, 0, 0.004),
    cyl(0.045, 0.05, 0.036, C.steel, 0.78, 0.14, 0, 12),
    bar([0.8, 0.15, 0], [0.98, 0.165, 0], 0.008, C.iron, 6),
    chip(0.12, 0.03, 0.14, C.iron, 0.6, 0.137, 0),
    rbox(0.62, 0.1, 0.22, C.steel, 0.22, 0.17, 0, 0.016),
    rbox(0.26, 0.07, 0.2, C.steel, 0.4, 0.255, 0, 0.014),
    pane(0.264, 0.024, 0.204, 0.4, 0.262, 0),
    cone(0.05, 0.24, C.steel, 0.2, 0.41, 0, 4),
    chip(0.14, 0.014, 0.024, C.iron, 0.2, 0.4, 0),
    bulb(0.008, C.lampRed, 0.2, 0.535, 0),
    rbox(0.16, 0.1, 0.12, C.steel, -0.16, 0.27, 0, 0.014),
    chip(0.13, 0.014, 0.09, C.iron, -0.16, 0.325, 0),
    rbox(0.36, 0.11, 0.24, C.steel, -0.46, 0.175, 0, 0.016),
    rbox(0.5, 0.008, 0.23, C.iron, -0.84, 0.122, 0, 0.003),
  )
  const ring = torus(0.07, 0.006, C.white, -0.84, 0.128, 0)
  ring.rotation.x = Math.PI / 2
  g.add(ring)
  return [-0.16, 0.34, 0]
}

function ferry(g: THREE.Group): number[] {
  g.add(hull(1.9, 0.36, 0.11, 0.08, C.navy, C.antifoul))
  g.add(
    rbox(1.72, 0.03, 0.366, C.white, -0.03, 0.125, 0, 0.008),
    rbox(1.5, 0.09, 0.33, C.white, -0.06, 0.185, 0, 0.018),
    pane(1.504, 0.03, 0.334, -0.06, 0.192, 0),
    rbox(1.1, 0.08, 0.28, C.white, -0.12, 0.27, 0, 0.016),
    pane(1.104, 0.028, 0.284, -0.12, 0.276, 0, true),
    rbox(0.2, 0.06, 0.3, C.white, 0.5, 0.34, 0, 0.014),
    pane(0.204, 0.026, 0.304, 0.5, 0.345, 0),
    rbox(0.14, 0.13, 0.1, C.white, -0.42, 0.375, 0, 0.016),
    chip(0.144, 0.04, 0.104, C.signalBlue, -0.42, 0.395, 0),
    cyl(0.005, 0.006, 0.12, C.rope, 0.5, 0.43, 0, 6),
    bulb(0.008, C.lampWhite, 0.5, 0.495, 0),
  )
  for (const z of [-0.15, 0.15]) for (const x of [-0.5, -0.1]) g.add(rbox(0.16, 0.035, 0.05, C.orange, x, 0.325, z, 0.012))
  return [-0.42, 0.45, 0]
}

const BUILDERS: Record<Exclude<VesselId, 'coaster'>, (g: THREE.Group) => number[]> = { tugboat, trawler, patrol, frigate, ferry }
const protos = new Map<VesselId, THREE.Group>()

// A fresh copy of a vessel. A coaster is a small cargo ship: the feeder's hull in her own colours, with no boxes.
export function vesselBody(id: VesselId, name: string, paint: { line: THREE.Material; trim: THREE.Material }): THREE.Group {
  if (id === 'coaster') return shipBody(CLASSES.feeder, rigFor(CLASSES.feeder, name), paint)
  if (!protos.has(id)) {
    const g = new THREE.Group()
    const stack = BUILDERS[id](g)
    const body = fuse(g)
    body.userData.stack = stack
    protos.set(id, body)
  }
  const body = protos.get(id)!.clone(true)
  body.userData.stack = protos.get(id)!.userData.stack
  return body
}

const shed = (g: THREE.Group, w: number, x: number, wall: string, roof: string): void => {
  g.add(rbox(w, 0.11, 0.13, wall, x, QUAY_TOP + 0.055, -0.115, 0.012))
  const top = prism([[-w / 2 - 0.01, 0], [0, 0.045], [w / 2 + 0.01, 0]], 0.15, roof)
  top.position.set(x, QUAY_TOP + 0.11, -0.115)
  g.add(top)
}

// Two finger piers either end of the berth, with the winch houses that work whatever lies between them.
function piers(g: THREE.Group): void {
  for (const x of [-1.5, 1.5]) {
    g.add(slab(x - 0.07, x + 0.07, SEABED, QUAY_TOP - 0.02, 0, 0.54, C.concrete))
    for (const z of [0.1, 0.44]) g.add(rbox(0.1, 0.09, 0.1, C.signalYellow, x, QUAY_TOP + 0.025, z, 0.014), chip(0.06, 0.03, 0.06, C.iron, x, QUAY_TOP + 0.08, z))
    g.add(bulb(0.01, C.lampWarm, x, QUAY_TOP + 0.05, 0.27))
  }
}

export interface Fixture {
  group: THREE.Group
  // The part that moves: a shipyard's gantry along the hull, a repair dock's platform up and down.
  moving: THREE.Object3D | null
}

// What stands on a stretch of quay given over to some other work than containers. Built about the middle of
// the berth, with the quay edge at z = 0.
export function yardFixture(works: Works): Fixture {
  const g = new THREE.Group()
  let moving: THREE.Object3D | null = null
  if (works === 'shipyard') {
    // The slip: a deck just clear of the water with the keel blocks on it, and the plate shop behind.
    piers(g)
    g.add(slab(-1.43, 1.43, SEABED, 0.03, 0.02, 0.54, C.concrete))
    for (let x = -1.2; x <= 1.21; x += 0.3) g.add(chip(0.06, 0.016, 0.1, C.timber, x, 0.038, 0.27))
    shed(g, 0.9, -0.85, C.cream, C.slate)
    for (let k = 0; k < 4; k++) g.add(rbox(0.3, 0.012, 0.1, C.steel, 0.75, QUAY_TOP + 0.008 + k * 0.013, -0.12, 0.003))
    // The gantry crane that lifts each section into place, standing on the quay and on the slip's outer edge.
    const crane = new THREE.Group()
    crane.add(
      rbox(0.05, 0.6, 0.05, C.signalYellow, -0.08, QUAY_TOP + 0.3, -0.02, 0.012),
      rbox(0.05, 0.6, 0.05, C.signalYellow, 0.08, QUAY_TOP + 0.3, -0.02, 0.012),
      rbox(0.05, 0.71, 0.05, C.signalYellow, -0.08, 0.385, 0.5, 0.012),
      rbox(0.05, 0.71, 0.05, C.signalYellow, 0.08, 0.385, 0.5, 0.012),
      rbox(0.24, 0.06, 0.64, C.signalYellow, 0, 0.76, 0.24, 0.016),
      rbox(0.12, 0.04, 0.1, C.iron, 0, 0.72, 0.27, 0.01),
      bar([0, 0.7, 0.27], [0, 0.5, 0.27], 0.004, C.iron, 5),
      chip(0.12, 0.014, 0.06, C.signalYellow, 0, 0.5, 0.27),
      bulb(0.01, C.lampAmber, 0, 0.8, 0.5),
    )
    moving = fuse(crane)
    g.add(moving)
    return { group: withFused(g, moving), moving }
  }
  if (works === 'repair') {
    piers(g)
    shed(g, 0.7, -0.9, C.cream, C.roofTile)
    g.add(cyl(0.012, 0.016, 0.2, C.signalYellow, 0.9, QUAY_TOP + 0.1, -0.1, 8), bar([0.9, QUAY_TOP + 0.2, -0.1], [0.9, QUAY_TOP + 0.25, 0.1], 0.008, C.signalYellow))
    // The platform between the piers, which goes down to let a ship over it and comes up underneath her.
    const platform = new THREE.Group()
    platform.add(rbox(2.86, 0.03, 0.48, C.steel, 0, 0.02, 0.28, 0.008))
    for (let x = -1.2; x <= 1.21; x += 0.3) platform.add(chip(0.06, 0.016, 0.1, C.timber, x, 0.04, 0.28))
    for (const x of [-1.4, 1.4]) platform.add(chip(0.03, 0.02, 0.44, C.signalYellow, x, 0.036, 0.28))
    moving = fuse(platform)
    return { group: withFused(g, moving), moving }
  }
  if (works === 'navy') {
    // Headquarters with its radar, a fuel tank, sentry boxes at either end, a fence and floodlights.
    shed(g, 0.6, -0.55, C.stone, C.slate)
    g.add(
      cyl(0.006, 0.006, 0.06, C.iron, -0.4, QUAY_TOP + 0.185, -0.115, 6), chip(0.07, 0.012, 0.03, C.steel, -0.4, QUAY_TOP + 0.22, -0.115),
      cyl(0.06, 0.06, 0.1, C.white, 0.5, QUAY_TOP + 0.05, -0.115, 16), cyl(0.061, 0.061, 0.02, C.signalRed, 0.5, QUAY_TOP + 0.07, -0.115, 16),
      cyl(0.006, 0.008, 0.3, C.white, 0, QUAY_TOP + 0.15, -0.115, 8),
      chip(0.1, 0.05, 0.008, C.signalBlue, 0.056, QUAY_TOP + 0.27, -0.115), chip(0.1, 0.014, 0.01, C.white, 0.056, QUAY_TOP + 0.27, -0.115),
    )
    for (const x of [-1.5, 1.5]) {
      g.add(rbox(0.07, 0.09, 0.07, C.slate, x, QUAY_TOP + 0.045, -0.13, 0.01), chip(0.08, 0.012, 0.08, C.signalRed, x, QUAY_TOP + 0.096, -0.13))
      g.add(cyl(0.007, 0.01, 0.26, C.steel, x * 0.78, QUAY_TOP + 0.13, -0.17, 8), bulb(0.012, C.lampWhite, x * 0.78, QUAY_TOP + 0.265, -0.16))
    }
    for (let x = -1.4; x <= 1.41; x += 0.2) g.add(chip(0.012, 0.05, 0.012, C.iron, x, QUAY_TOP + 0.025, -0.195))
    g.add(bar([-1.4, QUAY_TOP + 0.045, -0.195], [1.4, QUAY_TOP + 0.045, -0.195], 0.004, C.iron, 5))
    return { group: fuse(g), moving }
  }
  // Ferry terminal: the hall with its glass front and blue canopy, a gangway to the ship and a ramp for cars.
  g.add(
    rbox(0.9, 0.12, 0.13, C.cream, -0.55, QUAY_TOP + 0.06, -0.115, 0.014),
    pane(0.8, 0.06, 0.134, -0.55, QUAY_TOP + 0.055, -0.115),
    rbox(0.96, 0.016, 0.17, C.signalBlue, -0.55, QUAY_TOP + 0.128, -0.11, 0.006),
    rbox(0.07, 0.2, 0.07, C.white, 0.2, QUAY_TOP + 0.1, -0.08, 0.012),
    rbox(0.05, 0.035, 0.2, C.white, 0.2, QUAY_TOP + 0.18, 0.04, 0.01),
    pane(0.054, 0.016, 0.16, 0.2, QUAY_TOP + 0.182, 0.04),
    rbox(0.34, 0.016, 0.2, C.steel, 0.85, QUAY_TOP - 0.012, 0.07, 0.005),
  )
  for (const x of [0.7, 1.0]) g.add(chip(0.012, 0.012, 0.2, C.signalYellow, x, QUAY_TOP + 0.002, 0.07))
  for (const x of [-1.2, 0.5, 1.3]) g.add(cyl(0.006, 0.009, 0.2, C.steel, x, QUAY_TOP + 0.1, -0.17, 8), bulb(0.011, C.lampWarm, x, QUAY_TOP + 0.205, -0.165))
  return { group: fuse(g), moving }
}

// Fuses the fixed parts and keeps the moving part separate beside them.
function withFused(fixed: THREE.Group, moving: THREE.Object3D): THREE.Group {
  moving.removeFromParent()
  const group = new THREE.Group()
  group.add(fuse(fixed), moving)
  return group
}
