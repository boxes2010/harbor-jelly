import * as THREE from 'three/webgpu'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { C, FINISH, FORM } from './style'

// The cut block the port sits on. The quay runs west from the town, long enough for four berths.
export const BLOCK = { x0: -14.6, x1: 8, z0: -1.2, z1: 1.1 }
export const QUAY_Z = 0
export const QUAY_TOP = 0.14
export const SEABED = -0.25
export const TERMINAL_X1 = 3.9

export const BOX = { l: 0.18, h: 0.08, w: 0.08 }
export const LIVERIES = [
  C.signalRed, C.signalBlue, C.amber, C.green, C.cream,
  C.violet, C.orange, C.navy, C.teal, C.berry,
]

export const BOX_GEO = new RoundedBoxGeometry(BOX.l, BOX.h, BOX.w, FORM.cornerSegments, 0.012)

const materials = new Map<string, THREE.MeshStandardMaterial>()
// Materials from mat(): plain paint, which fuse() can bake into vertex colours.
const plain = new WeakSet<THREE.Material>()

export function mat(color: string, roughness = FINISH.matte, metalness = 0): THREE.MeshStandardMaterial {
  const key = `${color}|${roughness}|${metalness}`
  let m = materials.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness })
    materials.set(key, m)
    plain.add(m)
  }
  return m
}

// White and warm lamps are lighting, which comes up at dusk. Coloured lamps are signals and always burn.
const lighting: { material: THREE.MeshStandardMaterial; full: number }[] = []
// Windows light up in two lots, one after the other, as it gets dark.
const windows = [0, 1].map(() => new THREE.MeshStandardMaterial({
  color: C.glass, emissive: C.windowGlow, emissiveIntensity: 0, roughness: FINISH.matte,
}))

export function glow(color: string, intensity = 1.5): THREE.MeshStandardMaterial {
  const key = `glow|${color}|${intensity}`
  let m = materials.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity })
    materials.set(key, m)
    if (color === C.lampWarm || color === C.lampWhite) lighting.push({ material: m, full: intensity })
  }
  return m
}

// A window that is lit at night. `late` ones come on after the rest.
export function pane(w: number, h: number, d: number, x = 0, y = 0, z = 0, late = false): THREE.Mesh {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * 0.22), windows[late ? 1 : 0])
  mesh.receiveShadow = true
  mesh.position.set(x, y, z)
  return mesh
}

// How dark it is, from 0 by day to 1 at night: sets every lamp and lit window.
export function nightfall(night: number): void {
  for (const { material, full } of lighting) material.emissiveIntensity = full * (0.45 + 0.75 * night)
  windows[0].emissiveIntensity = 1.3 * smooth((night - 0.25) / 0.3)
  windows[1].emissiveIntensity = 1.3 * smooth((night - 0.5) / 0.3)
}

// A small lamp: the one kind of thing that glows.
export function bulb(r: number, color: string, x = 0, y = 0, z = 0, intensity = 1.5): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), glow(color, intensity))
  mesh.position.set(x, y, z)
  return mesh
}

function lit<T extends THREE.Mesh>(mesh: T): T {
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export function rbox(
  w: number, h: number, d: number, color: string,
  x = 0, y = 0, z = 0, radius?: number,
): THREE.Mesh {
  const r = radius ?? Math.min(w, h, d) * FORM.cornerRatio
  const mesh = lit(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, FORM.cornerSegments, r), mat(color)))
  mesh.position.set(x, y, z)
  return mesh
}

// A small rounded box for details a few pixels across: the same soft corners with far fewer faces.
export function chip(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0): THREE.Mesh {
  const r = Math.min(w, h, d) * 0.22
  const mesh = lit(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 1, r), mat(color)))
  mesh.position.set(x, y, z)
  return mesh
}

export function slab(
  x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: string,
): THREE.Mesh {
  const mesh = lit(new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat(color, FINISH.ground)))
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  return mesh
}

export function cyl(
  rTop: number, rBottom: number, h: number, color: string,
  x = 0, y = 0, z = 0, segments = FORM.curveSegments,
): THREE.Mesh {
  const mesh = lit(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), mat(color)))
  mesh.position.set(x, y, z)
  return mesh
}

export function ball(r: number, color: string, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = lit(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat(color)))
  mesh.position.set(x, y, z)
  return mesh
}

export function cone(r: number, h: number, color: string, x = 0, y = 0, z = 0, segments = FORM.curveSegments): THREE.Mesh {
  const mesh = lit(new THREE.Mesh(new THREE.ConeGeometry(r, h, segments), mat(color)))
  mesh.position.set(x, y, z)
  return mesh
}

