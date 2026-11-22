import { expect, test } from 'vitest'
import {
  CARGO, CRANE_MOVE, CREW_POOL, ENGINES, FREIGHT, Game, HOLDS, HULL_PAINTS, OVERSEAS, PORTS, RESALE, STAGE_PAY, STAMPS_PER_PERMIT,
  TRAIN_TIME, UPGRADES, WAGE, WORKS, passage, type Design, type Port,
} from '../src/sim/game'
import { GRADES, PAY, SKILL, pace, wage } from '../src/sim/crew'
import { reseed } from '../src/sim/random'
import * as THREE from 'three/webgpu'
import { BERTH_X } from '../src/sim/layout'
import { ROOM_TO_GROW } from '../src/sim/terminal'
import { blockCenter } from '../src/sim/yard'
import { maxOut, onTimeShare, sim } from './harness'
import { Vehicle } from '../src/sim/vehicles'

test('a new port serves its first line on time', () => {
  const { port, run } = sim()
  run(1800)
  expect(port.stats.ships).toBeGreaterThanOrEqual(6)
  expect(port.stats.late).toBe(0)
  expect(port.stats.diverted).toBe(0)
  expect(port.reliability).toBeGreaterThan(85)
})

test('a fully built port keeps up with every line', () => {
  const { port, run } = sim((game) => maxOut(game.ports[0]))
  run(1800)
  expect(port.stats.boxes).toBeGreaterThan(800)
  expect(port.stats.diverted).toBe(0)
  expect(onTimeShare(port)).toBeGreaterThan(0.85)
})

// Tractors, trucks and the gate share two one-way lanes. However busy it gets, nothing may drive through
// anything else, and traffic must never tie itself in a knot that has to be undone by force.
test('vehicles keep clear of one another in a fully built port', () => {
  const { port, terminal, run } = sim((game) => maxOut(game.ports[0]))
  let overlaps = 0
  run(1200, () => (overlaps += terminal.overlaps))
  expect(overlaps).toBe(0)
  expect(Vehicle.knots).toBe(0)
  expect(port.stats.trucks).toBeGreaterThan(300)
})

// Three cranes on a short ship once trapped the middle crane between its neighbours' jobs.
test('three cranes on one berth never seize up', () => {
  const { port, run } = sim((game) => {
    const first = game.ports[0]
    Object.assign(first.levels, { crane: 2, carrier: 4, gate: 1 })
    first.contracts = ['feeder', 'intra']
  })
  let last = 0
  let longestStall = 0
  let stall = 0
  run(1800, () => {
    stall = port.stats.boxes === last ? stall + 1 : 0
    last = port.stats.boxes
    longestStall = Math.max(longestStall, stall)
  })
  // With two lines calling every few minutes, the quay is never idle this long unless it is stuck.
  expect(longestStall).toBeLessThan(300)
  expect(port.stats.ships).toBeGreaterThanOrEqual(10)
})

test('no box is lost or invented between ship, yard and gate', () => {
  const { port, terminal, run } = sim((game) => maxOut(game.ports[0]))
  const start = { imports: terminal.yard.count('import'), exports: terminal.yard.count('export') }
  run(2400)
  const { landed, shipped, gateIn, gateOut } = terminal.flow
  // Whatever is not in the yard must be riding a tractor, a truck or a yard crane.
  const inTransit = 20 + 30 + 12
  const imports = start.imports + landed - gateOut - terminal.yard.count('import')
  const exports = start.exports + gateIn - shipped - terminal.yard.count('export')
  expect(imports).toBeGreaterThanOrEqual(0)
  expect(imports).toBeLessThanOrEqual(inTransit)
  expect(exports).toBeGreaterThanOrEqual(0)
  expect(exports).toBeLessThanOrEqual(inTransit)
  expect(terminal.yardFill).toBeLessThanOrEqual(1)
  expect(port.stats.boxes).toBe(landed + shipped)
})

test('the council stamps ships that leave on time and takes stamps back for late ones', () => {
  const game = new Game()
  for (let i = 0; i < STAMPS_PER_PERMIT - 1; i++) expect(game.stamp(true)).toBe(false)
  expect(game.stamps).toBe(STAMPS_PER_PERMIT - 1)
  game.stamp(false)
  expect(game.stamps).toBe(STAMPS_PER_PERMIT - 3)
  expect(game.stamp(true)).toBe(false)
  expect(game.stamp(true)).toBe(false)
  expect(game.stamp(true)).toBe(true)
  expect(game.permits).toBe(1)
  expect(game.stamps).toBe(0)
  // A bad run never takes away a permit already granted.
  game.stamp(false)
  expect(game.stamps).toBe(0)
  expect(game.permits).toBe(1)
})

test('a port run on time earns permits', () => {
  const { game, port, run } = sim()
  run(3000)
  expect(port.stats.onTime).toBeGreaterThanOrEqual(STAMPS_PER_PERMIT)
  expect(game.permits).toBe(Math.floor(port.stats.onTime / STAMPS_PER_PERMIT))
})

test('a new berth needs permits as well as cash', () => {
  const game = new Game()
  game.persist = false
  const port = game.ports[0]
  game.money = 50000
  game.permits = 1
  expect(game.price(port, 'berth')).toEqual({ cash: 6000, permits: 2, crews: 1 })
  expect(game.canBuy(port, 'berth')).toBe(false)
  expect(game.lacks(game.price(port, 'berth'), port)).toEqual({ cash: 0, permits: 1, crews: 0 })
  game.buy(port, 'berth')
  expect(port.levels.berth).toBe(0)

  game.permits = 2
  game.buy(port, 'berth')
  expect(port.levels.berth).toBe(1)
  expect(game.permits).toBe(0)
  expect(game.money).toBe(44000)
  // A berth is built with its first crane, and the crew to work it.
  expect(port.cranes).toEqual([1, 1, 0, 0])
  expect(port.crews).toBe(0)
})

const rich = () => {
  const game = new Game()
  game.persist = false
  game.money = 1e6
  game.permits = 50
  const port = game.ports[0]
  // People are not what these tests are about: there is always someone asking for work.
  const buy = (...args: Parameters<Game['buy']> extends [unknown, ...infer rest] ? rest : never) => {
    if (!port.crews) port.train(TRAIN_TIME)
    game.buy(port, ...args)
  }
  return { game, port, buy }
}

test('berths open in order along the quay', () => {
  const { game, port, buy } = rich()
  expect(port.needs({ id: 'berth', at: 2 })).toBe('Open berth 2 first')
  expect(game.canBuy(port, 'berth', 2)).toBe(false)
  buy('berth', 2)
  expect(port.levels.berth).toBe(0)
  buy('berth', 1)
  buy('berth', 2)
  expect(port.levels.berth).toBe(2)
  expect(port.cranes).toEqual([1, 1, 1, 0])
})

