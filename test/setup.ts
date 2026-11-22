import { beforeEach } from 'vitest'
import { reseed } from '../src/sim/random'

// The simulation only touches the browser for ship nameplates (a canvas) and the save (localStorage).
const context = new Proxy({}, { get: () => () => {}, set: () => true })
const saved = new Map<string, string>()
Object.assign(globalThis, {
  document: { createElement: () => ({ width: 0, height: 0, getContext: () => context }) },
  localStorage: {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => void saved.set(key, value),
    removeItem: (key: string) => void saved.delete(key),
  },
})

// Every test sees the same sequence of chance, so a failure can be repeated.
beforeEach(() => {
  saved.clear()
  reseed(12345)
})
