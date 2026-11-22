import { Game, UPGRADES, type Port } from '../src/sim/game'
import { Terminal } from '../src/sim/terminal'
import type { Water } from '../src/water'

const STEP = 0.05
const flat = { height: () => 0, disturb: () => {} } as unknown as Water

export interface Sim {
  game: Game
  port: Port
  terminal: Terminal
  terminals: Terminal[]
  // Runs every owned port for this many seconds of game time.
  run: (seconds: number, eachSecond?: () => void) => void
}

// A game without a window: flat water, nothing drawn, nothing saved.
export function sim(prepare: (game: Game) => void = () => {}): Sim {
  const game = new Game()
  game.persist = false
  prepare(game)
  const terminals = game.owned.map((port) => new Terminal(game, port, flat))
  const run = (seconds: number, eachSecond = () => {}) => {
    for (let second = 0; second < seconds; second++) {
      for (let t = 0; t < 1 - 1e-9; t += STEP) {
        game.tick(STEP)
        for (const terminal of terminals) terminal.update(STEP)
      }
      eachSecond()
    }
  }
  return { game, port: game.ports[0], terminal: terminals[0], terminals, run }
}

// Everything bought, and the six container lines signed: all that a port of ordinary hands has room for.
// The lines after those carry special cargo and are extra.
export function maxOut(port: Port): void {
  port.levels.berth = 1
  for (const u of UPGRADES) port.levels[u.id] = port.maxLevel(u.id)
  port.contracts = port.def.contracts.slice(0, 6).map((c) => c.id)
}

export const onTimeShare = (port: Port) => port.stats.onTime / Math.max(1, port.stats.onTime + port.stats.late)
