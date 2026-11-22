import * as THREE from 'three/webgpu'
import { BOX, QUAY_TOP, bar, bulb, chip, cyl, fuse, rbox } from '../kit'
import { GROUND_Y } from '../sim/layout'
import { C } from '../style'

// Quay crane geometry the simulation relies on: where the rails are and where the boom hinges.
export const QUAY_CRANE = { waterside: -0.07, landside: -0.45, leg: 0.22, girder: 0.785, hinge: -0.03, top: 0.82 }

// Three generations of quay crane, told apart by what stands on top of the portal:
// 0 a single mast over a braced portal and a lattice boom, 1 a tall A-frame, 2 a heavy box boom under twin posts.
export const CRANE_FAMILIES = 3

export interface QuayCraneModel {
  frame: THREE.Group
  boom: THREE.Group
  // Where the forestay leaves the frame, and where it meets the boom, measured from the hinge.
  apex: THREE.Vector3
  hang: THREE.Vector3
}

const quayCranes = new Map<string, QuayCraneModel>()

function buildQuayCrane(family: number, color: string): QuayCraneModel {
  const { waterside: WS, landside: LS, leg: SX, girder: GIRDER, top: TOP } = QUAY_CRANE
  const f = new THREE.Group()
  const sill = QUAY_TOP + 0.056
  const thick = family === 2 ? 0.05 : 0.04
  for (const z of [WS, LS]) {
    f.add(rbox(0.5, 0.04, 0.046, color, 0, sill, z, 0.01), rbox(0.48, 0.036, 0.036, color, 0, TOP, z, 0.008))
    for (const sx of [-SX, SX]) {
      f.add(
        rbox(0.11, 0.03, 0.04, C.iron, sx, QUAY_TOP + 0.022, z, 0.008),
        rbox(thick, TOP - sill, thick, color, sx, (TOP + sill) / 2, z, 0.009),
      )
    }
  }
  for (const sx of [-SX, SX]) {
    f.add(
      rbox(0.034, 0.034, 0.38, color, sx, 0.43, -0.26, 0.008),
      rbox(0.034, 0.034, 0.42, color, sx, TOP, -0.26, 0.008),
      bar([sx, 0.6, LS], [sx, TOP, -0.3], 0.011, color),
    )
  }
  f.add(rbox(0.44, 0.03, 0.03, color, 0, 0.43, WS, 0.007), rbox(0.44, 0.03, 0.03, color, 0, 0.43, LS, 0.007))
  for (const x of [-0.14, 0.14]) f.add(bulb(0.011, C.lampWarm, x, TOP - 0.03, WS + 0.012))

  // Backreach: the fixed half of the girder, carrying the machinery house.
  for (const sx of [-0.04, 0.04]) {
    f.add(rbox(0.022, 0.03, 0.64, color, sx, GIRDER, -0.35, 0.007), chip(0.016, 0.03, 0.016, color, sx, 0.803, WS), chip(0.016, 0.03, 0.016, color, sx, 0.803, LS))
  }
  const houseW = family === 2 ? 0.26 : 0.2
  f.add(
    rbox(houseW, 0.11, 0.17, family === 2 ? C.white : C.cream, 0, 0.865, -0.57, 0.014),
    rbox(houseW + 0.016, 0.014, 0.186, C.slate, 0, 0.927, -0.57, 0.005),
    chip(houseW + 0.004, 0.022, 0.174, color, 0, 0.835, -0.57),
    chip(houseW * 0.7, 0.026, 0.006, C.glass, 0, 0.885, -0.484),
  )

  let apex: THREE.Vector3
  if (family === 0) {
    apex = new THREE.Vector3(0, 1.13, WS)
    f.add(
      rbox(0.036, apex.y - TOP, 0.036, color, 0, (apex.y + TOP) / 2, WS, 0.008),
      chip(0.17, 0.02, 0.02, color, 0, 1.06, WS),
      bulb(0.01, C.lampRed, 0, apex.y + 0.012, WS),
      bar([-SX, sill, WS], [SX, 0.43, WS], 0.01, color),
      bar([SX, sill, WS], [-SX, 0.43, WS], 0.01, color),
      bar([-SX, 0.43, LS], [SX, TOP, LS], 0.01, color),
      bar([SX, 0.43, LS], [-SX, TOP, LS], 0.01, color),
    )
    for (const sx of [-0.04, 0.04]) f.add(bar([0, apex.y - 0.02, WS], [sx, 0.8, -0.66], 0.005, C.iron, 6))
  } else if (family === 1) {
    apex = new THREE.Vector3(0, 1.16, WS)
    for (const sx of [-1, 1]) {
      f.add(
        bar([sx * 0.19, TOP, WS], [sx * 0.012, apex.y, WS], 0.016, color, 10),
        bar([sx * 0.012, apex.y, WS], [sx * 0.1, TOP, LS], 0.012, color, 10),
      )
    }
    f.add(
      rbox(0.06, 0.04, 0.05, color, 0, apex.y, WS, 0.01),
      chip(0.2, 0.022, 0.022, color, 0, 0.99, WS),
      bulb(0.01, C.lampRed, 0, apex.y + 0.03, WS),
    )
  } else {
    apex = new THREE.Vector3(0, 1.05, WS)
    f.add(
      rbox(0.5, 0.07, 0.06, color, 0, TOP + 0.016, WS, 0.012),
      rbox(0.29, 0.03, 0.03, color, 0, apex.y, WS, 0.008),
      rbox(0.055, 0.13, 0.05, C.cream, -SX, 0.56, WS + 0.036, 0.01),
      chip(0.04, 0.03, 0.006, C.glass, -SX, 0.585, WS + 0.062),
    )
    for (const sx of [-0.12, 0.12]) {
      f.add(
        rbox(0.03, apex.y - TOP, 0.03, color, sx, (apex.y + TOP) / 2, WS, 0.008),
        bar([sx, apex.y, WS], [sx * 0.4, 0.8, -0.62], 0.005, C.iron, 6),
        bulb(0.009, C.lampRed, sx, apex.y + 0.024, WS),
      )
    }
  }

  // Boom: the half over the water, which lifts clear when no ship is alongside. Built from its hinge.
  const b = new THREE.Group()
  if (family === 2) {
    b.add(rbox(0.1, 0.04, 0.64, color, 0, 0, 0.32, 0.01))
  } else {
    for (const sx of [-0.04, 0.04]) b.add(rbox(0.022, 0.03, 0.64, color, sx, 0, 0.32, 0.007))
    for (const z of [0.02, 0.33]) b.add(chip(0.1, 0.02, 0.022, color, 0, 0, z))
  }
  b.add(chip(0.116, 0.036, 0.04, C.white, 0, 0, 0.635), chip(0.118, 0.038, 0.012, C.signalRed, 0, 0, 0.635))
  for (const z of [0.2, 0.46]) b.add(bulb(0.008, C.lampWarm, 0.052, -0.012, z))
  if (family === 0) {
    b.add(bar([0, 0.1, 0.02], [0, 0.012, 0.62], 0.009, color))
    for (const z of [0.02, 0.22, 0.42]) {
      const rise = 0.1 - ((z - 0.02) / 0.6) * 0.088
      for (const sx of [-0.04, 0.04]) b.add(bar([sx, 0.01, z], [0, rise, z], 0.006, color, 6))
    }
  }
  return { frame: fuse(f), boom: fuse(b), apex, hang: new THREE.Vector3(0, family === 0 ? 0.04 : 0.02, 0.5) }
}

