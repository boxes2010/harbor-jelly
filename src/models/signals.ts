import * as THREE from 'three/webgpu'
import { ball, bar, bulb, chip, cone, cyl, fuse } from '../kit'
import { C } from '../style'

// The storm signal station on the quay: a mast and yard. `shapes` are hoisted while a typhoon is on its way
// or overhead: two cones point to point and a ball by day, two red lamps by night.
export function stormMast(): { group: THREE.Group; shapes: THREE.Object3D } {
  const g = new THREE.Group()
  g.add(
    chip(0.08, 0.03, 0.08, C.concrete, 0, 0.015, 0),
    cyl(0.006, 0.01, 0.52, C.white, 0, 0.28, 0, 8),
    bar([-0.11, 0.42, 0], [0.11, 0.42, 0], 0.004, C.white, 6),
    bar([-0.11, 0.42, 0], [0, 0.53, 0], 0.0015, C.rope, 4),
    bar([0.11, 0.42, 0], [0, 0.53, 0], 0.0015, C.rope, 4),
    cyl(0.013, 0.013, 0.006, C.signalRed, 0, 0.543, 0, 10),
  )
  const hoist = new THREE.Group()
  hoist.add(
    cone(0.027, 0.046, C.rubber, -0.09, 0.372, 0, 12),
    cone(0.027, 0.046, C.rubber, -0.09, 0.322, 0, 12).rotateX(Math.PI),
    ball(0.025, C.rubber, 0.09, 0.345, 0),
    bar([-0.09, 0.42, 0], [-0.09, 0.3, 0], 0.0015, C.rope, 4),
    bar([0.09, 0.42, 0], [0.09, 0.32, 0], 0.0015, C.rope, 4),
    bulb(0.012, C.lampRed, 0, 0.49, 0.008, 2.5),
    bulb(0.012, C.lampRed, 0, 0.455, 0.008, 2.5),
  )
  const group = fuse(g)
  const shapes = fuse(hoist)
  group.add(shapes)
  return { group, shapes }
}

// A tide pole in the water off the quay: the bands show how the water stands, and the lamp on top whether
// the deepest ships may move, green, or must wait for the flood, red.
export function tidePole(): { group: THREE.Group; open: THREE.Object3D; shut: THREE.Object3D } {
  const g = new THREE.Group()
  for (let k = 0; k < 9; k++) g.add(cyl(0.013, 0.013, 0.03, k % 2 ? C.white : C.signalRed, 0, -0.12 + k * 0.03, 0, 10))
  g.add(cyl(0.018, 0.018, 0.008, C.iron, 0, 0.139, 0, 10), cyl(0.004, 0.004, 0.04, C.iron, 0, 0.16, 0, 6))
  const group = fuse(g)
  const open = bulb(0.012, C.lampGreen, 0, 0.19, 0, 2.5)
  const shut = bulb(0.012, C.lampRed, 0, 0.19, 0, 2.5)
  group.add(open, shut)
  return { group, open, shut }
}
