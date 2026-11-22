import * as THREE from 'three/webgpu'
import { BOX, ball, bar, bulb, chip, cyl, fuse, mat, pane, rbox } from '../kit'
import { BAY_PITCH, DECK, FREEBOARD, type ClassId, type ShipClass } from '../sim/layout'
import { C, FINISH } from '../style'

// Where the house stands: at the stern, at the stern with deck cranes, two bays forward of the stern,
// or split in two with the funnel aft and the bridge forward.
export type Plan = 'aft' | 'geared' | 'mid' | 'twin'
const PLANS: Record<ClassId, Plan[]> = {
  feeder: ['aft', 'geared'], panamax: ['aft', 'mid'], neo: ['aft', 'twin'],
}
const ACCENTS = [C.signalYellow, C.white, C.orange, C.signalRed]
const FUNNELS = 3

export interface Rig { plan: Plan; funnel: number; accent: string; key: string }

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

// A ship's design follows from its name, so the same ship looks the same on every call.
export function rigFor(spec: ShipClass, name = ''): Rig {
  const h = hash(name)
  const plan = name ? PLANS[spec.id][h % PLANS[spec.id].length] : 'aft'
  const funnel = (h >>> 4) % FUNNELS
  return { plan, funnel, accent: ACCENTS[(h >>> 8) % ACCENTS.length], key: `${spec.id}|${plan}|${funnel}` }
}

// Where each bay of boxes sits along the hull, from the stern forward.
export function bayXs(spec: ShipClass, plan: Plan): number[] {
  const stern = -spec.length / 2
  const run = (from: number, count: number) => Array.from({ length: count }, (_, i) => stern + from + i * BAY_PITCH)
  if (plan === 'mid') return [...run(0.36, 2), ...run(1.1, spec.bays - 2)]
  if (plan === 'twin') return [...run(0.46, 3), ...run(1.37, spec.bays - 3)]
  return run(0.78, spec.bays)
}

// Stand-ins for the two colours a shipping line paints its ships in. Every copy swaps in its own.
const LINE = new THREE.MeshStandardMaterial({ color: C.navy, roughness: FINISH.hull })
const TRIM = new THREE.MeshStandardMaterial({ color: C.signalYellow, roughness: FINISH.matte })
const inLine = (mesh: THREE.Mesh) => ((mesh.material = LINE), mesh)
const inTrim = (mesh: THREE.Mesh) => ((mesh.material = TRIM), mesh)

function waterline(length: number, beam: number): THREE.Shape {
  const shape = new THREE.Shape()
  const l = length / 2
  const b = beam / 2
  shape.moveTo(-l, -b * 0.8)
  shape.lineTo(l * 0.35, -b)
  shape.quadraticCurveTo(l * 0.85, -b, l, 0)
  shape.quadraticCurveTo(l * 0.85, b, l * 0.35, b)
  shape.lineTo(-l, b * 0.8)
  shape.quadraticCurveTo(-l * 1.06, 0, -l, -b * 0.8)
  return shape
}