// A fresh copy of a quay crane's fixed frame and its boom.
export function quayCrane(family: number, color: string): QuayCraneModel {
  const key = `${family}|${color}`
  if (!quayCranes.has(key)) quayCranes.set(key, buildQuayCrane(family, color))
  const model = quayCranes.get(key)!
  return { ...model, frame: model.frame.clone(true), boom: model.boom.clone(true) }
}

export const DRIVE_TIERS = 3
const drives = new Map<number, THREE.Group>()

// What better drives add to a quay crane: first a switch house on the portal beam and a cable reel at the
// foot of a landside leg, then a second switch house and a beacon. They sit clear of the path of the box.
export function drivePack(tier: number): THREE.Group {
  if (!drives.has(tier)) {
    const g = new THREE.Group()
    const { waterside: WS, landside: LS, leg: SX } = QUAY_CRANE
    for (const x of [0.15, -0.14].slice(0, tier)) {
      g.add(
        rbox(0.085, 0.06, 0.05, C.cream, x, 0.475, WS, 0.01),
        chip(0.089, 0.012, 0.054, C.signalYellow, x, 0.452, WS),
        chip(0.05, 0.02, 0.006, C.iron, x, 0.484, WS + 0.026),
      )
    }
    if (tier) {
      const reel = cyl(0.05, 0.05, 0.024, C.iron, -SX - 0.045, QUAY_TOP + 0.13, LS, 16)
      reel.rotation.z = Math.PI / 2
      const hub = cyl(0.02, 0.02, 0.032, C.signalYellow, -SX - 0.045, QUAY_TOP + 0.13, LS, 10)
      hub.rotation.z = Math.PI / 2
      g.add(reel, hub)
    }
    if (tier > 1) g.add(bulb(0.012, C.lampAmber, 0.15, 0.514, WS))
    drives.set(tier, fuse(g))
  }
  return drives.get(tier)!.clone(true)
}