test('a crane goes to the berth picked, and only to a berth that is open', () => {
  const { port, buy } = rich()
  expect(port.needs({ id: 'crane', at: 1 })).toBe('Open this berth first')
  buy('crane', 1)
  expect(port.cranes).toEqual([1, 0, 0, 0])

  buy('crane', 0)
  expect(port.cranes).toEqual([2, 0, 0, 0])
  // A feeder is too short for three cranes to work at once, so the third waits for bigger ships.
  expect(port.needs({ id: 'crane', at: 0 })).toMatch(/^Dredge first/)
  buy('crane', 0)
  expect(port.cranes[0]).toBe(2)
  buy('dredge')
  buy('crane', 0)
  expect(port.cranes[0]).toBe(3)
  buy('crane', 0)
  expect(port.cranes[0]).toBe(3)

  // Left to the port, the next crane goes to the berth with the fewest.
  buy('berth')
  buy('crane')
  expect(port.cranes).toEqual([3, 2, 0, 0])
  expect(port.levels.crane).toBe(4)
})

test('a crane sent to the next berth runs there along the quay', () => {
  const { game, port, terminal, run } = sim((game) => {
    Object.assign(game.ports[0].levels, { berth: 1, crane: 2 })
    game.money = 10000
  })
  expect(port.cranes).toEqual([2, 1, 0, 0])
  expect(port.moveBlocker(1, 0)).toBe('A berth keeps its last crane')
  expect(port.moveBlocker(0, 2)).toBe('Open that berth first')
  expect(game.moveCrane(port, 1, 0)).toBe(false)

  expect(game.moveCrane(port, 0, 1)).toBe(true)
  expect(game.money).toBe(10000 - CRANE_MOVE)
  expect(port.cranes).toEqual([1, 2, 0, 0])
  expect(port.levels.crane).toBe(2)
  run(120)
  expect(terminal.cranesAt(0)).toHaveLength(1)
  expect(terminal.cranesAt(1)).toHaveLength(2)
  // It has left its old berth behind and stands on the new one.
  for (const x of terminal.cranesAt(1)) expect(Math.abs(x - BERTH_X[1])).toBeLessThan(1.7)
  for (const x of terminal.cranesAt(0)) expect(Math.abs(x - BERTH_X[0])).toBeLessThan(1.7)
  // A third crane on a berth still waits for dredging, however it gets there.
  game.buy(port, 'crane', 0)
  expect(port.moveBlocker(0, 1)).toBe('Dredge first')

  // The berth works on with the crane it was sent.
  run(1200)
  expect(port.stats.ships).toBeGreaterThanOrEqual(4)
  expect(port.stats.late).toBe(0)
})

test('a line given a berth of its own waits for that berth', () => {
  const { port, terminal, run } = sim((game) => {
    const first = game.ports[0]
    Object.assign(first.levels, { berth: 1, crane: 1, carrier: 3, gate: 1 })
    first.contracts = ['feeder', 'intra']
    first.homes = { intra: 1 }
  })
  const seen = [new Set<string>(), new Set<string>()]
  run(1800, () => seen.forEach((lines, berth) => {
    const line = terminal.calling(berth)
    if (line) lines.add(line)
  }))
  expect(seen[1].has('intra')).toBe(true)
  expect(seen[0].has('intra')).toBe(false)
  expect(seen[0].has('feeder')).toBe(true)
  expect(port.stats.ships).toBeGreaterThanOrEqual(10)
  expect(port.stats.diverted).toBe(0)

  // A berth that is not open keeps nobody waiting, and a line that is dropped gives its berth up.
  port.homes = { feeder: 3 }
  expect(port.home('feeder')).toBeNull()
})

test('a ship out early and a run of ships on time both raise the bonus', () => {
  const port = new Game().ports[0]
  expect(port.reward(1000, 0.9)).toEqual({ sum: 1000, note: 'On time' })
  expect(port.reward(1000, 0.7).sum).toBe(1500)
  expect(port.reward(1000, 0.4)).toEqual({ sum: 2000, note: 'Express ×2' })
  for (let ship = 0; ship < 4; ship++) port.score(true)
  expect(port.reward(1000, 0.4)).toEqual({ sum: 2400, note: 'Express ×2 · 5 in a row' })
  for (let ship = 0; ship < 40; ship++) port.score(true)
  expect(port.reward(1000, 0.9).sum).toBe(1500)
  port.score(false)
  expect(port.reward(1000, 0.9).sum).toBe(1000)
})

test('the channel is shut while the dredger works, and opens again after it', () => {
  const { game, port, terminal, run } = sim((game) => {
    game.money = 50000
    game.permits = 5
  })
  run(60)
  expect(terminal.dredging).toBe(false)
  game.buy(port, 'dredge')
  run(2)
  expect(terminal.dredging).toBe(true)
  expect(terminal.diagnosis().text).toMatch(/dredger/)
  run(120)
  expect(terminal.dredging).toBe(false)
  run(900)
  expect(port.stats.ships).toBeGreaterThanOrEqual(3)
  expect(port.stats.late).toBe(0)
})

test('a yard block opens only next to one already open', () => {
  const { port, buy } = rich()
  const [first, second] = port.blocks
  const far = first > 5 ? 0 : 11
  expect(port.needs({ id: 'yardBlock', at: far })).toBe('Open a block next to it first')
  buy('yardBlock', far)
  expect(port.blocks).toEqual([first, second])

  const beside = Math.max(first, second) + 1
  buy('yardBlock', beside)
  expect(port.blocks).toEqual([first, second, beside])
  expect(port.levels.yardBlock).toBe(1)
  // Opening it a second time does nothing.
  buy('yardBlock', beside)
  expect(port.blocks).toHaveLength(3)
})

test('tractors and gate lanes wait for what they serve', () => {
  const { port, buy } = rich()
  // Three tractors to a crane.
  buy('carrier')
  buy('carrier')
  expect(port.levels.carrier).toBe(2)
  expect(port.needs({ id: 'carrier' })).toMatch(/^Needs another crane/)
  buy('carrier')
  expect(port.levels.carrier).toBe(2)
  buy('crane')
  buy('carrier')
  expect(port.levels.carrier).toBe(3)

  // A gate lane to a yard block.
  buy('gate')
  expect(port.levels.gate).toBe(1)
  expect(port.needs({ id: 'gate' })).toMatch(/^Needs another yard block/)
  buy('gate')
  expect(port.levels.gate).toBe(1)
  buy('yardBlock')
  buy('gate')
  expect(port.levels.gate).toBe(2)
})

