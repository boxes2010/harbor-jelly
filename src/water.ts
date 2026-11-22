import * as THREE from 'three/webgpu'
import { BLOCK, QUAY_Z, SEABED } from './kit'
import { C } from './style'

// One column of the height field about every 6 cm along the block.
const NX = Math.round((BLOCK.x1 - BLOCK.x0) / 0.0618) + 1
const NZ = 17
const WAVE_SPEED = 1.6
const STEP = 1 / 60

export class Water {
  readonly mesh: THREE.Mesh
  readonly meniscus: THREE.Line
  private h = new Float32Array(NX * NZ)
  private v = new Float32Array(NX * NZ)
  private positions: THREE.BufferAttribute
  private normals: THREE.BufferAttribute
  private rim: THREE.BufferAttribute
  private dx = (BLOCK.x1 - BLOCK.x0) / (NX - 1)
  private dz = (BLOCK.z1 - QUAY_Z) / (NZ - 1)
  private frontStart = NX * NZ
  private leftStart = this.frontStart + NX * 2
  private rightStart = this.leftStart + NZ * 2
  private carry = 0
  // How far the whole surface stands above or below its usual level: the tide.
  level = 0

  constructor() {
    const count = this.rightStart + NZ * 2
    const pos = new Float32Array(count * 3)
    const nor = new Float32Array(count * 3)
    const index: number[] = []
    const px = (i: number) => BLOCK.x0 + i * this.dx
    const pz = (j: number) => QUAY_Z + j * this.dz
    const put = (n: number, x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
      pos.set([x, y, z], n * 3)
      nor.set([nx, ny, nz], n * 3)
    }

    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) put(j * NX + i, px(i), 0, pz(j), 0, 1, 0)
    }
    for (let j = 0; j < NZ - 1; j++) {
      for (let i = 0; i < NX - 1; i++) {
        const a = j * NX + i
        index.push(a, a + NX, a + 1, a + 1, a + NX, a + NX + 1)
      }
    }
    for (let i = 0; i < NX; i++) {
      put(this.frontStart + i * 2, px(i), 0, BLOCK.z1, 0, 0, 1)
      put(this.frontStart + i * 2 + 1, px(i), SEABED, BLOCK.z1, 0, 0, 1)
      if (i < NX - 1) {
        const a = this.frontStart + i * 2
        index.push(a, a + 1, a + 2, a + 2, a + 1, a + 3)
      }
    }
    for (let j = 0; j < NZ; j++) {
      put(this.leftStart + j * 2, BLOCK.x0, 0, pz(j), -1, 0, 0)
      put(this.leftStart + j * 2 + 1, BLOCK.x0, SEABED, pz(j), -1, 0, 0)
      put(this.rightStart + j * 2, BLOCK.x1, 0, pz(j), 1, 0, 0)
      put(this.rightStart + j * 2 + 1, BLOCK.x1, SEABED, pz(j), 1, 0, 0)
      if (j < NZ - 1) {
        const l = this.leftStart + j * 2
        index.push(l, l + 1, l + 2, l + 2, l + 1, l + 3)
        const r = this.rightStart + j * 2
        index.push(r, r + 2, r + 1, r + 2, r + 3, r + 1)
      }
    }

    const geo = new THREE.BufferGeometry()
    this.positions = new THREE.BufferAttribute(pos, 3)
    this.normals = new THREE.BufferAttribute(nor, 3)
    geo.setAttribute('position', this.positions)
    geo.setAttribute('normal', this.normals)
    geo.setIndex(index)

    const material = new THREE.MeshPhysicalMaterial({
      color: C.waterSurface,
      roughness: 0.06,
      transmission: 1,
      ior: 1.25,
      thickness: 0.1,
      attenuationColor: C.waterBody,
      attenuationDistance: 1.6,
      envMapIntensity: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      side: THREE.DoubleSide,
    })
    this.mesh = new THREE.Mesh(geo, material)
    this.mesh.frustumCulled = false

    this.rim = new THREE.BufferAttribute(new Float32Array(NX * 3), 3)
    for (let i = 0; i < NX; i++) this.rim.setXYZ(i, px(i), 0, BLOCK.z1 + 0.002)
    const rimGeo = new THREE.BufferGeometry()
    rimGeo.setAttribute('position', this.rim)
    this.meniscus = new THREE.Line(
      rimGeo,
      new THREE.LineBasicMaterial({ color: C.lampWhite, transparent: true, opacity: 0.85 }),
    )
    this.meniscus.frustumCulled = false
  }

  contains(x: number, z: number): boolean {
    return x > BLOCK.x0 && x < BLOCK.x1 && z > QUAY_Z && z < BLOCK.z1
  }

  disturb(x: number, z: number, amount: number, radius = 0.15): void {
    const ci = (x - BLOCK.x0) / this.dx
    const cj = (z - QUAY_Z) / this.dz
    const ri = Math.ceil(radius / this.dx) * 2
    for (let j = Math.max(0, Math.floor(cj - ri)); j <= Math.min(NZ - 1, Math.ceil(cj + ri)); j++) {
      for (let i = Math.max(0, Math.floor(ci - ri)); i <= Math.min(NX - 1, Math.ceil(ci + ri)); i++) {
        const ddx = (i - ci) * this.dx
        const ddz = (j - cj) * this.dz
        this.h[j * NX + i] += amount * Math.exp(-(ddx * ddx + ddz * ddz) / (radius * radius))
      }
    }
  }

  height(x: number, z: number): number {
    const fi = Math.min(NX - 1.001, Math.max(0, (x - BLOCK.x0) / this.dx))
    const fj = Math.min(NZ - 1.001, Math.max(0, (z - QUAY_Z) / this.dz))
    const i = Math.floor(fi)
    const j = Math.floor(fj)
    const u = fi - i
    const w = fj - j
    const a = j * NX + i
    return this.level + (
      (this.h[a] * (1 - u) + this.h[a + 1] * u) * (1 - w) +
      (this.h[a + NX] * (1 - u) + this.h[a + NX + 1] * u) * w
    )
  }

  update(dt: number): void {
    this.carry += dt
    while (this.carry >= STEP) {
      this.carry -= STEP
      this.step()
    }
    this.sync()
  }

  private step(): void {
    const { h, v } = this
    const kx = (WAVE_SPEED * WAVE_SPEED * STEP) / (this.dx * this.dx)
    const kz = (WAVE_SPEED * WAVE_SPEED * STEP) / (this.dz * this.dz)
    for (let j = 0; j < NZ; j++) {
      const jm = j > 0 ? -NX : 0
      const jp = j < NZ - 1 ? NX : 0
      for (let i = 0; i < NX; i++) {
        const a = j * NX + i
        const im = i > 0 ? -1 : 0
        const ip = i < NX - 1 ? 1 : 0
        v[a] += kx * (h[a + im] + h[a + ip] - 2 * h[a]) + kz * (h[a + jm] + h[a + jp] - 2 * h[a])
        v[a] *= 0.994
      }
    }
    for (let a = 0; a < h.length; a++) h[a] = (h[a] + v[a] * STEP) * 0.9995
  }

  private sync(): void {
    const { h, level } = this
    const pos = this.positions.array as Float32Array
    const nor = this.normals.array as Float32Array
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const a = j * NX + i
        pos[a * 3 + 1] = level + h[a]
        const sx = (h[a + (i < NX - 1 ? 1 : 0)] - h[a - (i > 0 ? 1 : 0)]) / (2 * this.dx)
        const sz = (h[a + (j < NZ - 1 ? NX : 0)] - h[a - (j > 0 ? NX : 0)]) / (2 * this.dz)
        const inv = 1 / Math.hypot(sx, 1, sz)
        nor[a * 3] = -sx * inv
        nor[a * 3 + 1] = inv
        nor[a * 3 + 2] = -sz * inv
      }
    }
    const front = (NZ - 1) * NX
    for (let i = 0; i < NX; i++) {
      pos[(this.frontStart + i * 2) * 3 + 1] = level + h[front + i]
      this.rim.setY(i, level + h[front + i])
    }
    for (let j = 0; j < NZ; j++) {
      pos[(this.leftStart + j * 2) * 3 + 1] = level + h[j * NX]
      pos[(this.rightStart + j * 2) * 3 + 1] = level + h[j * NX + NX - 1]
    }
    this.positions.needsUpdate = true
    this.normals.needsUpdate = true
    this.rim.needsUpdate = true
  }
}
