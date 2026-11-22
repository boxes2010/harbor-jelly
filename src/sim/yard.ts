import * as THREE from 'three/webgpu'
import { BOX, BOX_GEO, LIVERIES } from '../kit'
import { FINISH } from '../style'
import { BERTH_X, GROUND_Y } from './layout'
import { random } from './random'

export const YARD = {
  rows: 5, rowZ0: -0.72, rowPitch: 0.088,
  colPitch: 0.192, blockCols: 6, blockGap: 0.2, blocks: 12, x0: -13.01, maxTiers: 4,
}
export const YARD_SIZE = {
  x: (YARD.blockCols - 1) * YARD.colPitch + BOX.l,
  z: (YARD.rows - 1) * YARD.rowPitch + BOX.w,
  centerZ: YARD.rowZ0 - ((YARD.rows - 1) * YARD.rowPitch) / 2,
}
export const BLOCK_PITCH = YARD.blockCols * YARD.colPitch + YARD.blockGap
export const blockCenter = (block: number) => YARD.x0 + block * BLOCK_PITCH + YARD_SIZE.x / 2 - BOX.l / 2
// The order blocks open in when the port is left to choose: outward from the first berth.
export const UNLOCK_ORDER = Array.from({ length: YARD.blocks }, (_, block) => block)
  .sort((a, b) => Math.abs(blockCenter(a) - BERTH_X[0]) - Math.abs(blockCenter(b) - BERTH_X[0]))
// Crossings between the yard road and the apron: one at each end of every block and one at its middle.
// Traffic turns south just west of the middle of a crossing and north just east of it.
export const AISLES = Array.from({ length: YARD.blocks * 2 + 1 }, (_, k) =>
  YARD.x0 - (YARD.colPitch + YARD.blockGap) / 2 + (k * BLOCK_PITCH) / 2)
export const AISLE_TURN = 0.17
const EXPORT_ROWS = 2

export type Kind = 'import' | 'export'
export interface YardBox { color: number; kind: Kind; reserved: boolean; readyAt: number }
export interface StackRef { col: number; row: number }

export class Yard {
  readonly mesh: THREE.InstancedMesh
  tiers = 2
  blocks: number[] = []
  // Lifts queued at a block's crane; busy blocks are avoided.
  load: (block: number) => number = () => 0
  private cols: number[] = []
  private stacks: YardBox[][] = []
  private incoming: number[] = []
  private dirty = true

  constructor() {
    const total = YARD.blocks * YARD.blockCols * YARD.rows
    for (let i = 0; i < total; i++) {
      this.stacks.push([])
      this.incoming.push(0)
    }
    this.mesh = new THREE.InstancedMesh(
      BOX_GEO, new THREE.MeshStandardMaterial({ roughness: FINISH.paint }), total * YARD.maxTiers,
    )
    this.mesh.setColorAt(0, new THREE.Color())
    this.mesh.count = 0
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    this.mesh.frustumCulled = false
  }

  // The blocks the port has opened.
  setBlocks(blocks: number[]): void {
    if (blocks.length === this.blocks.length && blocks.every((block, i) => block === this.blocks[i])) return
    this.blocks = [...blocks]
    this.cols = this.blocks.flatMap((b) =>
      Array.from({ length: YARD.blockCols }, (_, i) => b * YARD.blockCols + i))
    this.dirty = true
  }

  blockOf(col: number): number {
    return Math.floor(col / YARD.blockCols)
  }

  blockX(block: number): number {
    return this.colX(block * YARD.blockCols) + ((YARD.blockCols - 1) * YARD.colPitch) / 2
  }

  posOf(ref: StackRef, box: YardBox): THREE.Vector3 {
    return this.slotPos(ref, this.stacks[this.at(ref)].indexOf(box))
  }

  colX(col: number): number {
    return YARD.x0 + Math.floor(col / YARD.blockCols) * BLOCK_PITCH + (col % YARD.blockCols) * YARD.colPitch
  }

  slotPos(ref: StackRef, tier: number): THREE.Vector3 {
    return new THREE.Vector3(this.colX(ref.col), GROUND_Y + BOX.h * (tier + 0.5), YARD.rowZ0 - ref.row * YARD.rowPitch)
  }

  private at(ref: StackRef): number {
    return ref.col * YARD.rows + ref.row
  }

  get capacity(): number {
    return this.cols.length * YARD.rows * this.tiers
  }

  // Boxes stored plus slots promised to boxes on their way.
  get committed(): number {
    let n = 0
    for (const col of this.cols) {
      for (let row = 0; row < YARD.rows; row++) {
        const i = col * YARD.rows + row
        n += this.stacks[i].length + this.incoming[i]
      }
    }
    return n
  }