test('god mode builds for free and leaves the real balances alone', () => {
  const game = new Game()
  game.persist = false
  const port = game.ports[0]
  port.applicants = []
  expect(game.canBuy(port, 'berth')).toBe(false)

  game.god = true
  expect(game.canBuy(port, 'berth')).toBe(true)
  game.buy(port, 'berth')
  game.buy(port, 'crane', 1)
  expect(port.cranes).toEqual([1, 2, 0, 0])
  expect(game.expand()).toBe(game.ports[1])
  expect([game.money, game.permits, port.crews]).toEqual([600, 0, 0])

  // What has to be built first still has to be.
  expect(game.canBuy(port, 'berth', 3)).toBe(false)
  expect(port.needs({ id: 'crane', at: 1 })).toMatch(/^Dredge first/)

  game.god = false
  expect(game.canBuy(port, 'craneSpeed')).toBe(true)
  expect(game.canBuy(port, 'carrier')).toBe(false)
})

test('a click finds the thing under the pointer', () => {
  const { port, terminal, run } = sim()
  run(1)
  const down = new THREE.Raycaster()
  const at = (x: number, z: number) => {
    down.set(new THREE.Vector3(x, 5, z), new THREE.Vector3(0, -1, 0))
    return terminal.pick(down)
  }
  const [open] = port.blocks
  const shut = open > 5 ? 0 : 11
  expect(at(BERTH_X[0], -0.26)).toEqual({ kind: 'berth', berth: 0 })
  expect(at(BERTH_X[2], -0.2)).toEqual({ kind: 'site', berth: 2 })
  expect(at(BERTH_X[2], 0.3)).toEqual({ kind: 'site', berth: 2 })
  expect(at(BERTH_X[0] + 3.5, 0.9)).toEqual({ kind: 'channel' })
  expect(at(blockCenter(open), -0.9)).toEqual({ kind: 'block', block: open })
  expect(at(blockCenter(shut), -0.9)).toEqual({ kind: 'plot', block: shut })
  expect(at(3.5, -0.76)).toEqual({ kind: 'gate' })
  expect(at(3.4, -0.98)).toEqual({ kind: 'office' })
  expect(at(6, -0.5)).toBeNull()
})

test('every machine needs a crew, and crews take time to train', () => {
  const { game, port, run } = sim((g) => (g.money = 50000))
  expect(port.crews).toBe(1)
  game.buy(port, 'carrier')
  expect(port.levels.carrier).toBe(1)
  expect(port.crews).toBe(0)
  game.buy(port, 'crane')
  expect(port.levels.crane).toBe(0)
  expect(game.lacks(game.price(port, 'crane'), port).crews).toBe(1)
  // Speed does not need more people.
  game.buy(port, 'craneSpeed')
  expect(port.levels.craneSpeed).toBe(1)

  run(TRAIN_TIME + 1)
  expect(port.crews).toBe(1)
  game.buy(port, 'crane')
  expect(port.levels.crane).toBe(1)

  // Left alone, the port trains until a few crews are waiting, and then stops.
  run(TRAIN_TIME * (CREW_POOL + 2))
  expect(port.crews).toBe(CREW_POOL)
})

test('wages are paid every minute for each crew at work', () => {
  const { game, port, run } = sim()
  // One quay crane, one tractor, two yard blocks and one gate lane.
  expect(port.staff).toBe(5)
  expect(game.payroll(port)).toBe(5 * WAGE)
  run(605)
  expect(port.stats.wages).toBeCloseTo(10 * 5 * WAGE, 9)
  expect(game.money).toBeCloseTo(600 + port.stats.earned - port.stats.wages, 6)

  game.money = 5000
  game.buy(port, 'carrier')
  expect(game.payroll(port)).toBe(6 * WAGE)
  game.wageLevel = 1.1
  expect(game.payroll(port)).toBeCloseTo(6 * WAGE * 1.1, 9)
})

test('two ports work at once and share one purse', () => {
  const { game, terminals, run } = sim((g) => {
    g.money = 40000
    g.permits = 5
    expect(g.expand()).toBe(g.ports[1])
  })
  expect(game.money).toBe(10000)
  expect(game.permits).toBe(0)
  expect(terminals).toHaveLength(2)
  run(900)
  const [sound, amber] = game.ports
  expect(sound.stats.boxes).toBeGreaterThan(30)
  expect(amber.stats.boxes).toBeGreaterThan(30)
  const net = (port: typeof sound) => port.stats.earned - port.stats.wages
  expect(game.money).toBeCloseTo(10000 + net(sound) + net(amber), 5)
})

test('a port cannot be bought without the money and the permits', () => {
  const game = new Game()
  game.persist = false
  expect(game.expand()).toBeNull()
  game.money = 100000
  expect(game.expand()).toBeNull()
  expect(game.ports[1].owned).toBe(false)
  expect(game.money).toBe(100000)
  game.permits = 5
  expect(game.expand()).toBe(game.ports[1])
})

test('a save comes back as it was left', () => {
  const game = new Game()
  game.money = 43210
  game.permits = 7
  game.stamps = 4
  game.wageLevel = 1.21
  game.expand()
  game.buy(game.ports[0], 'crane')
  game.buy(game.ports[1], 'carrier')
  game.ports[1].contracts.push('sunbelt')
  game.ports[0].training = 0.5
  game.setHome(game.ports[0], 'feeder', 0)
  game.setFirst(game.ports[0], 0)
  game.ports[0].score(true)
  game.active = 1
  game.save()

  const loaded = Game.load()
  expect(loaded.money).toBe(game.money)
  expect(loaded.permits).toBe(2)
  expect(loaded.stamps).toBe(4)
  expect(loaded.wageLevel).toBe(1.21)
  expect(loaded.active).toBe(1)
  expect(loaded.ports.map((port) => port.owned)).toEqual([true, true, false, false, false, false])
  expect(loaded.ports[0].levels.crane).toBe(1)
  expect(loaded.ports[0].cranes).toEqual([2, 0, 0, 0])
  expect(loaded.ports[0].blocks).toEqual(game.ports[0].blocks)
  expect(loaded.ports[0].crews).toBe(0)
  expect(loaded.ports[0].training).toBe(0.5)
  expect(loaded.ports[0].homes).toEqual({ feeder: 0 })
  expect(loaded.ports[0].first).toBe(0)
  expect(loaded.ports[0].streak).toBe(1)
  expect(loaded.ports[1].levels.carrier).toBe(1)
  expect(loaded.ports[1].contracts).toEqual(['coastal', 'sunbelt'])
})