export function torus(r: number, thickness: number, color: string, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = lit(new THREE.Mesh(new THREE.TorusGeometry(r, thickness, 8, 16), mat(color)))
  mesh.position.set(x, y, z)
  return mesh
}

// Lays a unit-high cylinder between two points.
export function stretch(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3): void {
  const dir = b.clone().sub(a)
  mesh.position.copy(a).addScaledVector(dir, 0.5)
  mesh.scale.set(1, dir.length(), 1)
  mesh.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, dir.normalize())
}

// A round bar from a to b: struts, braces, masts, jibs.
export function bar(a: [number, number, number], b: [number, number, number], r: number, color: string, segments = 8): THREE.Mesh {
  const mesh = cyl(r, r, 1, color, 0, 0, 0, segments)
  stretch(mesh, new THREE.Vector3(...a), new THREE.Vector3(...b))
  return mesh
}

// An outline in x and y, pushed out along z and bevelled: gables, roofs, wedges.
export function prism(points: [number, number][], depth: number, color: string, bevel = 0.006): THREE.Mesh {
  const shape = new THREE.Shape()
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)))
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - bevel * 2), bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3,
  })
  geo.translate(0, 0, -depth / 2 + bevel)
  return lit(new THREE.Mesh(geo, mat(color)))
}

const paints = new Map<string, THREE.MeshStandardMaterial>()

// Bakes a finished model that has no moving parts into a handful of meshes: every plainly painted part becomes
// one mesh coloured by its vertices, and the parts sharing any other material become one mesh each.
// The detail then costs a few draw calls however many pieces went into it.
export function fuse(source: THREE.Object3D): THREE.Group {
  source.updateMatrixWorld(true)
  const toLocal = source.matrixWorld.clone().invert()
  const lots = new Map<THREE.Material, { parts: THREE.BufferGeometry[]; shadow: boolean; creased: boolean }>()
  const color = new THREE.Color()
  source.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh || (object as THREE.InstancedMesh).isInstancedMesh || Array.isArray(mesh.material)) return
    const material = mesh.material as THREE.MeshStandardMaterial
    const part = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
    part.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toLocal, mesh.matrixWorld))
    for (const name of Object.keys(part.attributes)) {
      if (name !== 'position' && name !== 'normal') part.deleteAttribute(name)
    }
    let target: THREE.Material = material
    if (plain.has(material)) {
      color.copy(material.color)
      const colors = new Float32Array(part.attributes.position.count * 3)
      for (let i = 0; i < colors.length; i += 3) colors.set([color.r, color.g, color.b], i)
      part.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      const key = `${material.roughness}|${mesh.castShadow}`
      if (!paints.has(key)) paints.set(key, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: material.roughness }))
      target = paints.get(key)!
    }
    if (!lots.has(target)) lots.set(target, { parts: [], shadow: mesh.castShadow, creased: false })
    const lot = lots.get(target)!
    lot.parts.push(part)
    lot.creased ||= mesh.geometry.type === 'ExtrudeGeometry'
  })
  const fused = new THREE.Group()
  for (const [material, lot] of lots) {
    const mesh = new THREE.Mesh(mergeGeometries(lot.parts), material)
    // Hard edges from extruded parts: an outline drawn round this mesh has to smooth them first.
    mesh.geometry.userData.creased = lot.creased
    mesh.castShadow = lot.shadow
    mesh.receiveShadow = true
    fused.add(mesh)
  }
  fused.position.copy(source.position)
  fused.quaternion.copy(source.quaternion)
  fused.scale.copy(source.scale)
  return fused
}

export function hull(
  length: number, beam: number, freeboard: number, draft: number,
  topColor: string, bottomColor: string,
): THREE.Group {
  const shape = new THREE.Shape()
  const l = length / 2
  const b = beam / 2
  shape.moveTo(-l, -b * 0.8)
  shape.lineTo(l * 0.35, -b)
  shape.quadraticCurveTo(l * 0.85, -b, l, 0)
  shape.quadraticCurveTo(l * 0.85, b, l * 0.35, b)
  shape.lineTo(-l, b * 0.8)
  shape.quadraticCurveTo(-l * 1.06, 0, -l, -b * 0.8)

  const bevel = Math.min(beam, freeboard) * 0.12
  const part = (depth: number, color: string, y: number) => {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 12,
    })
    geo.rotateX(-Math.PI / 2)
    const mesh = lit(new THREE.Mesh(geo, mat(color, FINISH.hull)))
    mesh.position.y = y
    return mesh
  }
  const group = new THREE.Group()
  group.add(part(freeboard, topColor, 0), part(draft, bottomColor, -draft))
  return group
}

export function rand(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export function smooth(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}