function layer(shape: THREE.Shape, depth: number, bevel: number, y: number, material: THREE.Material): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 12,
  })
  geo.rotateX(-Math.PI / 2)
  const mesh = new THREE.Mesh(geo, material)
  mesh.position.y = y
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function build(spec: ShipClass, rig: Rig): THREE.Group {
  const g = new THREE.Group()
  const { length, beam, draft } = spec
  const l = length / 2
  const stern = -l
  const bevel = Math.min(beam, FREEBOARD) * 0.12
  const cargo = spec.tiers * BOX.h

  // Hull: antifoul below, the line's colour above, a white boot-top at the waterline and a stripe under the deck.
  g.add(
    layer(waterline(length, beam), draft, bevel, -draft, mat(C.antifoul, FINISH.hull)),
    layer(waterline(length, beam), FREEBOARD, bevel, 0, LINE),
    layer(waterline(length + bevel * 2, beam + bevel * 2), 0.012, 0.004, -0.002, mat(C.white, FINISH.hull)),
    layer(waterline(length + bevel * 2, beam + bevel * 2), 0.01, 0.004, 0.178, TRIM),
    layer(waterline(length - 0.03, beam - 0.012), 0.003, 0.002, DECK - 0.002, mat(C.deck)),
  )
  const nose = ball(draft * 0.42, C.antifoul, l - 0.03, -draft * 0.55, 0)
  nose.scale.set(2.2, 1, 1)
  const aft = stern * 1.03 - bevel
  const hub = cyl(0.011, 0.011, 0.03, C.ochre, aft - 0.004, -draft * 0.6, 0, 10)
  hub.rotation.z = Math.PI / 2
  g.add(nose, hub, rbox(0.045, draft * 0.9, 0.014, C.antifoul, aft - 0.04, -draft * 0.5, 0, 0.005))
  for (let i = 0; i < 4; i++) {
    const turn = (i / 4) * Math.PI * 2 + 0.4
    const blade = ball(0.02, C.ochre, aft - 0.004, -draft * 0.6 + Math.cos(turn) * 0.017, Math.sin(turn) * 0.017)
    blade.scale.set(0.22, 1, 0.5)
    blade.rotation.x = turn
    g.add(blade)
  }

  // Forecastle: a raised deck that follows the bow, with its mast, breakwater and windlasses.
  const bays = bayXs(spec, rig.plan)
  const fore = bays[bays.length - 1] + BOX.l / 2 + 0.05
  const half = beam / 2
  const curve = (t: number): [number, number] =>
    [0.35 * l * (1 - t) ** 2 + 2 * t * (1 - t) * 0.85 * l + t * t * l, half * (1 - t * t)]
  const edge: [number, number][] = [[fore, half * 0.88]]
  for (let i = 0; i <= 14; i++) {
    const [x, z] = curve(i / 14)
    if (x > fore + 0.01) {
      if (edge.length === 1) edge[0][1] = Math.min(half, z + 0.01) * 0.88
      edge.push([x - 0.014, z * 0.88])
    }
  }
  const castle = new THREE.Shape()
  edge.forEach(([x, z], i) => (i ? castle.lineTo(x, -z) : castle.moveTo(x, -z)))
  for (let i = edge.length - 2; i >= 0; i--) castle.lineTo(edge[i][0], edge[i][1])
  castle.closePath()
  const castleTop = DECK + 0.03
  g.add(layer(castle, 0.022, 0.008, DECK, LINE))
  const mastX = fore + (l - fore) * 0.5
  g.add(
    chip(0.012, 0.03, edge[0][1] * 1.7, C.white, fore + 0.02, castleTop + 0.012, 0),
    cyl(0.005, 0.007, 0.13, C.white, mastX, castleTop + 0.065, 0, 8),
    chip(0.008, 0.008, 0.07, C.white, mastX, castleTop + 0.1, 0),
    bulb(0.007, C.lampWhite, mastX, castleTop + 0.136, 0),
  )
  for (const z of [-0.035, 0.035]) {
    const winch = cyl(0.011, 0.011, 0.03, C.iron, fore + 0.07, castleTop + 0.011, z, 10)
    winch.rotation.x = Math.PI / 2
    g.add(winch)
  }

  // A house of several decks, each with a band of windows, under a bridge that is wider than the house.
  const tower = (cx: number, len: number, width: number, height: number): number => {
    const top = DECK + height
    g.add(rbox(len, height, width, C.white, cx, DECK + height / 2, 0, 0.018))
    for (let y = top - 0.036; y > DECK + 0.04; y -= 0.068) {
      g.add(
        pane(len * 0.8, 0.017, 0.006, cx, y, width / 2 + 0.001),
        pane(0.006, 0.017, width * 0.8, cx + len / 2 + 0.001, y, 0),
      )
    }
    const bridge = cx + len * 0.16
    g.add(
      rbox(len * 0.62, 0.04, width + 0.09, C.white, bridge, top + 0.02, 0, 0.012),
      chip(len * 0.62 + 0.005, 0.017, width + 0.095, C.glass, bridge, top + 0.023, 0),
      rbox(len * 0.68, 0.008, width + 0.1, C.white, bridge, top + 0.044, 0, 0.003),
    )
    for (const z of [-width * 0.24, width * 0.24]) g.add(ball(0.013, C.white, cx - len * 0.12, top + 0.054, z))
    return top + 0.048
  }
  let radarAt = new THREE.Vector3()
  let stack = [0, 0, 0]
  const mast = (x: number, roof: number, height: number): void => {
    g.add(cyl(0.004, 0.006, height, C.rope, x, roof + height / 2, 0, 8), chip(0.008, 0.008, 0.06, C.rope, x, roof + height * 0.6, 0))
    radarAt = new THREE.Vector3(x, roof + height + 0.004, 0)
  }
  const funnel = (x: number, base: number, h: number): void => {
    stack = [x, base + h + 0.03, 0]
    if (rig.funnel === 0) {
      g.add(
        inLine(cyl(0.036, 0.044, h, C.navy, x, base + h / 2, 0)),
        inTrim(cyl(0.0405, 0.0425, h * 0.28, C.white, x, base + h * 0.64, 0)),
        cyl(0.03, 0.034, 0.012, C.iron, x, base + h + 0.004, 0),
      )
    } else if (rig.funnel === 1) {
      g.add(
        inLine(rbox(0.09, h, 0.076, C.navy, x, base + h / 2, 0, 0.016)),
        inTrim(chip(0.094, h * 0.28, 0.08, C.white, x, base + h * 0.64, 0)),
        chip(0.066, 0.012, 0.052, C.iron, x, base + h + 0.004, 0),
      )
    } else {
      for (const z of [-0.03, 0.03]) {
        g.add(
          inLine(cyl(0.017, 0.021, h, C.navy, x, base + h / 2, z, 12)),
          inTrim(cyl(0.0205, 0.022, h * 0.24, C.white, x, base + h * 0.66, z, 12)),
          cyl(0.013, 0.014, 0.01, C.iron, x, base + h + 0.003, z, 10),
        )
      }
      g.add(chip(0.022, 0.012, 0.06, C.white, x, base + h * 0.3, 0))
    }
  }
  const lifeboat = (x: number, y: number, z: number): void => {
    const boat = ball(0.016, C.orange, x, y, z + 0.016)
    boat.scale.set(2.3, 1, 1)
    g.add(boat, chip(0.07, 0.008, 0.012, C.white, x, y + 0.02, z + 0.006))
  }
  // Deck crane of a geared ship, topped up out of the way while the port's cranes work.
  const derrick = (x: number, base: number, lean: number): void => {
    g.add(
      cyl(0.02, 0.026, 0.17, C.white, x, base + 0.085, 0, 14),
      rbox(0.056, 0.05, 0.062, C.cream, x, base + 0.195, 0, 0.012),
      chip(0.006, 0.02, 0.04, C.glass, x + Math.sign(lean) * 0.029, base + 0.2, 0),
      chip(0.022, 0.014, 0.044, C.iron, x + lean, base + 0.45, 0),
      bar([x + lean, base + 0.44, 0], [x + lean, base + 0.3, 0], 0.0025, C.iron, 5),
      chip(0.016, 0.02, 0.016, C.signalYellow, x + lean, base + 0.295, 0),
    )
    for (const z of [-0.014, 0.014]) g.add(inTrim(bar([x, base + 0.2, z], [x + lean, base + 0.45, z], 0.007, C.white)))
  }

  if (rig.plan === 'aft' || rig.plan === 'geared') {
    const height = cargo + 0.07
    const roof = tower(stern + 0.23, 0.28, beam - 0.06, height)
    funnel(stern + 0.135, DECK + height, 0.1)
    mast(stern + 0.3, roof, 0.05)
    lifeboat(stern + 0.2, DECK + height * 0.5, beam / 2 - 0.03)
    if (rig.plan === 'geared') {
      derrick(stern + 0.53, DECK, 0.05)
      derrick(fore + 0.07, castleTop, 0.05)
    }
  } else if (rig.plan === 'mid') {
    const height = cargo + 0.08
    const roof = tower(stern + 0.81, 0.26, beam - 0.05, height)
    funnel(stern + 0.725, DECK + height, 0.09)
    mast(stern + 0.87, roof, 0.05)
    lifeboat(stern + 0.79, DECK + height * 0.45, beam / 2 - 0.025)
    g.add(
      cyl(0.004, 0.006, 0.1, C.white, stern + 0.1, DECK + 0.05, 0, 8),
      bulb(0.006, C.lampWhite, stern + 0.1, DECK + 0.105, 0),
      chip(0.05, 0.02, 0.05, C.iron, stern + 0.17, DECK + 0.01, 0),
    )
  } else {
    g.add(rbox(0.17, 0.16, beam * 0.6, C.white, stern + 0.24, DECK + 0.08, 0, 0.018))
    g.add(pane(0.12, 0.017, 0.006, stern + 0.24, DECK + 0.115, beam * 0.3 + 0.001))
    funnel(stern + 0.24, DECK + 0.16, 0.19)
    const roof = tower(stern + 1.09, 0.2, beam - 0.04, cargo + 0.09)
    mast(stern + 1.11, roof, 0.04)
    lifeboat(stern + 0.24, DECK + 0.06, beam * 0.3)
  }

  const body = fuse(g)
  const radar = rbox(0.07, 0.008, 0.012, C.rope, radarAt.x, radarAt.y, radarAt.z, 0.003)
  radar.name = 'radar'
  body.add(radar)
  // Where the smoke comes out.
  body.userData.stack = stack
  return body
}

const protos = new Map<string, THREE.Group>()

// The hull, house and gear of a ship, without cargo. `paint` are a ship's own two colours;
// without them the copy keeps the stand-ins, which is all a blueprint needs.
export function shipBody(
  spec: ShipClass, rig: Rig = rigFor(spec), paint?: { line: THREE.Material; trim: THREE.Material },
): THREE.Group {
  if (!protos.has(rig.key)) protos.set(rig.key, build(spec, rig))
  const body = protos.get(rig.key)!.clone(true)
  if (paint) {
    body.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (mesh.material === LINE) mesh.material = paint.line
      if (mesh.material === TRIM) mesh.material = paint.trim
    })
  }
  return body
}