test('a save from before there were several ports becomes the first port', () => {
  localStorage.setItem('harbor-jelly-save-v1', JSON.stringify({
    money: 5000, reliability: 91, contracts: ['feeder', 'intra'], levels: { crane: 2, stackHeight: 3 },
    stats: { boxes: 400 }, wage: 0.94,
  }))
  const game = Game.load()
  const [first, second] = game.ports
  expect(game.money).toBe(5000)
  // Wages were once a cut out of every fee; that cut becomes a higher wage.
  expect(game.wageLevel).toBeCloseTo(1 / 0.94, 9)
  expect(first.reliability).toBe(91)
  expect(first.contracts).toEqual(['feeder', 'intra'])
  expect(first.levels.crane).toBe(2)
  // Stacks were once allowed a tier higher than the yard cranes can now reach.
  expect(first.levels.stackHeight).toBe(2)
  expect(first.stats.boxes).toBe(400)
  expect(second.owned).toBe(false)
})

// A player who follows the port's own advice should be able to grow. This is the pacing check.
test('a port opens with a hand on every machine, and a new machine takes an applicant', () => {
  const { game, port } = sim((g) => (g.money = 50000))
  expect(port.workers).toHaveLength(5)
  expect(port.vacancies()).toEqual([])
  expect(port.workers.map((worker) => worker.post!.trade).sort()).toEqual(['crane', 'gate', 'tractor', 'yard', 'yard'])
  const asking = port.applicants[0]
  game.buy(port, 'carrier')
  expect(port.applicants).toHaveLength(0)
  expect(port.crew('tractor')).toContain(asking)
  expect(port.vacancies()).toEqual([])
})

test('promotion comes with time at work, and pay follows the grade', () => {
  const { game, port, run } = sim()
  const driver = port.crew('crane', 0)[0]
  expect(pace(driver, 'crane')).toBe(1)
  expect(wage(driver)).toBe(WAGE)
  port.promote(driver.id)
  expect(driver.grade).toBe(0)

  run(1500)
  expect(driver.exp).toBeGreaterThanOrEqual(GRADES[0].exp)
  port.promote(driver.id)
  expect(driver.grade).toBe(1)
  expect(driver.exp).toBe(0)
  expect(pace(driver, 'crane')).toBeCloseTo(GRADES[1].pace)
  expect(game.payroll(port)).toBeCloseTo(WAGE * (4 + GRADES[1].pay))

  port.setPay(driver.id, 2)
  expect(wage(driver)).toBeCloseTo(WAGE * GRADES[1].pay * PAY[2].pay)
  expect(pace(driver, 'crane')).toBeCloseTo(GRADES[1].pace * PAY[2].pace)
})

test('a machine with nobody on it stands idle until someone takes it', () => {
  const { port, terminal, run } = sim()
  port.dismiss(port.crew('crane', 0)[0].id)
  expect(port.vacancies()).toEqual([{ trade: 'crane', at: 0 }])
  run(400)
  expect(port.stats.boxes).toBe(0)
  expect(terminal.diagnosis().text).toMatch(/nobody to work/)

  // Whoever is taken on next goes to the empty post.
  port.hire(port.applicants[0].id)
  expect(port.vacancies()).toEqual([])
  run(600)
  expect(port.stats.boxes).toBeGreaterThan(10)
})

test('hands change places, and each works at the pace of their skill', () => {
  const { port } = sim()
  const [driver] = port.crew('crane', 0)
  const [clerk] = port.crew('gate')
  Object.assign(driver.skill, { crane: 3, gate: 1 })
  expect(pace(driver, 'crane')).toBeCloseTo(1 + SKILL.step)
  port.swap(driver.id, clerk.id)
  expect(port.crew('gate')).toEqual([driver])
  expect(port.crew('crane', 0)).toEqual([clerk])
  expect(pace(driver, 'gate')).toBeCloseTo(1 - SKILL.step)
  // Nobody can be sent to a post that is taken.
  port.move(driver.id, { trade: 'crane', at: 0 })
  expect(port.crew('gate')).toEqual([driver])
})

// The reason to look after the crews: a port asked for more ships than ordinary hands can turn round.
test('seasoned crews let a stretched port take more ships', () => {
  const stretched = (grade: number) => {
    reseed(12345)
    const { port, run } = sim((game) => {
      const first = game.ports[0]
      Object.assign(first.levels, {
        berth: 2, dredge: 2, tug: 1, crane: 5, craneSpeed: 2, carrier: 13, carrierSpeed: 2, yardBlock: 5,
        stackHeight: 1, yardCrane: 2, gate: 3,
      })
      first.contracts = ['feeder', 'intra', 'skerry', 'transpac']
      for (const id of first.contracts) first.sailings[id] = 2
    })
    for (const worker of port.workers) worker.grade = grade
    run(3600)
    return port.stats
  }
  const hands = stretched(0)
  const foremen = stretched(GRADES.length - 1)
  expect(foremen.earned - foremen.wages).toBeGreaterThan((hands.earned - hands.wages) * 1.1)
  expect(foremen.late).toBeLessThan(hands.late)
})

test('chilled food is collected within a couple of minutes of landing', () => {
  const { game, port, terminal, run } = sim((g) => {
    g.ports[0].contracts = ['fresh']
    g.ports[0].yardImports = 0
  })
  let landed = 0
  run(600, () => {
    landed = Math.max(landed, terminal.yard.count('import'))
    expect(terminal.yard.ready(game.time + CARGO.food.dwell[1])).toBe(terminal.yard.count('import', false))
  })
  expect(landed).toBeGreaterThan(5)
  expect(port.stats.late).toBe(0)
})

test('asking a line for more sailings brings its ships more often', () => {
  const calls = (level: number) => {
    reseed(12345)
    const { port, terminal, run } = sim((g) => g.setSailings(g.ports[0], 'feeder', level))
    run(3600)
    return port.stats.ships + port.stats.diverted + terminal.waiting
  }
  const usual = calls(1)
  expect(calls(2)).toBeGreaterThan(usual * 1.2)
  expect(calls(0)).toBeLessThan(usual * 0.85)
})

