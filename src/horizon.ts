import * as THREE from 'three/webgpu'
import { rand } from './kit'
import type { Look } from './sim/game'

// What stands on the horizon behind each famous harbour, as outlines for paper cut-outs. One unit is the
// height of the strip, and 0 is its middle: only what rises above about 0.23 clears the port in front.
type Outline = [number, number][]
export interface Horizon {
  far: THREE.BufferGeometry[]
  near: THREE.BufferGeometry[]
  snow: THREE.BufferGeometry[]
}

const cut = (points: Outline): THREE.BufferGeometry =>
  new THREE.ShapeGeometry(new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y))))
const block = (x: number, w: number, top: number): THREE.BufferGeometry => cut([[x, 0], [x + w, 0], [x + w, top], [x, top]])
const strip = (a: [number, number], b: [number, number], w: number): THREE.BufferGeometry =>
  cut([[a[0] - w, a[1]], [a[0] + w, a[1]], [b[0] + w, b[1]], [b[0] - w, b[1]]])
const WIDE = 4.2

// A line of hills from one side of the sky to the other.
function ridge(random: () => number, low: number, high: number, step: number): THREE.BufferGeometry {
  const points: Outline = [[-WIDE, 0]]
  let y = (low + high) / 2
  for (let x = -WIDE; x <= WIDE; x += step) {
    y = Math.min(high, Math.max(low, y + (random() - 0.5) * (high - low) * 0.5))
    points.push([x, y])
  }
  points.push([WIDE, 0])
  return cut(points)
}

// A city's worth of towers.
function towers(random: () => number, from: number, to: number, low: number, high: number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = []
  for (let x = from; x < to;) {
    const w = 0.03 + random() * 0.05
    const top = low + random() ** 2 * (high - low)
    parts.push(block(x, w, top))
    if (random() < 0.25) parts.push(block(x + w * 0.42, w * 0.16, top + 0.02 + random() * 0.03))
    x += w + random() * 0.02
  }
  return parts
}

function windmill(x: number, h: number): THREE.BufferGeometry[] {
  const parts = [cut([[x - h * 0.035, 0.2], [x + h * 0.035, 0.2], [x + h * 0.012, 0.2 + h], [x - h * 0.012, 0.2 + h]])]
  for (let k = 0; k < 3; k++) {
    const turn = 0.5 + (k / 3) * Math.PI * 2
    const tip: [number, number] = [x + Math.cos(turn) * h * 0.55, 0.2 + h + Math.sin(turn) * h * 0.55]
    parts.push(strip([x, 0.2 + h], tip, h * 0.018))
  }
  return parts
}

function palmTree(x: number, h: number): THREE.BufferGeometry[] {
  const top = 0.2 + h
  const parts = [strip([x, 0.2], [x + h * 0.06, top], h * 0.016)]
  for (let k = 0; k < 7; k++) {
    const turn = (k / 6) * Math.PI
    parts.push(cut([[x + h * 0.06, top], [x + h * 0.06 + Math.cos(turn) * h * 0.2, top + Math.sin(turn) * h * 0.1 - h * 0.05], [x + h * 0.06 + Math.cos(turn) * h * 0.1, top + Math.sin(turn) * h * 0.1]]))
  }
  return parts
}

export const HORIZONS: Partial<Record<Look, () => Horizon>> = {
  // Mount Fuji over the bay, behind a line of low hills.
  yokohama: () => ({
    far: [cut([
      [-0.85, 0], [-0.52, 0.17], [-0.3, 0.27], [-0.16, 0.36], [-0.07, 0.43], [-0.045, 0.447], [0, 0.44], [0.045, 0.448], [0.07, 0.43],
      [0.16, 0.36], [0.3, 0.27], [0.52, 0.17], [0.85, 0],
    ])],
    snow: [cut([
      [-0.15, 0.366], [-0.11, 0.386], [-0.082, 0.362], [-0.048, 0.392], [-0.018, 0.366], [0.02, 0.394], [0.05, 0.364], [0.085, 0.39],
      [0.118, 0.37], [0.15, 0.366], [0.07, 0.43], [0.045, 0.448], [0, 0.44], [-0.045, 0.447], [-0.07, 0.43],
    ])],
    near: [ridge(rand(5), 0.215, 0.262, 0.11)],
  }),
  // The city without end: towers to the horizon, and the three tallest among them.
  shanghai: () => {
    const random = rand(9)
    return {
      far: [...towers(random, -WIDE, WIDE, 0.23, 0.36), block(-0.62, 0.05, 0.42), block(-0.6, 0.012, 0.455), block(-0.36, 0.06, 0.4), cut([[-0.2, 0], [-0.13, 0], [-0.15, 0.44], [-0.185, 0.43]])],
      near: towers(random, -WIDE, WIDE, 0.2, 0.275),
      snow: [],
    }
  },
  // Flat land under a big sky: the bridge with its bent pylon, the stacked towers beside it, and turbines.
  rotterdam: () => {
    const random = rand(13)
    const cables: THREE.BufferGeometry[] = []
    for (let k = 0; k < 8; k++) cables.push(strip([0.165 + k * 0.004, 0.41 - k * 0.012], [-0.08 - k * 0.07, 0.25], 0.0016))
    return {
      far: [...towers(random, -WIDE, -0.9, 0.215, 0.27), ...towers(random, 0.9, WIDE, 0.215, 0.26), ...[-2.4, -1.9, -1.45, 1.5, 2.1, 2.6].flatMap((x) => windmill(x, 0.16))],
      near: [
        block(-WIDE, WIDE * 2, 0.222),
        cut([[0.21, 0.22], [0.245, 0.22], [0.2, 0.42], [0.17, 0.425]]), cut([[0.25, 0.25], [0.262, 0.25], [0.2, 0.42], [0.19, 0.42]]),
        ...cables, block(-0.75, 1.35, 0.25), block(0.42, 0.05, 0.37), block(0.475, 0.05, 0.4), block(0.53, 0.05, 0.36),
      ],
      snow: [],
    }
  },
  // The mountains behind the basin, the downtown towers in front of them, and palms along the shore.
  losangeles: () => {
    const random = rand(17)
    return {
      far: [ridge(random, 0.29, 0.4, 0.16)],
      near: [...towers(random, -0.75, -0.2, 0.25, 0.36), block(-0.5, 0.05, 0.4), block(-0.487, 0.024, 0.415), ...[-2.6, -2.2, -1.5, -1.2, 0.3, 0.6, 1.4, 1.75, 2.5].flatMap((x) => palmTree(x, 0.12 + random() * 0.07)), block(-WIDE, WIDE * 2, 0.215)],
      snow: [],
    }
  },
}
