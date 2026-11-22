import * as THREE from 'three/webgpu'
import { normalLocal, positionLocal, uniform } from 'three/tsl'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { BOX_GEO } from '../kit'
import { C } from '../style'

// Blueprint look: a pale see-through body inside a bright outline.
// The outline is the model's back faces, pushed out along their normals.
const width = uniform(0.013)

function rimMaterial(overlay: boolean): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial({
    color: C.blueprint, side: THREE.BackSide, depthTest: !overlay, depthWrite: !overlay,
  })
  material.positionNode = positionLocal.add(normalLocal.mul(width))
  return material
}
function fillMaterial(overlay: boolean): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: C.blueprintFill, transparent: true, opacity: 0.5, depthTest: !overlay, depthWrite: false,
  })
}
// Overlay materials ignore depth, so a small blueprint is never hidden behind a crane or a stack.
const rims = { solid: rimMaterial(false), overlay: rimMaterial(true) }
const fills = { solid: fillMaterial(false), overlay: fillMaterial(true) }

// Extruded shapes have a separate normal on every face, which would split the outline at each edge.
const smoothed = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>()
function rimGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  if (geometry.type !== 'ExtrudeGeometry' && !geometry.userData.creased) return geometry
  let smooth = smoothed.get(geometry)
  if (!smooth) {
    const bare = geometry.clone()
    for (const name of Object.keys(bare.attributes)) if (name !== 'position') bare.deleteAttribute(name)
    smooth = mergeVertices(bare, 1e-4)
    smooth.computeVertexNormals()
    smoothed.set(geometry, smooth)
  }
  return smooth
}

function rim(mesh: THREE.Mesh, overlay: boolean): THREE.Mesh {
  const shell = new THREE.Mesh(rimGeometry(mesh.geometry), overlay ? rims.overlay : rims.solid)
  shell.userData.rim = true
  if (overlay) shell.renderOrder = 998
  mesh.add(shell)
  return shell
}

function meshesOf(object: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = []
  object.traverseVisible((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh && !(o as THREE.InstancedMesh).isInstancedMesh && !o.userData.rim) meshes.push(mesh)
  })
  return meshes
}

// A blueprint copy of a model, for something that is not built yet.
// With `overlay` it shows through whatever stands in front of it.
export function blueprint(source: THREE.Object3D, overlay: boolean): THREE.Object3D {
  const copy = source.clone(true)
  for (const mesh of meshesOf(copy)) {
    mesh.material = overlay ? fills.overlay : fills.solid
    mesh.castShadow = false
    mesh.receiveShadow = false
    if (overlay) mesh.renderOrder = 999
    rim(mesh, overlay)
  }
  return copy
}

// Outlines a machine that already exists. Returns the outlines so they can be taken off again.
export function outline(object: THREE.Object3D): THREE.Mesh[] {
  return meshesOf(object).filter((mesh) => mesh.geometry !== BOX_GEO).map((mesh) => rim(mesh, false))
}

export function pulse(time: number): void {
  const beat = 0.5 + 0.5 * Math.sin(time * 5)
  width.value = 0.011 + 0.006 * beat
  fills.solid.opacity = fills.overlay.opacity = 0.34 + 0.2 * beat
}