test('a ship that asks to call is let in, served and paid for', () => {
  // A port with room to spare: a second crane and the tractors to go with it.
  const { port, terminal, run } = sim((game) => Object.assign(game.ports[0].levels, { crane: 1, carrier: 3, gate: 1 }))
  run(400)
  expect(terminal.requests).toHaveLength(1)
  const { id, call } = terminal.requests[0]
  expect(call.contract).toBeNull()
  expect(terminal.accept(id)).toBe(true)
  expect(terminal.requests).toHaveLength(0)
  expect(terminal.accept(id)).toBe(false)

  let served = false
  run(900, () => (served ||= terminal.visiting(0)?.name === call.name && terminal.visiting(0)?.contract === null))
  expect(served).toBe(true)
  expect(port.stats.late).toBe(0)

  // One that is turned away, or left unanswered, goes elsewhere.
  run(600)
  for (const request of [...terminal.requests]) terminal.decline(request.id)
  expect(terminal.requests).toHaveLength(0)
  run(310)
  const asking = terminal.requests.map((request) => request.id)
  expect(asking.length).toBeGreaterThan(0)
  run(160)
  expect(terminal.requests.some((request) => request.id === asking[0])).toBe(false)
})

// A game with money and permits to spare, and someone always asking for work.
const magnate = () => {
  const made = sim((g) => {
    g.money = 1e6
    g.permits = 50
  })
  const hand = () => {
    if (!made.port.crews) made.port.train(TRAIN_TIME)
  }
  return { ...made, hand }
}

test('a stretch of quay can be opened as a shipyard, which builds a hull and is paid in stages', () => {
  const { game, port, terminal, run, hand } = magnate()
  expect(game.foundPrice(port, 'shipyard')).toEqual({ cash: 6000, permits: 2, crews: 1 })
  expect(game.found(port, 'shipyard')).toBe(true)
  expect(port.yards).toEqual(['boxes', 'shipyard', 'boxes', 'boxes'])
  expect(port.levels.berth).toBe(1)
  expect(port.cranes).toEqual([1, 0, 0, 0])
  expect(port.gangs).toEqual([0, 1, 0, 0])
  expect(port.crew('fitter', 1)).toHaveLength(1)
  // It is not a container berth: no crane goes there, and gangs go nowhere else.
  expect(port.needs({ id: 'crane', at: 1 })).toBe('Not a container berth')
  expect(port.needs({ id: 'gang', at: 0 })).toMatch(/^Needs a shipyard/)
  hand()
  game.buy(port, 'gang', 1)
  expect(port.gangs[1]).toBe(2)
  expect(port.crew('fitter', 1)).toHaveLength(2)

  run(60)
  const job = terminal.job(1)!
  expect(job.call.work).toMatchObject({ yard: 'shipyard', vessel: 'tugboat', built: true })
  expect(job.done).toBeGreaterThan(0)
  // A quarter of the way along, the first stage payment has been made.
  const tug = WORKS.shipyard.jobs[0]
  const before = port.stats.earned
  let boxFees = 0
  terminal.onPay = (_at, amount) => (boxFees += amount === Math.round(tug.fee * STAGE_PAY) ? 0 : amount)
  run(tug.work / 2 / 4 + 20)
  expect(terminal.job(1)!.done).toBeGreaterThan(0.25)
  expect(port.stats.earned - before - boxFees).toBeGreaterThanOrEqual(Math.round(tug.fee * STAGE_PAY))

  // Two gangs build her in half the time. She is launched, and the next keel is laid soon after.
  let launched = 0
  run(tug.work / 2, () => (launched ||= port.stats.jobs ? game.time : 0))
  expect(port.stats.jobs).toBe(1)
  expect(launched).toBeLessThan(40 + tug.work / 2 + 10)
  // The hull on the slip now is a new one, as far along as the time since allows.
  expect(terminal.job(1)!.done).toBeLessThan((game.time - launched) / (tug.work / 2))
  expect(port.stats.late).toBe(0)
})

test('ships that come for work go only to a yard that does it', () => {
  const { game, port, terminal, run, hand } = magnate()
  game.found(port, 'repair')
  hand()
  game.found(port, 'navy')
  expect(port.yards).toEqual(['boxes', 'repair', 'navy', 'boxes'])
  expect(port.vacancies()).toEqual([])
  const seen = [new Set<string>(), new Set<string>(), new Set<string>()]
  run(3000, () => seen.forEach((kinds, berth) => {
    const call = terminal.visiting(berth)
    if (call) kinds.add(call.work?.yard ?? 'boxes')
  }))
  expect(seen.map((kinds) => [...kinds])).toEqual([['boxes'], ['repair'], ['navy']])
  expect(port.stats.jobs).toBeGreaterThan(8)
  expect(port.stats.diverted).toBe(0)
  expect(onTimeShare(port)).toBeGreaterThan(0.9)
})

test('a ferry terminal turns its ferry round on every sailing', () => {
  const { game, port, run } = magnate()
  game.found(port, 'ferry')
  run(1800)
  // A sailing about every three minutes, each one on time.
  expect(port.stats.jobs).toBeGreaterThanOrEqual(8)
  expect(port.stats.late).toBe(0)
})

test('a yard is turned over to other work, and only when it is empty', () => {
  const { game, port, terminal, run, hand } = magnate()
  expect(port.convertBlocker(0, 'ferry')).toBe('The first berth stays a container berth')
  expect(port.convertBlocker(1, 'ferry')).toBe('Open this berth first')
  game.found(port, 'repair')
  hand()
  game.buy(port, 'gang', 1)
  expect(port.gangs[1]).toBe(2)
  run(1)
  expect(port.convertBlocker(1, 'repair')).toBe('It is that already')

  // To a container berth: the gangs go, a crane comes, and one of the fitters takes it.
  const money = game.money
  expect(game.convert(port, 1, 'boxes')).toBe(true)
  expect(game.money).toBe(money - game.convertPrice(port, 1, 'boxes').cash)
  expect(port.yards[1]).toBe('boxes')
  expect(port.gangs).toEqual([0, 0, 0, 0])
  expect(port.cranes).toEqual([1, 1, 0, 0])
  expect(port.levels.gang).toBe(0)
  expect(port.crew('crane', 1)).toHaveLength(1)
  run(5)
  expect(terminal.cranesAt(1)).toHaveLength(1)

  // And back to a yard: the crane goes with the berth.
  expect(game.convert(port, 1, 'navy')).toBe(true)
  expect(port.cranes).toEqual([1, 0, 0, 0])
  expect(port.levels.crane).toBe(0)
  run(5)
  expect(terminal.cranesAt(1)).toHaveLength(0)
  expect(port.crew('fitter', 1)).toHaveLength(1)

  // With a ship in, or one on her way, it has to wait.
  run(600)
  let blocked = false
  run(600, () => (blocked ||= terminal.visiting(1) !== null && port.convertBlocker(1, 'ferry') === 'Wait until the yard is empty'))
  expect(blocked).toBe(true)
})