// The parts of any crane that travel: the trolley with its cab, and the spreader that grips a box.
export function trolley(width: number, cabX: number): THREE.Group {
  const g = new THREE.Group()
  g.add(
    rbox(width, 0.03, 0.1, C.iron, 0, 0, 0, 0.008),
    rbox(0.05, 0.05, 0.05, C.cream, cabX, -0.04, 0, 0.01),
    chip(0.04, 0.02, 0.006, C.glass, cabX, -0.042, 0.026),
    chip(0.006, 0.02, 0.04, C.glass, cabX + Math.sign(cabX || 1) * 0.026, -0.042, 0),
  )
  return fuse(g)
}

export function spreader(): THREE.Group {
  const g = new THREE.Group()
  g.add(rbox(BOX.l - 0.01, 0.012, BOX.w - 0.01, C.signalYellow, 0, 0, 0, 0.004), chip(0.05, 0.016, 0.04, C.iron, 0, 0.008, 0))
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(chip(0.014, 0.02, 0.014, C.iron, sx * (BOX.l / 2 - 0.008), -0.004, sz * (BOX.w / 2 - 0.006)))
  return fuse(g)
}

// Yard crane geometry: it straddles the rows of one block and reaches out over the road.
export const YARD_CRANE = { leg: 0.13, front: -0.676, back: -1.14, reach: -0.5, girder: GROUND_Y + 0.48 }
export const GANTRY_TIERS = 2

const gantries = new Map<number, THREE.Group>()

// tier 0 runs on rubber tyres with its own engine; tier 1 is the faster rail-mounted crane fed by a cable.
function buildGantry(tier: number): THREE.Group {
  const { leg: SX, front, back, reach, girder } = YARD_CRANE
  const g = new THREE.Group()
  const accent = tier ? C.teal : C.amber
  const thick = tier ? 0.03 : 0.024
  const length = reach - back + 0.02
  const middle = (reach + back) / 2
  for (const z of [front, back]) {
    g.add(rbox(0.31, 0.018, 0.018, C.white, 0, GROUND_Y + 0.05, z, 0.005))
    for (const sx of [-SX, SX]) {
      g.add(rbox(thick, 0.44, thick, C.white, sx, GROUND_Y + 0.26, z, 0.006))
      if (tier) {
        g.add(rbox(0.07, 0.026, 0.03, C.iron, sx, GROUND_Y + 0.02, z, 0.006))
      } else {
        for (const dx of [-0.022, 0.022]) {
          const tyre = cyl(0.019, 0.019, 0.02, C.rubber, sx + dx, GROUND_Y + 0.019, z, 12)
          tyre.rotation.x = Math.PI / 2
          g.add(tyre, chip(0.012, 0.012, 0.022, C.signalYellow, sx + dx, GROUND_Y + 0.019, z))
        }
      }
    }
  }
  for (const sx of [-SX, SX]) {
    g.add(
      rbox(thick + 0.004, 0.03, length, C.white, sx, girder, middle, 0.007),
      chip(thick + 0.008, 0.012, length * 0.7, accent, sx, girder - 0.006, middle),
      bar([sx, girder - 0.13, back], [sx, girder, back + 0.12], 0.008, C.white, 6),
      bar([sx, girder - 0.13, front], [sx, girder, front - 0.1], 0.008, C.white, 6),
    )
  }
  for (const z of [reach, back]) g.add(rbox(0.29, 0.024, 0.024, C.white, 0, girder, z, 0.006))
  g.add(bulb(0.009, C.lampAmber, SX, girder + 0.03, back), bulb(0.009, C.lampWarm, 0, girder - 0.018, reach))
  if (tier) {
    const reel = cyl(0.04, 0.04, 0.022, C.iron, SX + 0.0, GROUND_Y + 0.13, back + 0.05, 16)
    reel.rotation.z = Math.PI / 2
    const hub = cyl(0.016, 0.016, 0.03, accent, SX, GROUND_Y + 0.13, back + 0.05, 10)
    hub.rotation.z = Math.PI / 2
    g.add(
      reel, hub,
      rbox(0.06, 0.09, 0.05, C.cream, -SX, GROUND_Y + 0.12, back + 0.04, 0.01),
      chip(0.064, 0.016, 0.054, accent, -SX, GROUND_Y + 0.15, back + 0.04),
      bar([-SX, GROUND_Y + 0.06, back], [SX, girder - 0.14, back], 0.007, C.white, 6),
      bar([SX, GROUND_Y + 0.06, back], [-SX, girder - 0.14, back], 0.007, C.white, 6),
    )
  } else {
    g.add(
      rbox(0.09, 0.06, 0.05, accent, 0, GROUND_Y + 0.09, back, 0.01),
      chip(0.05, 0.03, 0.054, C.iron, 0.01, GROUND_Y + 0.09, back),
      cyl(0.005, 0.005, 0.07, C.iron, -0.03, GROUND_Y + 0.15, back, 6),
    )
  }
  return fuse(g)
}

export function gantryFrame(tier: number): THREE.Group {
  if (!gantries.has(tier)) gantries.set(tier, buildGantry(tier))
  return gantries.get(tier)!.clone(true)
}
