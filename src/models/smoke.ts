import * as THREE from 'three/webgpu'
import { C } from '../style'

const PUFFS = 40
const LIFE = 2.4

// Funnel smoke: soft white puffs that rise, swell and shrink away.
export class Smoke {
  readonly mesh: THREE.InstancedMesh
  private puffs = Array.from({ length: PUFFS }, () => ({ at: new THREE.Vector3(), age: LIFE }))
  private next = 0
  private dummy = new THREE.Object3D()

  constructor() {
    this.mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: C.white, roughness: 1 }), PUFFS,
    )
    this.mesh.frustumCulled = false
    this.update(0)
  }

  emit(at: THREE.Vector3): void {
    const puff = this.puffs[this.next]
    this.next = (this.next + 1) % PUFFS
    puff.at.copy(at)
    puff.age = 0
  }

  update(dt: number): void {
    this.puffs.forEach((puff, i) => {
      puff.age = Math.min(LIFE, puff.age + dt)
      const t = puff.age / LIFE
      puff.at.y += dt * 0.09
      puff.at.x -= dt * (0.02 + 0.01 * (i % 3))
      this.dummy.position.copy(puff.at)
      this.dummy.scale.setScalar(0.034 * Math.sin(Math.PI * Math.sqrt(t)))
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
    })
    this.mesh.instanceMatrix.needsUpdate = true
  }
}