test('a save keeps what each yard does', () => {
  const game = new Game()
  game.money = 1e6
  game.permits = 50
  game.found(game.ports[0], 'shipyard')
  game.setProduct(game.ports[0], 1, 2)
  game.save()
  const loaded = Game.load().ports[0]
  expect(loaded.yards).toEqual(['boxes', 'shipyard', 'boxes', 'boxes'])
  expect(loaded.gangs).toEqual([0, 1, 0, 0])
  expect(loaded.products).toEqual({ 1: 2 })
  expect(loaded.crew('fitter', 1)).toHaveLength(1)
  expect(loaded.cranes).toEqual([1, 0, 0, 0])
})

// One of the famous harbours, owned on its own with money to spare.
const harbour = (id: string, prepare: (port: Port, game: Game) => void = () => {}) => {
  const made = sim((game) => {
    game.money = 1e6
    game.permits = 50
    game.ports[0].owned = false
    const port = game.ports.find((p) => p.def.id === id)!
    port.owned = true
    prepare(port, game)
  })
  return { ...made, port: made.terminal.port }
}

test('every harbour opens with a line its one crane can serve', () => {
  for (const def of PORTS) {
    reseed(12345)
    const { port, run } = harbour(def.id)
    run(1500)
    expect(port.stats.ships, def.name).toBeGreaterThanOrEqual(5)
    expect(port.stats.late, def.name).toBe(0)
  }
})

test('a harbour on sale is bought with cash and permits, in any order', () => {
  const game = new Game()
  game.persist = false
  const shanghai = game.ports.find((port) => port.def.id === 'shanghai')!
  expect(game.onSale).toHaveLength(PORTS.length - 1)
  expect(game.expand(shanghai)).toBeNull()
  game.money = 1e6
  game.permits = 20
  expect(game.expand(shanghai)).toBe(shanghai)
  expect(game.money).toBe(1e6 - shanghai.def.price)
  expect(game.permits).toBe(20 - shanghai.def.permits)
  expect(game.onSale).not.toContain(shanghai)
  expect(game.expand(shanghai)).toBeNull()
  // Left to itself the game sells the next one along.
  expect(game.expand()).toBe(game.ports[1])
})

test('at Rotterdam a ship that needs all the depth of the channel waits for the tide', () => {
  const setOut = (dredge: number) => {
    reseed(12345)
    const { port, terminal, run } = harbour('rotterdam', (p) => {
      maxOut(p)
      p.levels.dredge = dredge
      p.contracts = ['maas', 'oranje', 'kaap']
    })
    const count = { feeder: 0, panamax: 0 }
    const seen = BERTH_X.map(() => false)
    run(3600, () => seen.forEach((was, berth) => {
      const call = terminal.visiting(berth)
      if (call && !was && !terminal.tideTurn!.open) count[call.ship as 'feeder' | 'panamax']++
      seen[berth] = call !== null
    }))
    return { port, terminal, count }
  }
  // With the channel only just deep enough for them, no Panamax ship comes in at low water. Feeders do.
  const shallow = setOut(1)
  expect(shallow.terminal.tideBound).toEqual(['panamax'])
  expect(shallow.count.panamax).toBe(0)
  expect(shallow.count.feeder).toBeGreaterThan(2)
  // One step deeper and they come at any tide, and the wait is gone from their turn.
  const deep = setOut(2)
  expect(deep.terminal.tideBound).toEqual(['neo'])
  expect(deep.count.panamax).toBeGreaterThan(2)
  expect(deep.port.last.oranje.used).toBeLessThan(shallow.port.last.oranje.used + 0.3)
  expect(deep.port.stats.onTime).toBeGreaterThanOrEqual(shallow.port.stats.onTime)
  // Dredging goes one step further here than anywhere else, and then nothing waits.
  expect(deep.port.maxLevel('dredge')).toBe(3)
  expect(setOut(3).terminal.tideBound).toEqual([])
  expect(sim().port.maxLevel('dredge')).toBe(2)
})

test('at Shanghai the water is deep from the first day, and a typhoon stops the port after its warning', () => {
  const { port, terminal, run } = harbour('shanghai', (p) => {
    maxOut(p)
    p.contracts = p.contracts.slice(0, 5)
  })
  const { warning, blow, every } = port.def.rules!.typhoon!
  expect(port.levels.dredge).toBe(2)
  expect(terminal.dredging).toBe(false)
  expect(terminal.signal).toBeNull()
  let waited = 0
  while (terminal.signal === null && waited++ < every[1] + 10) run(1)
  expect(waited).toBeGreaterThanOrEqual(every[0] - warning - 2)
  expect(terminal.signal).toBeGreaterThan(warning - 2)
  expect(terminal.typhoon).toBe(false)
  expect(terminal.hint()).toMatch(/^Typhoon signal is up/)
  run(warning + 3)
  expect(terminal.typhoon).toBe(true)
  expect(terminal.storm).toBe(true)
  // Nothing is lifted and no ship sets out until it has blown over.
  const boxes = port.stats.boxes
  const calls = BERTH_X.map((_, berth) => terminal.visiting(berth))
  let setOut = 0
  run(blow - 10, () => BERTH_X.forEach((_, berth) => {
    const call = terminal.visiting(berth)
    if (call && call !== calls[berth]) setOut++
    calls[berth] = call
  }))
  expect(terminal.typhoon).toBe(true)
  expect(port.stats.boxes).toBe(boxes)
  expect(setOut).toBe(0)
  run(12)
  expect(terminal.typhoon).toBe(false)
  expect(terminal.signal).toBeNull()
  run(120)
  expect(port.stats.boxes).toBeGreaterThan(boxes)
})

test('at Yokohama the yard has no room to grow, and a late ship is fined', () => {
  const { game, port, terminal, run } = harbour('yokohama')
  expect([...port.plots].sort((a, b) => a - b)).toEqual([3, 4, 5, 6, 7, 8, 9])
  expect(port.maxLevel('yardBlock')).toBe(5)
  expect(port.needs({ id: 'yardBlock', at: 0 })).toBe('The city keeps this ground')
  expect(port.needs({ id: 'yardBlock', at: 11 })).toBe('The city keeps this ground')
  for (let k = 0; k < 8; k++) {
    if (!port.crews) port.train(TRAIN_TIME)
    game.buy(port, 'yardBlock')
  }
  run(1)
  expect(port.blocks).toHaveLength(7)
  expect(port.blocks.every((block) => port.plots.includes(block))).toBe(true)

  // The first ship is held up past her deadline: she pays no bonus and costs half of it.
  const left: { bonus: number; onTime: boolean }[] = []
  terminal.onDeparture = (_at, bonus, onTime) => left.push({ bonus, onTime })
  while (terminal.visiting(0) === null) run(1)
  port.holdUntil = game.time + 320
  const before = port.stats.earned
  while (!left.length) run(1)
  const bay = port.contract('bay')
  expect(left[0]).toEqual({ bonus: -bay.bonus / 2, onTime: false })
  expect(port.stats.earned - before).toBeLessThanOrEqual(bay.fee * (bay.unload + bay.load) - bay.bonus / 2)
})

