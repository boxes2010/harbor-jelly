import * as THREE from 'three/webgpu'
import { BLOCK, QUAY_Z, SEABED, ball, mat, rand, smooth } from './kit'
import { C } from './style'

const random = rand(99)

interface School {
  mesh: THREE.InstancedMesh
  phase: number
  cx: number
  rangeX: number
  offsets: Float32Array
}

export class Life {
  readonly group = new THREE.Group()
  private schools: School[] = []
  private gulls: { body: THREE.Group; wings: THREE.Mesh[]; cx: number; r: number; phase: number; y: number }[] = []
  private jellies: { mesh: THREE.Mesh; x: number; z: number; phase: number }[] = []
  private time = 0
  private dummy = new THREE.Object3D()

  constructor() {
    const fishGeo = new THREE.SphereGeometry(1, 10, 8)
    fishGeo.scale(0.024, 0.009, 0.006)
    const kinds: [string, number, number][] = [
      [C.herring, 24, -11.5], [C.mackerel, 30, -7], [C.wrasse, 14, -3], [C.herring, 26, 0.5], [C.wrasse, 14, 4.5],
    ]
    for (const [color, count, cx] of kinds) {
      const mesh = new THREE.InstancedMesh(fishGeo, mat(color, 0.4), count)
      mesh.frustumCulled = false
      const offsets = new Float32Array(count * 4)
      for (let i = 0; i < offsets.length; i++) offsets[i] = random()
      this.schools.push({ mesh, phase: random() * 10, cx, rangeX: 1.6 + random(), offsets })
      this.group.add(mesh)
    }

    const bell = new THREE.SphereGeometry(0.028, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(bell, new THREE.MeshStandardMaterial({
        color: C.jellyBell, emissive: C.jellyGlow, emissiveIntensity: 0.25, roughness: 0.3, side: THREE.DoubleSide,
      }))
      this.jellies.push({ mesh, x: -12.4 + i * 2.7, z: 0.75 + random() * 0.2, phase: random() * 6 })
      this.group.add(mesh)
    }

    const wingGeo = new THREE.BoxGeometry(0.012, 0.003, 0.05)
    wingGeo.translate(0, 0, 0.025)
    for (let i = 0; i < 10; i++) {
      const body = new THREE.Group()
      const torso = ball(0.012, C.white)
      torso.scale.set(1.8, 0.9, 0.9)
      body.add(torso)
      const wings = [1, -1].map((s) => {
        const wing = new THREE.Mesh(wingGeo, mat(C.gullGrey))
        wing.scale.z = s
        wing.castShadow = true
        body.add(wing)
        return wing
      })
      this.gulls.push({ body, wings, cx: -13 + i * 2.2, r: 0.3 + random() * 0.4, phase: random() * 6, y: 0.58 + random() * 0.2 })
      this.group.add(body)
    }
  }

  // `night` runs from 0 by day to 1 at night: the gulls fly off at dusk and the jellies glow brighter.
  update(dt: number, night = 0): void {
    this.time += dt
    const t = this.time
    const d = this.dummy

    for (const school of this.schools) {
      const st = t * 0.11 + school.phase
      const sx = school.cx + Math.sin(st) * school.rangeX
      const sz = 0.6 + Math.sin(st * 1.7) * 0.25
      const sy = -0.13 + Math.sin(st * 2.3) * 0.04
      const heading = Math.cos(st) >= 0 ? 0 : Math.PI
      for (let i = 0; i < school.mesh.count; i++) {
        const o = school.offsets
        const wobble = t * (0.6 + o[i * 4 + 3] * 0.5) + o[i * 4] * 20
        d.position.set(
          sx + (o[i * 4] - 0.5) * 0.9 + Math.sin(wobble) * 0.05,
          Math.max(SEABED + 0.03, Math.min(-0.04, sy + (o[i * 4 + 1] - 0.5) * 0.14 + Math.sin(wobble * 1.3) * 0.02)),
          Math.max(QUAY_Z + 0.08, Math.min(BLOCK.z1 - 0.06, sz + (o[i * 4 + 2] - 0.5) * 0.35)),
        )
        d.rotation.set(0, heading + Math.sin(wobble * 6) * 0.25, 0)
        d.scale.setScalar(0.8 + o[i * 4 + 3] * 0.5)
        d.updateMatrix()
        school.mesh.setMatrixAt(i, d.matrix)
      }
      school.mesh.instanceMatrix.needsUpdate = true
    }

    for (const j of this.jellies) {
      const pulse = Math.sin(t * 1.6 + j.phase)
      j.mesh.position.set(j.x + Math.sin(t * 0.07 + j.phase) * 0.6, -0.13 + Math.sin(t * 0.21 + j.phase) * 0.05, j.z)
      j.mesh.scale.set(1 - pulse * 0.12, 1 + pulse * 0.18, 1 - pulse * 0.12)
      ;(j.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.25 + night * (0.9 + pulse * 0.25)
    }

    const gone = smooth((night - 0.45) / 0.4)
    for (const g of this.gulls) {
      const a = t * 0.5 + g.phase
      g.body.visible = gone < 1
      g.body.position.set(g.cx + Math.cos(a) * g.r * 1.6, g.y + Math.sin(a * 0.7) * 0.05 + gone * 1.2, -0.3 + Math.sin(a) * g.r)
      g.body.rotation.set(0.25, -a - Math.PI / 2, 0, 'YXZ')
      const flap = Math.sin(t * 7 + g.phase) * 0.5
      g.wings[0].rotation.x = -flap
      g.wings[1].rotation.x = flap
    }
  }
}
