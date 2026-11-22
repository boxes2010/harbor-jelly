import type * as THREE from 'three/webgpu'
import { SEAL } from './icons'

const dollars = (n: number) => `$${Math.round(n).toLocaleString()}`
// Bonuses from this size up are celebrated: written in gold, counted up, with a shower of coins.
export const WINDFALL = 1500
const HUGE = 5000
const COUNT_UP = 650

// Money feedback drawn over the world: coins that fly between the port and the cash counter,
// amounts that float up where they were earned, and a ring where something was built.
export class Fx {
  // Dollars still in the air. The counter shows the balance without them until they land.
  inFlight = 0
  enabled = false
  onLand: () => void = () => {}
  // The first and the last coins of a big payout have reached the counter.
  onWindfall: () => void = () => {}
  private calm = matchMedia('(prefers-reduced-motion: reduce)').matches
  private locator = document.createElement('i')

  constructor(private camera: THREE.Camera, private layer: HTMLElement, private purse: () => HTMLElement) {
    this.locator.className = 'locator'
    this.locator.hidden = true
    layer.append(this.locator)
  }

  private screen(at: THREE.Vector3): { x: number; y: number } {
    const p = at.clone().project(this.camera)
    return { x: ((p.x + 1) / 2) * window.innerWidth, y: ((1 - p.y) / 2) * window.innerHeight }
  }

  private purseSpot(): { x: number; y: number } {
    const r = this.purse().getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }

  private label(x: number, y: number, kind: string, html: string): HTMLElement {
    const el = document.createElement('span')
    el.className = `pop ${kind}`
    el.innerHTML = html
    // A wide label near the edge of the window is kept on screen.
    el.style.left = `${Math.min(window.innerWidth - 90, Math.max(90, x))}px`
    el.style.top = `${y}px`
    el.addEventListener('animationend', () => el.remove())
    this.layer.append(el)
    return el
  }

  // Runs a figure up from nothing to its amount.
  private countUp(figure: HTMLElement, amount: number): void {
    const begun = performance.now()
    const step = (now: number): void => {
      const t = Math.min(1, (now - begun) / COUNT_UP)
      figure.textContent = `+${dollars(amount * (1 - (1 - t) ** 3))}`
      if (t < 1 && figure.isConnected) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  // One coin, or a permit seal, along a curve that rises first, then sweeps to its target.
  private fly(
    from: { x: number; y: number }, to: { x: number; y: number }, lift: number, delay: number, landed: () => void,
    seal = false, fat = false,
  ): void {
    const coin = document.createElement('i')
    coin.className = seal ? 'seal flying' : fat ? 'coin flying fat' : 'coin flying'
    if (seal) coin.innerHTML = SEAL
    this.layer.append(coin)
    const x0 = from.x + (Math.random() - 0.5) * (fat ? 70 : 16)
    const y0 = from.y + (Math.random() - 0.5) * (fat ? 26 : 10)
    const cx = x0 + (to.x - x0) * (0.2 + Math.random() * 0.15)
    const cy = Math.max(10, Math.min(y0, to.y) - lift * (0.6 + Math.random() * 0.6))
    const frames: Keyframe[] = []
    for (let i = 0; i <= 12; i++) {
      const t = i / 12
      const u = 1 - t
      const x = u * u * x0 + 2 * u * t * cx + t * t * to.x
      const y = u * u * y0 + 2 * u * t * cy + t * t * to.y
      frames.push({
        transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${i === 0 ? 0.3 : i === 12 ? 0.7 : 1})`,
        opacity: i === 0 ? 0 : 1,
      })
    }
    const flight = coin.animate(frames, {
      duration: 620 + Math.random() * 220, delay, easing: 'cubic-bezier(.4, 0, .7, .55)', fill: 'both',
    })
    flight.onfinish = () => {
      coin.remove()
      landed()
    }
  }

  // Money made at a spot in the world: the amount floats up there and coins fly to the counter.
  earn(at: THREE.Vector3, amount: number, caption = ''): void {
    if (!this.enabled) return
    const from = this.screen(at)
    const bonus = caption !== ''
    const windfall = bonus && amount >= WINDFALL
    const kind = !bonus ? 'gain' : amount >= HUGE ? 'bonus huge' : windfall ? 'bonus big' : 'bonus'
    const label = this.label(
      from.x, from.y - 6, kind, `<span class="sum">+${dollars(amount)}</span>${bonus ? `<small>${caption}</small>` : ''}`,
    )
    if (this.calm) return
    if (windfall) {
      this.countUp(label.querySelector<HTMLElement>('.sum')!, amount)
      this.ring(at, true)
    }
    const coins = !bonus ? 1 : Math.round(Math.min(windfall ? 30 : 14, 4 + amount / 300))
    const to = this.purseSpot()
    let left = coins
    this.inFlight += amount
    for (let i = 0; i < coins; i++) {
      this.fly(from, to, windfall ? 70 : 46, i * (windfall ? 45 : 55), () => {
        left--
        this.inFlight = left ? this.inFlight - amount / coins : Math.round((this.inFlight - amount / coins) * 100) / 100
        this.onLand()
        if (windfall && (left === coins - 1 || left === 0)) this.onWindfall()
      }, false, windfall)
    }
  }

  // The council's stamp for a ship that left on time: a seal flies from the ship to the permit counter.
  stamp(at: THREE.Vector3, target: HTMLElement, landed: () => void): void {
    if (!this.enabled || this.calm) return landed()
    const box = target.getBoundingClientRect()
    this.fly(this.screen(at), { x: box.left + 14, y: box.top + box.height / 2 }, 60, 500, landed, true)
  }

  // Payday: wages leave the counter for the terminal office.
  payday(at: THREE.Vector3, amount: number, what = 'wages'): void {
    if (!this.enabled) return
    const from = this.purseSpot()
    this.label(from.x, from.y + 24, 'wage', `−${dollars(amount)}<small>${what}</small>`)
    if (this.calm) return
    for (let i = 0; i < 3; i++) this.fly(from, this.screen(at), -24, i * 70, () => {})
  }

  // A ship that left too late: no coins, just the verdict.
  late(at: THREE.Vector3, fine = 0): void {
    if (!this.enabled) return
    const from = this.screen(at)
    this.label(from.x, from.y - 6, 'late', `Late<small>${fine ? `Fined ${dollars(fine)}` : 'No bonus'}</small>`)
  }

  // Money spent: coins leave the counter for the button that was pressed.
  spend(button: DOMRect, amount: number): void {
    const from = this.purseSpot()
    this.label(from.x, from.y + 26, 'spend', `−${dollars(amount)}`)
    if (this.calm) return
    const to = { x: button.left + button.width / 2, y: button.top + button.height / 2 }
    const coins = Math.round(Math.min(12, 4 + amount / 500))
    for (let i = 0; i < coins; i++) this.fly(from, to, -30, i * 40, () => {})
  }

  // A turning ring around a blueprint too small to spot on its own. Null takes it away.
  locate(at: THREE.Vector3 | null): void {
    this.locator.hidden = at === null
    if (!at) return
    const { x, y } = this.screen(at)
    this.locator.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
  }

  // Something new was built here.
  ring(at: THREE.Vector3, gold = false): void {
    if (!this.enabled || this.calm) return
    const { x, y } = this.screen(at)
    const el = document.createElement('i')
    el.className = gold ? 'burst gold' : 'burst'
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    el.addEventListener('animationend', () => el.remove())
    this.layer.append(el)
  }
}