test('at Los Angeles the hands cost more, the trucks keep to the road, and imports wait longer', () => {
  const la = harbour('losangeles', (p) => maxOut(p))
  const home = sim((game) => maxOut(game.ports[0]))
  la.run(1)
  home.run(1)
  expect(la.game.payroll(la.port)).toBeCloseTo(home.game.payroll(home.port) * 1.35, 5)

  // A day starts at nine. The morning rush is from seven to half past nine: far fewer trucks come through it
  // than through the same stretch of the afternoon before.
  const hour = 60
  la.run(4 * hour)
  expect(la.terminal.rush).toBe(false)
  const trucks = () => la.port.stats.trucks
  let mark = trucks()
  la.run(2 * hour)
  const afternoon = trucks() - mark
  la.run(16.2 * hour)
  expect(la.terminal.rush).toBe(true)
  mark = trucks()
  la.run(2 * hour)
  expect(la.terminal.rush).toBe(true)
  expect(trucks() - mark).toBeLessThan(afternoon * 0.6)

  // The same port without the long wait for trucks keeps fewer boxes on the ground.
  const fill = (dwell: number) => {
    const rules = PORTS.find((def) => def.id === 'losangeles')!.rules!
    const usual = rules.dwell
    rules.dwell = dwell
    try {
      reseed(12345)
      const made = harbour('losangeles', (p) => maxOut(p))
      made.run(2400)
      return made.terminal.yardFill
    } finally {
      rules.dwell = usual
    }
  }
  expect(fill(1.8)).toBeGreaterThan(fill(1) * 1.15)
})

const feeder: Design = { name: '', hull: HULL_PAINTS[1], size: 'feeder', engine: 1, fit: 'goods' }

test('a ship of the player\'s own is ordered at a shipyard, built by its gangs and joins the fleet', () => {
  const { game, port, terminal, run } = magnate()
  const design = { ...feeder, name: 'my ship!' }
  expect(game.orderBlocker(port, 1, design)).toBe('Needs a shipyard')
  game.found(port, 'shipyard')
  expect(game.orderBlocker(port, 1, { ...design, size: 'neo' })).toBe('Too big for the slip')
  expect(game.orderBlocker(port, 1, { ...design, size: 'panamax' })).toMatch(/^Dredge first/)
  const money = game.money
  expect(game.shipPrice(design).cash).toBe(HOLDS.feeder!.price)
  expect(game.order(port, 1, design)).toBe(true)
  expect(game.money).toBe(money - HOLDS.feeder!.price)
  expect(port.keels[1].design.name).toBe('MY SHIP')
  expect(game.orderBlocker(port, 1, design)).toBe('One is on order here already')
  expect(port.convertBlocker(1, 'ferry')).toBe('A ship of yours is on order here')

  // She takes the slip before any customer's hull. Nobody pays the yard for her in stages: she is the player's.
  run(60)
  expect(terminal.job(1)!.call).toMatchObject({ name: 'MY SHIP', ship: 'feeder', work: { own: true, built: true, need: HOLDS.feeder!.work } })
  let unpaid = 0
  terminal.onPay = (_at, amount) => (unpaid += amount ? 0 : 1)
  run(700)
  expect(terminal.job(1)!.done).toBeGreaterThan(0.4)
  expect(unpaid).toBe(0)
  expect(game.fleet).toHaveLength(0)

  // One gang builds her in twenty-five minutes. She is launched, and sails on her first voyage.
  run(HOLDS.feeder!.work - 700)
  expect(game.fleet).toHaveLength(1)
  expect(game.fleet[0]).toMatchObject({ name: 'MY SHIP', size: 'feeder', home: 'sound', away: null, at: 'sound', calling: false, aboard: 22 })
  expect(game.fleet[0].due).toBeGreaterThan(game.time)
  expect(port.keels[1]).toBeUndefined()
  run(120)
  expect(terminal.job(1)!.call.work!.own).toBeUndefined()
})

test('her own ships trade overseas to a timetable, earn freight on every box and pay for each voyage', () => {
  const { game, port, run } = sim((g) => {
    maxOut(g.ports[0])
    g.ports[0].contracts = []
  })
  const ship = game.commission(port, feeder)
  ship.due = 20
  const freight = game.freight(ship, port)
  expect(freight).toBe(Math.round(port.def.contracts[0].fee * FREIGHT))
  const before = port.stats.earned
  let waited = 0
  while (ship.voyages === 0 && waited++ < 900) run(1)
  // She landed what she had aboard and took on a full hold; every box paid her freight, and going to sea cost her.
  expect(port.stats.boxes).toBe(44)
  expect(port.stats.earned - before).toBe(44 * freight - game.voyageCost(ship))
  expect(ship.earned).toBe(port.stats.earned - before)
  expect(port.stats.late).toBe(0)
  expect(ship).toMatchObject({ calling: false, aboard: 22, at: 'sound' })
  expect(ship.due - game.time).toBeCloseTo((2 * OVERSEAS) / ENGINES[1].pace, -1)
  // Back on time, voyage after voyage. In an hour she has earned more than she cost to build.
  run(3600 - waited)
  expect(ship.voyages).toBeGreaterThanOrEqual(4)
  expect(ship.earned).toBeGreaterThan(game.shipPrice(ship).cash)
  expect(ship.earned).toBeLessThan(game.shipPrice(ship).cash * 3)
})