  count(kind: Kind, includeReserved = true): number {
    let n = 0
    for (const stack of this.stacks) {
      for (const box of stack) if (box.kind === kind && (includeReserved || !box.reserved)) n++
    }
    return n
  }

  // Imports whose owners may collect them now, and that no truck is yet coming for.
  ready(now: number): number {
    let n = 0
    for (const stack of this.stacks) {
      for (const box of stack) if (box.kind === 'import' && !box.reserved && box.readyAt <= now) n++
    }
    return n
  }

  height(ref: StackRef): number {
    return this.stacks[this.at(ref)].length
  }

  // `far` is how long the drive to a column is, and `open` whether a vehicle could pull in beside it now.
  reserveSlot(kind: Kind, far: (col: number) => number, open: (col: number) => boolean = () => true): StackRef | null {
    let best: StackRef | null = null
    let bestScore = Infinity
    for (const col of this.cols) {
      if (!open(col)) continue
      const dx = far(col) + this.load(this.blockOf(col)) * 2.5
      for (let row = 0; row < YARD.rows; row++) {
        const i = col * YARD.rows + row
        const stack = this.stacks[i]
        const h = stack.length + this.incoming[i]
        if (h >= this.tiers) continue
        const home = kind === 'export' ? row < EXPORT_ROWS : row >= EXPORT_ROWS
        const mixed = stack.length > 0 && stack[stack.length - 1].kind !== kind
        const score = (home ? 0 : 12) + (mixed ? 4 : 0) + h * 1.5 + dx * 0.6 + row * 0.05
        if (score < bestScore) {
          bestScore = score
          best = { col, row }
        }
      }
    }
    if (best) this.incoming[this.at(best)]++
    return best
  }

  cancelSlot(ref: StackRef): void {
    this.incoming[this.at(ref)]--
  }

  // readyAt: when the owner's truck may collect it (import dwell time).
  deposit(ref: StackRef, color: number, kind: Kind, readyAt = 0): void {
    const i = this.at(ref)
    this.incoming[i]--
    this.stacks[i].push({ color, kind, reserved: false, readyAt })
    this.dirty = true
  }

  reserveBox(
    kind: Kind, far: (col: number) => number, now = Infinity, open: (col: number) => boolean = () => true,
  ): { ref: StackRef; box: YardBox } | null {
    let best: { ref: StackRef; box: YardBox } | null = null
    let bestScore = Infinity
    for (const col of this.cols) {
      if (!open(col)) continue
      const dx = far(col) + this.load(this.blockOf(col)) * 2.5
      for (let row = 0; row < YARD.rows; row++) {
        const stack = this.stacks[col * YARD.rows + row]
        for (let t = 0; t < stack.length; t++) {
          const box = stack[t]
          if (box.kind !== kind || box.reserved || box.readyAt > now) continue
          const score = (stack.length - 1 - t) * 10 + dx
          if (score < bestScore) {
            bestScore = score
            best = { ref: { col, row }, box }
          }
        }
      }
    }
    if (best) best.box.reserved = true
    return best
  }

  release(box: YardBox): void {
    box.reserved = false
  }

  // Boxes stacked on top of this one: each must be moved aside before it can leave.
  above(ref: StackRef, box: YardBox): number {
    const stack = this.stacks[this.at(ref)]
    return stack.length - 1 - stack.indexOf(box)
  }

  extract(ref: StackRef, box: YardBox): void {
    const stack = this.stacks[this.at(ref)]
    stack.splice(stack.indexOf(box), 1)
    this.dirty = true
  }

  seed(imports: number, exports: number): void {
    const add = (kind: Kind, n: number) => {
      for (let k = 0; k < n; k++) {
        const ref = this.reserveSlot(kind, (col) => Math.abs(this.colX(col) + 1))
        if (!ref) return
        this.deposit(ref, Math.floor(random() * LIVERIES.length), kind)
      }
    }
    add('import', imports)
    add('export', exports)
  }

  sync(): void {
    if (!this.dirty) return
    this.dirty = false
    // The pointer finds boxes by this sphere, which three only works out once.
    this.mesh.boundingSphere = null
    const m = new THREE.Matrix4()
    const color = new THREE.Color()
    let n = 0
    for (const col of this.cols) {
      for (let row = 0; row < YARD.rows; row++) {
        const stack = this.stacks[col * YARD.rows + row]
        for (let t = 0; t < stack.length; t++) {
          const p = this.slotPos({ col, row }, t)
          this.mesh.setMatrixAt(n, m.makeTranslation(p.x, p.y, p.z))
          this.mesh.setColorAt(n, color.set(LIVERIES[stack[t].color]))
          n++
        }
      }
    }
    this.mesh.count = n
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }
}
