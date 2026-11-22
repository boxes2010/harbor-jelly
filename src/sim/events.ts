import { C } from '../style'
import type { Game, Port } from './game'
import type { Terminal } from './terminal'
import { random } from './random'

export interface Choice {
  label: string
  hint: string
  run: () => void
}

export interface PortEvent {
  // Where it is happening. Shown when the player runs more than one port.
  port: Port
  title: string
  body: string
  choices: Choice[]
  fallback: number
  deadline: number
}

// A port the player runs, with the terminal that simulates it.
export interface Site {
  port: Port
  terminal: Terminal
}

const FIRST = [480, 720]
const GAP = [1800, 3600]
const between = ([a, b]: number[]) => a + random() * (b - a)

// Rare decisions that are worth pulling the player back for. Ignoring one applies its fallback.
export class Events {
  current: PortEvent | null = null
  expires = 0
  private nextAt: number
  private outcome = ''

  constructor(private game: Game, private sites: () => Site[], private fast: boolean) {
    this.nextAt = fast ? 20 : between(FIRST)
  }

  get lastOutcome(): string {
    return this.outcome
  }

  announce(text: string): void {
    this.outcome = text
  }

  update(): void {
    const now = this.game.time
    if (this.current) {
      if (now >= this.expires) this.choose(this.current.fallback)
      return
    }
    if (now < this.nextAt || this.game.quiet) return
    const sites = this.sites()
    const site = sites[Math.floor(random() * sites.length)]
    const makers = [this.storm, this.charter, this.wages, this.customs, this.hearing]
    this.current = makers[Math.floor(random() * makers.length)].call(this, site)
    this.expires = now + this.current.deadline
  }

  choose(index: number): void {
    if (!this.current) return
    this.current.choices[index].run()
    this.current = null
    this.nextAt = this.game.time + (this.fast ? 40 : between(GAP))
    this.game.save()
  }

  private storm({ port }: Site): PortEvent {
    const g = this.game
    return {
      port,
      title: 'Storm front on the forecast',
      body: 'High wind is due within the minute. Cranes cannot work safely in it.',
      fallback: 0,
      deadline: 60,
      choices: [
        {
          label: 'Secure the cranes',
          hint: 'Stop work now for about 45 seconds. No risk.',
          run: () => {
            port.holdUntil = port.stormUntil = g.time + 45
            this.outcome = 'Cranes secured. Work resumes after the storm.'
          },
        },
        {
          label: 'Work until it hits',
          hint: 'Lose only about 20 seconds, but a 1 in 3 chance of crane damage.',
          run: () => {
            port.holdUntil = port.stormUntil = g.time + 20
            if (random() < 0.35) {
              const repair = Math.max(200, Math.round(g.money * 0.12))
              g.money -= repair
              this.outcome = `A gust caught a boom. Repairs cost $${repair.toLocaleString()}.`
            } else {
              this.outcome = 'The storm passed without damage.'
            }
          },
        },
      ],
    }
  }

  private charter({ port, terminal }: Site): PortEvent {
    const g = this.game
    const bonus = 1200 + Math.round(port.stats.earned * 0.02)
    return {
      port,
      title: 'Unscheduled call requested',
      body: `A diverted ship, the STORMPETREL, asks to discharge 24 boxes and load 16. Turn her round in 6 minutes and the line pays a $${bonus.toLocaleString()} bonus. A late departure hurts your reliability.`,
      fallback: 1,
      deadline: 75,
      choices: [
        {
          label: 'Accept the call',
          hint: 'She joins the queue now.',
          run: () => {
            terminal.enqueue({
              name: 'STORMPETREL', ship: port.levels.dredge ? 'panamax' : 'feeder', hull: C.berry,
              unload: 24, load: 16, fee: 28, bonus, window: 360, arrivedAt: g.time, contract: null, cargo: 'goods',
            })
            this.outcome = 'STORMPETREL is on her way in.'
          },
        },
        { label: 'Decline', hint: 'Nothing changes.', run: () => (this.outcome = 'The call went to another port.') },
      ],
    }
  }

  private wages({ port }: Site): PortEvent {
    const g = this.game
    return {
      port,
      title: 'Dockers ask for a raise',
      body: 'The union wants better pay. Agreeing raises wages at every port for good. Refusing risks a walkout here.',
      fallback: 0,
      deadline: 90,
      choices: [
        {
          label: 'Agree to the raise',
          hint: 'Wages rise by 10% for good.',
          run: () => {
            g.wageLevel *= 1.1
            this.outcome = 'The raise is agreed. Work continues.'
          },
        },
        {
          label: 'Refuse',
          hint: '40% chance of a 90 second strike.',
          run: () => {
            if (random() < 0.4) {
              port.holdUntil = g.time + 90
              this.outcome = 'The dockers have walked out for 90 seconds.'
            } else {
              this.outcome = 'The union backed down, for now.'
            }
          },
        },
      ],
    }
  }

  private hearing({ port }: Site): PortEvent {
    const g = this.game
    const gift = Math.max(600, Math.round(g.money * 0.15))
    return {
      port,
      title: 'Council hearing on the port',
      body: 'Residents want the waterfront tidied before the council approves anything more. Pay for a harbour park and it will issue a permit now.',
      fallback: 1,
      deadline: 90,
      choices: [
        {
          label: `Fund the park for $${gift.toLocaleString()}`,
          hint: 'One permit, straight away.',
          run: () => {
            g.money -= gift
            g.permits++
            this.outcome = 'The park is funded. The council has issued a permit.'
          },
        },
        { label: 'Decline', hint: 'Nothing changes.', run: () => (this.outcome = 'The council moved on to other business.') },
      ],
    }
  }

  private customs({ port }: Site): PortEvent {
    const g = this.game
    const fee = Math.max(150, Math.round(g.money * 0.08))
    return {
      port,
      title: 'Customs crackdown',
      body: 'Inspectors are checking every truck. The gate will run at half speed for five minutes unless you pay for extra inspection lanes.',
      fallback: 1,
      deadline: 75,
      choices: [
        {
          label: `Pay $${fee.toLocaleString()}`,
          hint: 'The gate keeps its normal pace.',
          run: () => {
            g.money -= fee
            this.outcome = 'Extra inspectors are on site. The gate is unaffected.'
          },
        },
        {
          label: 'Wait it out',
          hint: 'Half-speed gate for five minutes.',
          run: () => {
            port.gateSlowUntil = g.time + 300
            this.outcome = 'The gate is running at half speed.'
          },
        },
      ],
    }
  }
}