test('a ship design trades speed for fuel and special cargo for room', () => {
  const game = new Game()
  game.persist = false
  const port = game.ports[0]
  const make = (over: Partial<Design>) => game.commission(port, { ...feeder, ...over })
  const [slow, usual, fast] = [0, 1, 2].map((engine) => make({ engine }))
  expect(game.seaTime(slow)).toBeGreaterThan(game.seaTime(usual))
  expect(game.seaTime(fast)).toBeLessThan(game.seaTime(usual))
  expect(game.voyageCost(slow)).toBeLessThan(game.voyageCost(usual))
  expect(game.voyageCost(fast)).toBeGreaterThan(game.voyageCost(usual) * 1.3)
  expect(game.shipPrice(fast).cash).toBeGreaterThan(game.shipPrice(usual).cash)
  // A voyage's freight is about the same whatever the holds are fitted for, in fewer boxes.
  const reefer = make({ fit: 'food' })
  const heavy = make({ fit: 'machines' })
  const voyage = (ship: typeof usual) => game.capacity(ship) * game.freight(ship, port)
  expect(game.capacity(reefer)).toBeLessThan(game.capacity(usual))
  expect(game.capacity(heavy)).toBeLessThan(game.capacity(reefer))
  for (const ship of [reefer, heavy]) expect(voyage(ship) / voyage(usual)).toBeGreaterThan(0.9)
  for (const ship of [reefer, heavy]) expect(voyage(ship) / voyage(usual)).toBeLessThan(1.1)
  // A bigger hull carries more for less a box.
  const big = make({ size: 'panamax' })
  expect(game.shipPrice(big).cash / game.capacity(big)).toBeGreaterThan(game.shipPrice(usual).cash / game.capacity(usual))
  expect(game.voyageCost(big) / game.capacity(big)).toBeLessThan(game.voyageCost(usual) / game.capacity(usual))
  // Sold at sea for a share of her price; not while she is in port.
  usual.calling = true
  expect(game.sell(usual.id)).toBeNull()
  const money = game.money
  expect(game.sell(fast.id)).toBe(game.shipPrice(fast).cash * RESALE)
  expect(game.money).toBe(money + game.shipPrice(fast).cash * RESALE)
  expect(game.fleet).not.toContain(fast)
})

test('between two of the player\'s ports a ship lands at one what she took on at the other', () => {
  const { game, terminals, run } = sim((g) => {
    g.ports[1].owned = true
    for (const port of g.ports.slice(0, 2)) {
      maxOut(port)
      port.contracts = []
    }
  })
  const [sound, amber] = game.ports
  const ship = game.commission(sound, feeder)
  expect(game.tradeBlocker(ship, 'sound', 'rotterdam')).toBe('Not a port of yours')
  expect(game.tradeBlocker(ship, 'sound', 'sound')).toBe('She needs somewhere to go')
  expect(game.setTrade(ship.id, 'sound', 'amber')).toBe(true)
  // A shorter haul than the one overseas pays less a box, and a port on a richer coast pays more.
  expect(game.freight(ship, sound)).toBeLessThan(Math.round(sound.def.contracts[0].fee * FREIGHT))
  expect(game.freight(ship, amber)).toBeGreaterThan(game.freight(ship, sound))
  ship.due = 10
  const until = (done: () => boolean) => {
    for (let waited = 0; !done() && waited < 1500; waited++) run(1)
    expect(done()).toBe(true)
  }
  until(() => ship.voyages === 1)
  const loaded = ship.aboard
  expect(loaded).toBeGreaterThan(10)
  expect(ship.at).toBe('amber')
  expect(ship.due - game.time).toBeCloseTo(passage(sound.def, amber.def), -1)
  const calls = () => BERTH_X.map((_, berth) => terminals[1].visiting(berth)).find((call) => call?.own === ship.id)
  until(() => calls() !== undefined)
  expect(calls()!.unload).toBe(loaded)
  const landed = amber.stats.boxes
  until(() => ship.voyages === 2)
  expect(amber.stats.boxes - landed).toBe(loaded + ship.aboard)
  expect(ship.at).toBe('sound')
  // A ship too deep for a port cannot be sent there.
  const big = game.commission(sound, { ...feeder, size: 'panamax' })
  amber.levels.dredge = 0
  expect(game.tradeBlocker(big, 'sound', 'amber')).toBe('Amber Bay is too shallow for her')
})

test('a save keeps the fleet and a ship on the slip', () => {
  const { game, port, terminal, run } = magnate()
  game.found(port, 'shipyard')
  game.order(port, 1, { ...feeder, name: 'kept' })
  const ship = game.commission(port, feeder)
  ship.calling = true
  run(400)
  terminal.snapshot()
  game.persist = true
  game.save()
  const loaded = Game.load()
  expect(loaded.ports[0].keels[1].design.name).toBe('KEPT')
  expect(loaded.ports[0].keels[1].done).toBeGreaterThan(300)
  expect(loaded.fleet).toHaveLength(1)
  expect(loaded.fleet[0]).toMatchObject({ id: ship.id, home: 'sound', calling: false, aboard: ship.aboard })
  // A game picked up again starts its clock afresh: she still has as long to run as she had.
  expect(loaded.fleet[0].due).toBeCloseTo(ship.due - game.time, 0)
})

test('following the advice grows a port from one feeder line to deep-sea ships', () => {
  const { game, port, terminal, run } = sim()
  const log: string[] = []
  const note = (what: string) => log.push(`${String(Math.round(game.time / 60)).padStart(3)} min  ${what}`)
  let lastSigned = 0
  run(4 * 3600, () => {
    if (Math.round(game.time) % 10) return
    const stage = terminal.diagnosis().stage
    const affordable = UPGRADES
      .filter((u) => game.canBuy(port, u.id) && (!stage || u.stage === stage))
      .sort((a, b) => game.cost(port, a.id) - game.cost(port, b.id))
    const next = port.def.contracts.find((c) => !port.contracts.includes(c.id))
    // Sign when the port itself says there is room.
    const room = terminal.diagnosis().cause === null && terminal.load < ROOM_TO_GROW
    if (next && room && port.canSign(next.id) && game.time - lastSigned > 600) {
      lastSigned = game.time
      note(`signed ${next.line}`)
      return game.sign(port, next.id)
    }
    // The next line needs deeper water: that comes before anything else in its stage.
    if (next && port.blocker(next.id) === 'Needs dredging' && terminal.diagnosis().cause === null) {
      if (game.canBuy(port, 'dredge')) {
        note('dredged the channel')
        game.buy(port, 'dredge')
      }
      return
    }
    if (stage && affordable.length) {
      note(`${stage}: bought ${affordable[0].name}`)
      return game.buy(port, affordable[0].id)
    }
    // Nothing to buy and ships leaving late: take the advice and drop the newest line for now.
    if (stage && port.reliability < 50 && port.contracts.length > 1 && game.time - lastSigned > 900) {
      lastSigned = game.time
      note(`running late: dropped ${port.contract(port.contracts.at(-1)!).line}`)
      game.cancel(port, port.contracts.at(-1)!)
    }
  })
  note(`ended with $${Math.round(game.money).toLocaleString()}, ${game.permits} permits, reliability `
    + `${Math.round(port.reliability)}%, ${port.contracts.length} lines, ${port.stats.ships} ships, `
    + `${port.stats.diverted} turned away, wages $${Math.round(game.payroll(port))} a minute`)
  console.log(log.join('\n'))
  expect(port.contracts.length).toBeGreaterThanOrEqual(3)
  expect(port.reliability).toBeGreaterThan(60)
  expect(game.money).toBeGreaterThan(0)
})
