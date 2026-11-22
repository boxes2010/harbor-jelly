import '@fontsource/m-plus-rounded-1c/latin-500.css'
import '@fontsource/m-plus-rounded-1c/latin-700.css'
import '@fontsource/m-plus-rounded-1c/latin-800.css'
import '@fontsource/m-plus-rounded-1c/latin-900.css'
import './ui.css'
import type { Fx } from './fx'
import {
  CARGO_ICONS, CHECK, CLOSE, HAT, ICONS, INFO, LOCK, MINUS, PENNANT, PLUS, PORT_ICONS, SEAL, SHIP, SWAP, TRADE_ICONS, UP,
  WORKS_ICONS,
  ZOOM_IN, ZOOM_OUT, hat,
} from './icons'
import { GRADES, PAY, SKILL, TRADES, WAGE, pace, promotable, wage, type Post, type Trade, type Worker } from './sim/crew'
import type { Events } from './sim/events'
import {
  CARGO, CREW_POOL, ENGINES, FITS, Game, HOLDS, HULL_PAINTS, PACE, RESALE, SAILINGS, STAMPS_PER_PERMIT, STREAK, TRAIN_TIME, UPGRADES,
  WORKS,
  type CargoId, type ChainStage, type Contract, type Design, type Industry, type Offer, type Port, type Price, type UpgradeId,
  type Vessel, type Works,
} from './sim/game'
import { BERTH_X, CLASSES, type ClassId } from './sim/layout'
import { ASKING, MAX_QUEUE, type Cause, type Target, type Terminal } from './sim/terminal'
import { chime, notify, purchase, signed } from './sound'
import { C } from './style'

type Tab = 'build' | 'crew' | 'ships' | 'port'
const TABS: [Tab, string][] = [['build', 'Build'], ['crew', 'Crew'], ['ships', 'Ships'], ['port', 'Port']]
const ASK_SLOTS = ASKING.most
const ASK_STANDS = ASKING.stands

// Each link of the chain has its own colour, used on its section, its level pips and the advice tag.
const STAGES: { id: ChainStage; color: keyof typeof C; ink: keyof typeof C }[] = [
  { id: 'Berth', color: 'signalBlue', ink: 'white' },
  { id: 'Cranes', color: 'signalRed', ink: 'white' },
  { id: 'Yard', color: 'amber', ink: 'ink' },
  { id: 'Gate', color: 'green', ink: 'white' },
]
// Where time is lost: a word for the bar, and the sentence behind it.
const DELAYS: [Cause, string, string][] = [
  ['tractors', 'Tractors', 'Cranes waiting for tractors'],
  ['yardCranes', 'Yard cranes', 'Queues at the yard cranes'],
  ['yard', 'Yard space', 'Cranes waiting for yard space'],
  ['exports', 'Exports', 'Ships waiting for export boxes'],
  ['gate', 'Trucks', 'Imports waiting for trucks'],
  ['channel', 'Channel', 'Ships waiting for the channel'],
  ['queue', 'Offshore', 'Ships waiting offshore'],
]
const RECORD = [
  ['boxes', 'Boxes handled'], ['ships', 'Ships served'], ['onTime', 'Left on time'], ['diverted', 'Turned away'],
  ['best', 'Best bonus'], ['earned', 'Earned here'], ['wages', 'Wages a minute'], ['rate', 'Net a minute'],
] as const
// The plate on a contract card is as long as the ship that will call.
const HULL_LENGTH = { feeder: 88, panamax: 104, neo: 120 }
const SHIP_SIZES = ['Feeder', 'Panamax', 'Neo-Panamax']
const MAX_PIPS = 8
// The earning rate beside the cash is measured over this many seconds of play.
const RATE_SPAN = 120

const dollars = (n: number) => `${n < -0.5 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`
const cents = (n: number) => `$${n.toFixed(2)}`
const plural = (n: number, thing: string) => `${n} ${thing}${n === 1 ? '' : 's'}`
const minutes = (seconds: number) => `${Math.round(seconds / 6) / 10} min`
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
const el = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) =>
  root.querySelector<T>(selector)!
const all = (selector: string, root: ParentNode = document) => [...root.querySelectorAll<HTMLElement>(selector)]
const upgrade = (id: UpgradeId) => UPGRADES.find((u) => u.id === id)!
const same = (a: Offer | null, b: Offer | null) => a?.id === b?.id && a?.at === b?.at
// A line's name short enough for a button.
const short = (c: Contract) => c.line.split(' ').slice(0, 2).join(' ')
// How a ship did against her window, as it is written on her payout.
const paceName = (used: number) => {
  const pace = PACE.find((p) => used <= p.within)
  return used > 1 ? 'Late' : pace ? `${pace.name} ×${pace.pays}` : 'On time'
}

// What can be built on or improved about each kind of thing in the port. Nothing else is offered there.
const YARDS = Object.keys(WORKS) as Works[]

function offersFor(target: Target, port: Port): Offer[] {
  switch (target.kind) {
    case 'berth':
      return port.worksAt(target.berth) ? [{ id: 'gang', at: target.berth }] : [{ id: 'crane', at: target.berth }, { id: 'craneSpeed' }]
    case 'site': return [{ id: 'berth', at: target.berth }]
    case 'channel': return [{ id: 'dredge' }, { id: 'tug' }]
    case 'block': return [{ id: 'stackHeight' }, { id: 'yardCrane' }]
    case 'plot': return [{ id: 'yardBlock', at: target.block }]
    case 'tractors': return [{ id: 'carrier' }, { id: 'carrierSpeed' }]
    case 'gate': return [{ id: 'gate' }]
    case 'office': return []
  }
}

// What a thing is called, and one line on how it stands.
function naming(target: Target, port: Port): [string, string] {
  const { levels } = port
  switch (target.kind) {
    case 'berth': {
      const works = port.worksAt(target.berth)
      if (works) return [WORKS[works].name, `Berth ${target.berth + 1}, ${plural(port.gangs[target.berth], 'gang')}`]
      const kept = port.contracts.filter((id) => port.home(id) === target.berth).map((id) => short(port.contract(id)))
      return [`Berth ${target.berth + 1}`, plural(port.cranes[target.berth], 'quay crane')
        + (kept.length ? `, kept for ${kept.join(' and ')}` : '')]
    }
    case 'site': return [`Berth ${target.berth + 1}`, 'Not built yet']
    case 'channel': return ['Channel', `Deep enough for ${SHIP_SIZES[Math.min(levels.dredge, SHIP_SIZES.length - 1)]} ships`]
    case 'block': return ['Yard block', `Stacks ${2 + levels.stackHeight} high`]
    case 'plot': return ['Yard block', 'Not opened yet']
    case 'tractors': return ['Yard tractors', plural(1 + levels.carrier, 'tractor')]
    case 'gate': return ['Gate', plural(1 + levels.gate, 'lane')]
    case 'office': return ['Terminal office', plural(port.crews, 'crew') + ' waiting']
  }
}

// A card's name: at a picked place it says what pressing it does there.
function cardName(offer: Offer): string {
  if (offer.at === undefined) return upgrade(offer.id).name
  if (offer.id === 'berth') return `Open berth ${offer.at + 1}`
  if (offer.id === 'yardBlock') return 'Open this block'
  return upgrade(offer.id).name
}

export interface UIOptions {
  open: string | null
  hover: string | null
  pick: string | null
  alerts: boolean
}

// What the interface needs from the world outside it.
export interface UIHooks {
  // The running terminal of a port, or null for a port not bought yet.
  terminal: (port: Port) => Terminal | null
  // Put another owned port on screen.
  travel: (index: number) => void
  // A port was just bought and needs building.
  opened: (port: Port) => void
  // The stretch of the port in view, as fractions of its whole length.
  view: () => { from: number; to: number }
  // Bring the close view to this point along the port.
  lookAt: (fraction: number) => void
  // Switch between the close view and the whole port.
  zoom: () => void
}

export class UI {
  private tab: Tab | null = null
  // The thing in the world the player clicked, and the one under the pointer.
  private picked: Target | null = null
  private pointed: Target | null = null
  // The card under the pointer.
  private focus: Offer | null = null
  private dealFocus: string | null = null
  // The berth control under the pointer, as its action and argument.
  private ruleFocus: string | null = null
  // The words carried by whatever is under the pointer, and the card whose words are pinned by its info button.
  private tip: string | null = null
  private pinned: Offer | null = null
  // The person picked out in the crew tab, and whether the next press sends them somewhere.
  private chosen: number | null = null
  private swapping = false
  private letgoArmed = 0
  // The ship the player is drawing up at a shipyard, and a ship of theirs about to be sold.
  private design: Design = { name: '', hull: HULL_PAINTS[0], size: 'feeder', engine: 1, fit: 'goods' }
  private selling = { id: 0, until: 0 }
  // The ports' takings after wages at moments over the last couple of minutes, for the rate beside the cash.
  private takings: { at: number; sum: number }[] = []
  private run = 0
  private shown: number
  private eventKey = ''
  private outcome = ''
  private toastUntil = 0
  private resetArmed = 0
  private alerts: boolean
  private written = new WeakMap<HTMLElement, string>()

  constructor(
    private game: Game, private events: Events, private fx: Fx, private hooks: UIHooks, options: UIOptions,
  ) {
    const root = document.documentElement.style
    for (const [name, value] of Object.entries(C)) root.setProperty(`--c-${name}`, value)
    this.alerts = options.alerts
    this.shown = game.money
    el('#hud').innerHTML = this.hudHtml()
    el('#dock').innerHTML = this.dockHtml()
    fx.onLand = () => this.kick(el('#cash'), 'bump')
    fx.onWindfall = () => this.kick(el('#cash'), 'jackpot')

    document.addEventListener('click', (e) => this.click(e))
    const point = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      const card = target.closest<HTMLElement>('.card[data-up]')
      this.terminal.plan((target.closest<HTMLElement>('.card.found')?.dataset.found as Works | undefined) ?? null)
      this.tip = target.closest<HTMLElement>('[data-tip]')?.dataset.tip || null
      this.setFocus(card ? this.offerOf(card) : this.pinned, target.closest<HTMLElement>('.deal')?.dataset.deal ?? null)
      const rule = target.closest<HTMLElement>('.rules [data-do]')
      this.ruleFocus = rule ? `${rule.dataset.do}:${rule.dataset.arg ?? ''}` : null
      this.says()
    }
    // A card pinned by the ?hover dev switch stays put whatever the real pointer does.
    if (!options.hover) {
      for (const panel of [el('#dock'), el('#context')]) {
        panel.addEventListener('pointermove', point)
        panel.addEventListener('pointerdown', point)
        panel.addEventListener('pointerleave', () => {
          this.ruleFocus = null
          this.tip = null
          this.terminal.plan(null)
          this.setFocus(this.pinned, null)
          this.says()
        })
      }
    }
    // The little map of the port: press or drag along it to move the view there.
    const map = el('.map')
    const seek = (e: PointerEvent) => {
      if (!e.buttons && e.type !== 'pointerdown') return
      const box = map.getBoundingClientRect()
      hooks.lookAt(Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)))
    }
    map.addEventListener('pointerdown', (e) => {
      map.setPointerCapture(e.pointerId)
      seek(e)
    })
    map.addEventListener('pointermove', seek)
    el('#dock').addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) el('#tray section.on').scrollLeft += e.deltaY
    }, { passive: true })

    const open = TABS.find(([id]) => id === (options.open === 'contracts' ? 'ships' : options.open))
    this.open(open ? open[0] : null)
    if (options.pick) {
      const [kind, n] = options.pick.split(':')
      this.pick({ kind, berth: Number(n), block: Number(n) } as Target, window.innerWidth / 2)
    }
    if (options.hover) {
      const [id, at] = options.hover.split('@')
      this.setFocus({ id: id as UpgradeId, at: at === undefined ? undefined : Number(at) }, null)
    }
    this.refresh()
    setInterval(() => this.refresh(), 250)
  }

  get managing(): boolean {
    return this.tab !== null
  }

  // The port on screen, and the terminal that runs it.
  private get port(): Port {
    return this.game.port
  }

  private get terminal(): Terminal {
    return this.hooks.terminal(this.port)!
  }

  // Puts everything away, as a click on empty ground does.
  dismiss(): void {
    if (this.tab) this.open(null)
    this.pick(null, 0)
  }

  // The pointer is over this thing in the world, or over nothing.
  point(target: Target | null, x: number, y: number): void {
    this.pointed = target
    const tip = el('#tip')
    tip.hidden = target === null
    if (target) {
      const [name, state] = naming(target, this.port)
      this.put(tip, `<b>${name}</b>${state}`)
      // Above the pointer, unless that would put it over the status bar.
      const top = y - 34 < 46 ? y + 20 : y - 34
      tip.style.transform = `translate(${Math.min(x + 14, window.innerWidth - tip.offsetWidth - 8)}px, ${top}px)`
    }
    this.terminal.mark(this.picked ?? target)
  }

  // The player clicked this thing: show what can be done with it, and nothing else. Null closes that.
  pick(target: Target | null, x: number): void {
    // The office has nothing to build: it is where the port's figures are kept.
    if (target?.kind === 'office') {
      this.pick(null, 0)
      return this.open('port')
    }
    if (target && this.tab) this.open(null)
    this.picked = target
    this.pinned = null
    const panel = el('#context')
    panel.hidden = target === null
    this.setFocus(null, null)
    this.terminal.mark(target ?? this.pointed)
    if (!target) return
    panel.innerHTML = `
      <div class="note"><span class="say"></span><button class="x" data-do="unpick" aria-label="Close">${CLOSE}</button></div>
      <div class="cards">${offersFor(target, this.port).map((offer) => this.cardHtml(offer)).join('')}${
        target.kind === 'site' ? YARDS.map((works) => this.foundHtml(works)).join('') : ''}${
        target.kind === 'berth' ? this.rulesHtml(target.berth) : ''}</div>`
    this.ruleFocus = null
    this.refresh()
    panel.style.left = `${Math.max(8, Math.min(window.innerWidth - panel.offsetWidth - 8, x - panel.offsetWidth / 2))}px`
    this.kick(panel, 'rise')
  }

  // How a berth is run: which lines' ships are kept for it, whether its cranes get tractors first, and
  // sending one of its cranes to the berth next door.
  private rulesHtml(berth: number): string {
    // Any berth but the first can be turned over to other work.
    const others = (['boxes', ...YARDS] as Industry[]).filter((industry) => industry !== this.port.yards[berth])
    const turn = berth === 0 ? '' : `<div class="rule"><span class="cap">Turn into</span>${others.map((industry) =>
      `<button class="pick icon-only" data-do="convert" data-arg="${industry}">${industry === 'boxes' ? ICONS.berth : WORKS_ICONS[industry]}</button>`).join('')}</div>`
    const works = this.port.worksAt(berth)
    if (works) {
      const builds = works !== 'shipyard' ? '' : `<div class="rule"><span class="cap">Builds</span>${WORKS[works].jobs.map((job, i) =>
        `<button class="pick" data-do="product" data-arg="${i}">${job.name}</button>`).join('')}</div>`
      // A shipyard also builds for the player: a ship drawn up here, to trade with.
      const own = works !== 'shipyard' ? '' : `
        <div class="rules own" data-berth="${berth}">
          <div class="rule"><span class="cap">Your own</span>${(Object.keys(HOLDS) as ClassId[]).map((size) =>
            `<button class="pick" data-do="design" data-arg="size=${size}">${CLASSES[size].name}</button>`).join('')}${ENGINES.map((engine, i) =>
            `<button class="pick" data-do="design" data-arg="engine=${i}">${engine.name}</button>`).join('')}</div>
          <div class="rule"><span class="cap">Holds</span>${(Object.keys(FITS) as CargoId[]).map((fit) =>
            `<button class="pick icon-only" data-do="design" data-arg="fit=${fit}">${CARGO_ICONS[fit]}</button>`).join('')}${HULL_PAINTS.map((color) =>
            `<button class="pick swatch" data-do="design" data-arg="hull=${color}"><i style="background: ${color}"></i></button>`).join('')}</div>
          <div class="rule"><span class="cap">Name</span><input class="naming" maxlength="14" spellcheck="false" aria-label="Her name">
            <button class="btn" data-do="order"><span class="tag"></span></button></div>
        </div>`
      return `
        <div class="rules" data-berth="${berth}" data-works="${works}">
          <div class="rule"><span class="cap">On the ${works === 'shipyard' ? 'slip' : works === 'repair' ? 'lift' : 'berth'}</span><b class="vessel"></b><i class="bar"><i></i></i></div>
          ${builds}${turn}
        </div>${own}`
    }
    const lines = this.port.def.contracts.map((c) =>
      `<button class="pick" data-do="home" data-arg="${c.id}"><i style="background: ${c.hull}"></i>${short(c)}<small></small></button>`)
    const moves = [berth + 1, berth - 1].filter((to) => to >= 0 && to < BERTH_X.length).map((to) =>
      `<button class="btn" data-do="move" data-arg="${to}">To berth ${to + 1}<span class="tag"></span></button>`)
    return `
      <div class="rules" data-berth="${berth}">
        <div class="rule"><span class="cap">Ships</span>${lines.join('')}</div>
        <div class="rule"><span class="cap">Tractors</span><button class="pick" data-do="first">${PENNANT}First call</button></div>
        <div class="rule"><span class="cap">Send a crane</span>${moves.join('')}</div>
        ${turn}
      </div>`
  }

  private updateRules(): void {
    const { game, port } = this
    const panel = document.querySelector<HTMLElement>('#context .rules')
    if (!panel || !this.picked) return
    const berth = Number(panel.dataset.berth)
    for (const button of all('[data-do=convert]', panel)) {
      const industry = button.dataset.arg as Industry
      const blocker = port.convertBlocker(berth, industry)
      const price = game.convertPrice(port, berth, industry)
      button.setAttribute('aria-disabled', String(blocker !== null || !this.affordable(price)))
      const name = industry === 'boxes' ? 'Container berth' : WORKS[industry].name
      button.dataset.tip = `<b>Turn into a ${name.toLowerCase()}</b><span>${industry === 'boxes' ? 'Built with its first crane.' : WORKS[industry].blurb} `
        + `What stands here now is sold with the yard, and its hands wait in the hall for the new work.</span>`
        + `<em>${game.god ? 'Free' : dollars(price.cash)}</em>${blocker ? `<strong>${blocker}</strong>` : ''}`
    }
    const works = panel.dataset.works as Works | undefined
    const drawing = document.querySelector<HTMLElement>('#context .rules.own')
    if (drawing) this.updateDesign(drawing)
    if (works) {
      const job = this.terminal.job(berth)
      const def = job && WORKS[works].jobs.find((j) => j.vessel === job.call.work!.vessel && j.work === job.call.work!.need)
      this.put(el('.vessel', panel), job ? `${job.call.name}` : 'Nothing yet')
      el('.bar i', panel).style.width = `${(job?.done ?? 0) * 100}%`
      el('.rule', panel).dataset.tip = job?.call.work?.own
        ? `<b>${job.call.name}</b><span>A ship of your own, ${Math.round(job.done * 100)}% built. She joins your fleet the day she is launched.</span>`
        : job
          ? `<b>${job.call.name}</b><span>${def?.name ?? 'Work'}: ${Math.round(job.done * 100)}% done. Pays ${dollars(job.call.fee)}, plus `
            + `${dollars(job.call.bonus)} if she is away within ${minutes(job.call.window)}.</span>`
          : `<b>${WORKS[works].name}</b><span>${WORKS[works].blurb}</span>`
      for (const button of all('[data-do=product]', panel)) {
        const index = Number(button.dataset.arg)
        const item = WORKS[works].jobs[index]
        button.setAttribute('aria-pressed', String((port.products[berth] ?? 0) === index))
        button.dataset.tip = `<b>${item.name}</b><span>About ${minutes(item.work / Math.max(1, port.gangs[berth]))} of work for the gangs here. `
          + `Pays ${dollars(item.fee)} in stages as she is built, plus ${dollars(item.bonus)} for delivery on time. Laid down when the slip is next clear.</span>`
      }
      return
    }
    for (const button of all('[data-do=home]', panel)) {
      const id = button.dataset.arg!
      const home = port.home(id)
      button.hidden = !port.contracts.includes(id)
      button.setAttribute('aria-pressed', String(home === berth))
      this.put(el('small', button), home !== null && home !== berth ? `${home + 1}` : '')
    }
    el('[data-do=first]', panel).setAttribute('aria-pressed', String(port.first === berth))
    for (const button of all('[data-do=move]', panel)) {
      const blocked = port.moveBlocker(berth, Number(button.dataset.arg)) !== null
      const can = !blocked && this.affordable(game.movePrice)
      button.classList.toggle('gold', can)
      button.setAttribute('aria-disabled', String(!can))
      this.put(el('.tag', button), game.god ? 'Free' : `<i class="coin"></i>${dollars(game.movePrice.cash)}`)
    }
  }

  // The ship being drawn up at a shipyard: what is picked, what each choice means, and what she would cost.
  private updateDesign(panel: HTMLElement): void {
    const { game, port, design } = this
    const berth = Number(panel.dataset.berth)
    const gangs = Math.max(1, port.gangs[berth])
    for (const button of all('[data-do=design]', panel)) {
      const [key, value] = button.dataset.arg!.split('=')
      button.setAttribute('aria-pressed', String(String(design[key as keyof Design]) === value))
      if (key === 'size') {
        const hold = HOLDS[value as ClassId]!
        button.dataset.tip = `<b>${CLASSES[value as ClassId].name}</b><span>Carries ${hold.boxes} boxes each way. ${dollars(hold.price)}, and about `
          + `${minutes(hold.work / gangs)} on the slip with the gangs here.${CLASSES[value as ClassId].dredge ? ' Needs dredged water wherever she calls.' : ''}</span>`
      } else if (key === 'engine') {
        const engine = ENGINES[Number(value)]
        button.dataset.tip = `<b>${engine.name} engine</b><span>${engine.note}. Her crew are paid by the day either way.</span>`
      } else if (key === 'fit') {
        const fit = FITS[value as CargoId]
        button.dataset.tip = `<b>${fit.name}</b><span>She carries ${CARGO[value as CargoId].name.toLowerCase()}`
          + (value === 'goods' ? '.' : `: ${Math.round((fit.freight - 1) * 100)}% more a box, in ${Math.round((1 - fit.boxes) * 100)}% fewer boxes. `
            + 'About the same freight for less time at the berth.') + '</span>'
      } else {
        button.dataset.tip = '<b>Livery</b><span>The colour of her hull.</span>'
      }
    }
    el<HTMLInputElement>('.naming', panel).placeholder = game.nextName
    const price = game.shipPrice(design)
    const blocker = game.orderBlocker(port, berth, design)
    const short = game.lacks(price, port)
    const can = blocker === null && !short.cash
    const button = el('[data-do=order]', panel)
    button.classList.toggle('gold', can)
    button.setAttribute('aria-disabled', String(!can))
    this.put(el('.tag', button), game.god ? 'Lay her down' : `<i class="coin"></i>${dollars(price.cash)}`)
    button.dataset.tip = `<b>Lay her down</b><span>A ${CLASSES[design.size].name} ship of your own: ${game.capacity(design)} boxes each way, `
      + `${FITS[design.fit].name.toLowerCase()}, the ${ENGINES[design.engine].name.toLowerCase()} engine. Paid for now, about ${minutes(game.shipWork(design) / gangs)} `
      + 'on the slip once it is clear, and yours to trade with from the day she is launched.</span>'
      + (blocker ? `<strong>${blocker}</strong>` : short.cash ? `<strong>Need ${dollars(short.cash)} more</strong>` : '')
  }

  // One of the player's own ships, as a card: her side, what she carries, where she is and where she trades.
  private vesselHtml(vessel: Vessel): string {
    return `
      <article class="deal own" data-vessel="${vessel.id}" style="--hull: ${vessel.hull}; --len: ${HULL_LENGTH[vessel.size]}px">
        <div class="plate"><div class="hullplate"><b>${vessel.name}</b></div><i class="cargo">${CARGO_ICONS[vessel.fit]}</i></div>
        <div class="figs"><span class="fig lies"></span><span class="fig sum"></span></div>
        <div class="act">
          <button class="pick" data-do="trade" data-arg="home"></button>
          <button class="pick" data-do="trade" data-arg="away"></button>
          <button class="btn slim" data-do="scrap" aria-label="Sell her"></button>
        </div>
      </article>`
  }

  private updateFleet(): void {
    const { game } = this
    const group = el('.group.ours')
    group.hidden = game.fleet.length === 0
    this.put(el('.hulls', group), game.fleet.map((vessel) => this.vesselHtml(vessel)).join(''))
    const named = (id: string | null) => (id === null ? 'Overseas' : game.ports.find((p) => p.def.id === id)!.def.name)
    for (const vessel of game.fleet) {
      const card = el(`.deal.own[data-vessel="${vessel.id}"]`, group)
      const there = named(vessel.at)
      card.dataset.state = vessel.calling ? 'active' : 'open'
      this.put(el('.lies', card), vessel.calling ? `At ${there}` : game.time < vessel.due ? `${clock(vessel.due - game.time)} to ${there}` : `Off ${there}`)
      this.put(el('.sum', card), `<i class="coin"></i>${dollars(vessel.earned)}`)
      const [home, away, scrap] = all('.act button', card)
      this.put(home, named(vessel.home))
      this.put(away, named(vessel.away))
      home.dataset.tip = '<b>Trades from</b><span>Press to move her to another of your ports that is deep enough for her.</span>'
      away.dataset.tip = '<b>Trades to</b><span>Overseas and back, or another of your ports. Between two of your own she is paid at both ends, '
        + 'and lands at one what she took on at the other.</span>'
      const armed = this.selling.id === vessel.id && performance.now() < this.selling.until
      const fetches = Math.round((game.shipPrice(vessel).cash * RESALE) / 10) * 10
      this.put(scrap, armed ? 'Sure?' : CLOSE)
      scrap.dataset.tip = `<b>Sell ${vessel.name}</b><span>She fetches ${dollars(fetches)}. Only while she is at sea.</span>`
      const ends = [vessel.home, vessel.away].filter((id): id is string => id !== null).map((id) => game.ports.find((p) => p.def.id === id)!)
      card.dataset.tip = `<b>${vessel.name}</b><span>${CLASSES[vessel.size].name}, ${ENGINES[vessel.engine].name.toLowerCase()} engine, `
        + `${FITS[vessel.fit].name.toLowerCase()}: ${game.capacity(vessel)} boxes each way between ${named(vessel.home)} and `
        + `${vessel.away === null ? 'the ports overseas' : named(vessel.away)}. Earns ${ends.map((port) => `${dollars(game.freight(vessel, port))} a box at ${port.def.name}`).join(' and ')}. `
        + `Each time she sails costs ${dollars(game.voyageCost(vessel))} and she is ${minutes(game.seaTime(vessel))} at sea.</span>`
        + `<em>${plural(vessel.voyages, 'voyage')}, ${dollars(vessel.earned)} cleared</em>`
    }
  }

  // What the berth control under the pointer does.
  private ruleSays(berth: number): string | null {
    const { port } = this
    const [action, arg] = (this.ruleFocus ?? '').split(':')
    if (action === 'home') {
      const c = port.contract(arg)
      return `<b>${c.line}</b><span>Keep this line's ships for berth ${berth + 1}. They wait offshore for it, and trucks `
        + 'bring their exports to the stacks behind it.</span>'
    }
    if (action === 'first') {
      return `<b>First call on tractors</b><span>Idle tractors go to this berth's cranes before any other berth's.</span>`
    }
    if (action === 'move') {
      const blocker = port.moveBlocker(berth, Number(arg))
      return `<b>Send a crane to berth ${Number(arg) + 1}</b><span>The crane nearest that berth runs there along the rails `
        + `once its lift is done.</span>${blocker ? `<strong>${blocker}.</strong>` : ''}`
    }
    return null
  }

  // Another port is on screen: its lines replace the last port's on the contracts tab.
  portChanged(): void {
    el('#tray section[data-tab=ships]').innerHTML = this.shipsHtml()
    this.written.delete(el('.roster'))
    this.chosen = null
    this.pointed = null
    this.pick(null, 0)
    this.refresh()
  }

  // Writes markup only when it changed, so hover and press states survive a refresh.
  private put(node: HTMLElement, html: string): void {
    if (this.written.get(node) === html) return
    this.written.set(node, html)
    node.innerHTML = html
  }

  // Restarts a one-shot animation class.
  private kick(node: HTMLElement, name: string): void {
    node.classList.remove(name)
    void node.offsetWidth
    node.classList.add(name)
  }

  private hudHtml(): string {
    return `
      <div class="ports">${this.game.ports.map((port, i) =>
        `<button class="port" data-do="port" data-arg="${i}"><i class="mark"></i>${port.def.name}</button>`).join('')}
        <button class="port more" data-do="port" data-arg="-1" title="More harbours">${PLUS}</button></div>
      <div class="chip" id="local" hidden><span class="cap"></span><span class="meter"><i></i></span><b></b></div>
      <div class="chip" id="view">
        <button class="zoom" data-do="zoom"></button>
        <span class="map" title="Where you are along the port. Press or drag to move."><i></i></span>
      </div>
      <div class="chip" id="queue" title="Ships waiting offshore for a free berth">
        <span class="cap">Offshore</span><span class="fleet">${'<i></i>'.repeat(5)}</span></div>
      <div class="chip" id="yard" title="How full the yard is">
        <span class="cap">Yard</span><span class="meter"><i></i></span><b></b></div>
      <div class="chip" id="reliability" title="Share of ships that leave on time. Shipping lines check it before they sign.">
        <span class="cap">Reliability</span><span class="ring"></span><b></b></div>
      <div class="chip" id="run" title="Ships in a row that have left on time. Each adds ${STREAK.step * 100}% to the next ship's bonus, up to ${STREAK.most * STREAK.step * 100}%. One late ship ends the run.">
        <span class="token">${PENNANT}</span><b></b><small></small></div>
      <div class="chip" id="crews" title="People who could take a new machine: those asking for work, and hands with nothing to work. Every quay crane, tractor, yard block and gate lane needs someone. Someone new comes asking every few minutes, and up to ${CREW_POOL} wait.">
        <span class="token">${HAT}</span><b></b><span class="ring"></span></div>
      <div class="chip" id="permits" title="Permits from the council, needed for new berths, dredging, the outer yard blocks and new ports. Each ship that leaves on time earns a stamp, a late one loses two, and ten stamps make a permit.">
        <span class="token">${SEAL}</span><b></b><span class="stamps">${'<i></i>'.repeat(STAMPS_PER_PERMIT)}</span></div>
      <div class="chip" id="cash" title="Cash, and what the ports have been clearing a minute after wages. Wages are paid every minute."><i class="coin"></i><span class="sum"><b id="money"></b><small id="rate"></small></span></div>`
  }

  private dockHtml(): string {
    return `
      <div class="tabrow">
        ${TABS.map(([id, label]) => `<button class="tab" data-do="tab" data-arg="${id}">${label}<i class="dot"></i></button>`).join('')}
        <div id="ribbon"></div>
        <button class="x" data-do="close" aria-label="Close">${CLOSE}</button>
      </div>
      <div id="tray">
        <section data-tab="build">${this.buildHtml()}</section>
        <section data-tab="crew">${this.crewHtml()}</section>
        <section data-tab="ships">${this.shipsHtml()}</section>
        <section data-tab="port">${this.portHtml()}</section>
      </div>`
  }

  // One thing on offer. In the build tab the port picks the place; on a clicked thing the place is that thing.
  private cardHtml(offer: Offer): string {
    const u = upgrade(offer.id)
    const stage = STAGES.find((s) => s.id === u.stage)!
    const place = offer.at === undefined ? '' : ` data-at="${offer.at}"`
    return `
      <article class="card" data-up="${u.id}"${place} style="--stage: var(--c-${stage.color})">
        <span class="pips"></span>
        <span class="icon">${ICONS[u.id]}</span>
        <span class="needs"></span>
        <button class="info" data-do="info" aria-label="What it does">${INFO}</button>
        <b class="name">${cardName(offer)}</b>
        <button class="btn buy" data-do="buy"><span class="tag"></span></button>
      </article>`
  }

  private offerOf(card: HTMLElement): Offer {
    return { id: card.dataset.up as UpgradeId, at: card.dataset.at === undefined ? undefined : Number(card.dataset.at) }
  }

  private buildHtml(): string {
    const groups = STAGES.map((stage) => {
      const cards = UPGRADES.filter((u) => u.stage === stage.id)
      return `
        <div class="group" data-stage="${stage.id}"
          style="--stage: var(--c-${stage.color}); --stage-ink: var(--c-${stage.ink}); flex: ${cards.length} 1 0; min-width: min-content">
          <span class="spine">${stage.id}</span>
          ${cards.map((u) => this.cardHtml({ id: u.id })).join('')}
        </div>`
    })
    // What else the next stretch of quay can be: the other harbour works, beside the container berth.
    groups.splice(1, 0, `
      <div class="group" style="--stage: var(--c-navy); flex: ${YARDS.length} 1 0; min-width: min-content">
        <span class="spine">Yards</span>${YARDS.map((works) => this.foundHtml(works)).join('')}
      </div>`)
    return groups.join('')
  }

  // A yard that can be founded on the next stretch of quay: its picture, its name and its price.
  private foundHtml(works: Works): string {
    return `
      <article class="card found" data-found="${works}" style="--stage: var(--c-navy)">
        <span class="pips"></span>
        <span class="icon">${WORKS_ICONS[works]}</span>
        <span class="needs"></span>
        <b class="name">${WORKS[works].name}</b>
        <button class="btn buy" data-do="found" data-arg="${works}"><span class="tag"></span></button>
      </article>`
  }

  private updateFound(card: HTMLElement): void {
    const { game, port } = this
    const works = card.dataset.found as Works
    const def = WORKS[works]
    const price = game.foundPrice(port, works)
    const short = game.lacks(price, port)
    const full = port.levels.berth >= BERTH_X.length - 1
    const state = full ? 'max' : game.canFound(port, works) ? 'can' : 'short'
    card.dataset.state = state
    const have = port.works.filter((berth) => port.yards[berth] === works).length
    this.put(el('.pips', card), '<i class="on"></i>'.repeat(have) + '<i></i>'.repeat(BERTH_X.length - 1 - have))
    const need = (icon: string, count: number, lacking: number) =>
      count ? `<span class="need${lacking ? ' lacking' : ''}">${icon}${count > 1 ? count : ''}</span>` : ''
    this.put(el('.needs', card), full || game.god ? '' : need(SEAL, price.permits, short.permits) + need(HAT, price.crews, short.crews))
    this.price(el('.buy', card), state, price)
    const missing = [
      short.cash ? `${dollars(short.cash)} more` : '',
      short.permits ? plural(short.permits, 'more permit') : '',
      short.crews ? 'someone to work it' : '',
    ].filter(Boolean)
    card.dataset.tip = `<b>${def.name}</b><span>${def.blurb}</span>`
      + (full ? '<strong>The quay is full. Turn a yard over to it from that yard\'s own tray.</strong>'
        : `<em>Goes on berth ${port.levels.berth + 2}</em>${missing.length ? `<strong>Need ${missing.join(' and ')}</strong>` : ''}`)
  }

  // Ships: the ones asking to call now, then the lines that can be signed.
  private shipsHtml(): string {
    const asking = Array.from({ length: ASK_SLOTS }, () => `
      <article class="deal ask" hidden>
        <div class="plate"><div class="hullplate"><b></b><span></span></div><i class="cargo"></i></div>
        <div class="figs"><span class="fig boxes"></span><span class="fig sum"></span></div>
        <div class="act">
          <i class="fuse"><i></i></i>
          <button class="btn slim" data-do="decline" aria-label="Turn away">${CLOSE}</button>
          <button class="btn gold" data-do="accept">Let in</button>
        </div>
      </article>`).join('')
    const lines = this.port.def.contracts.map((c) => `
      <article class="deal" data-deal="${c.id}" style="--hull: ${c.hull}; --len: ${HULL_LENGTH[c.ship]}px">
        <div class="plate"><div class="hullplate"><b>${c.line}</b></div><i class="cargo">${CARGO_ICONS[c.cargo ?? 'goods']}</i></div>
        <div class="figs">
          <span class="fig"><i class="coin"></i>${dollars(c.fee)}</span><span class="fig bonus">${PENNANT}${dollars(c.bonus)}</span>
          <span class="fig next"></span>
        </div>
        <div class="act">
          <span class="sail">
            <button class="step" data-do="sail" data-arg="-1" aria-label="Fewer sailings">${MINUS}</button>
            <span class="boats">${SHIP.repeat(SAILINGS.length)}</span>
            <button class="step" data-do="sail" data-arg="1" aria-label="More sailings">${PLUS}</button>
          </span>
          <button class="btn" data-do="deal" data-arg="${c.id}"></button>
        </div>
      </article>`).join('')
    return `
      <div class="group ours" hidden><span class="spine">Fleet</span><div class="hulls"></div></div>
      <div class="group"><span class="spine">Asking</span>
        <div class="asks">${asking}<span class="nobody" data-tip="<b>Ships asking to call</b><span>Every few minutes a ship with no contract asks for a berth. Let her in and she joins the queue offshore; ignore her and she goes elsewhere.</span>">${SHIP}</span></div>
      </div>
      <div class="group lines"><span class="spine">Lines</span>${lines}</div>`
  }

  private updateShips(): void {
    const { port, terminal } = this
    this.updateFleet()
    const requests = terminal.requests
    all('.deal.ask').forEach((card, slot) => {
      const request = requests[slot]
      card.hidden = !request
      if (!request) return
      const { call, id } = request
      const cargo = CARGO[call.cargo]
      const boxes = call.unload + call.load
      card.dataset.ask = String(id)
      card.style.setProperty('--hull', call.hull)
      card.style.setProperty('--len', `${HULL_LENGTH[call.ship]}px`)
      this.put(el('.hullplate b', card), call.name)
      this.put(el('.hullplate span', card), CLASSES[call.ship].name)
      this.put(el('.cargo', card), CARGO_ICONS[call.cargo])
      this.put(el('.boxes', card), `${CARGO_ICONS.goods}${boxes}`)
      this.put(el('.sum', card), `<i class="coin"></i>${dollars(boxes * call.fee + call.bonus)}`)
      el('.fuse i', card).style.width = `${Math.max(0, (request.until - this.game.time) / ASK_STANDS) * 100}%`
      const full = terminal.waiting >= MAX_QUEUE
      const fits = terminal.fits(call)
      card.dataset.fit = fits ? 'fine' : 'tight'
      el('[data-do=accept]', card).setAttribute('aria-disabled', String(full))
      card.dataset.tip = `<b>${call.name}</b><span>A ${CLASSES[call.ship].name} ship with ${cargo.name.toLowerCase()} asks to call: `
        + `${call.unload} boxes off and ${call.load} on. ${dollars(call.fee)} a box, plus ${dollars(call.bonus)} if she is out within `
        + `${minutes(call.window)} of being let in.</span>`
        + (full ? '<strong>The queue offshore is full.</strong>' : fits ? '' : '<strong>At the pace ships are going, she would leave late.</strong>')
    })
    el('.nobody').hidden = requests.length > 0

    for (const c of port.def.contracts) {
      const card = el(`.deal[data-deal=${c.id}]`)
      const active = port.contracts.includes(c.id)
      const blocker = active ? null : port.blocker(c.id)
      card.dataset.state = active ? 'active' : blocker ? 'locked' : 'open'
      const next = this.terminal.nextIn(c.id)
      // For a line on offer, how full it would make the berths: over 100% and ships queue for good.
      const then = this.terminal.load + this.terminal.forecast(c)
      card.dataset.fit = then > 1 ? 'over' : then > 0.85 ? 'tight' : 'fine'
      this.put(el('.next', card), active && next !== null ? clock(next) : '')
      const sailings = port.sailings[c.id] ?? 1
      all('.boats svg', card).forEach((boat, i) => boat.classList.toggle('on', i <= sailings))
      el('.sail', card).hidden = !active
      const button = el('.act .btn', card)
      button.classList.toggle('gold', !active && !blocker)
      button.setAttribute('aria-disabled', String(blocker !== null))
      this.put(button, active ? 'Drop' : blocker ? LOCK : 'Sign')
    }
  }

  // The words for a line under the pointer: what it brings, what it pays, and how it stands.
  private lineSays(c: Contract): string {
    const { port, terminal } = this
    const cargo = CARGO[c.cargo ?? 'goods']
    const active = port.contracts.includes(c.id)
    const blocker = active ? null : port.blocker(c.id)
    const next = terminal.nextIn(c.id)
    const last = port.last[c.id]
    const home = port.home(c.id)
    const now = terminal.load
    const then = now + terminal.forecast(c)
    const stands = active
      ? `<em>${SAILINGS[port.sailings[c.id] ?? 1].name}${next === null ? '' : `, next in ${clock(next)}`}${home === null ? '' : `, berth ${home + 1}`}`
        + `${last ? `. Last ship: ${paceName(last.used)}${last.paid ? `, ${dollars(last.paid)}` : ''}` : ''}</em>`
      : blocker ? `<strong>${blocker}</strong>`
        : `<${then > 1 ? 'strong' : 'em'}>Berths ${Math.round(now * 100)}% → ${Math.round(then * 100)}% busy</${then > 1 ? 'strong' : 'em'}>`
    return `<b>${c.line}</b><span>${c.route}: ${cargo.name.toLowerCase()}. A ${CLASSES[c.ship].name} ship about every ${minutes(port.every(c))}, ${c.unload} boxes off and `
      + `${c.load} on. ${dollars(c.fee)} a box, plus ${dollars(c.bonus)} if she leaves within ${minutes(c.window)}.`
      + `${c.cargo ? ` ${cargo.note}` : ''}</span>${stands}`
  }

  // Crew: whoever is picked out on the left, and everyone at their posts on the right.
  private crewHtml(): string {
    const skills = TRADES.map((trade) => `<span class="skill" data-trade="${trade.id}">${TRADE_ICONS[trade.id]}<i></i><i></i><i></i></span>`).join('')
    const pays = PAY.map((_, level) =>
      `<button class="paid" data-do="pay" data-arg="${level}">${'<i class="coin"></i>'.repeat(level + 1)}</button>`).join('')
    return `
      <div class="who">
        <div class="row"><span class="face"></span><span class="called"><b></b><small></small></span><b class="wage"></b></div>
        <div class="row"><span class="skills">${skills}</span><span class="exp"><i></i></span></div>
        <div class="row">
          <span class="pays">${pays}</span>
          <button class="btn gold" data-do="hire">${PLUS}Hire</button>
          <button class="btn" data-do="promote">${UP}Promote</button>
          <button class="btn" data-do="swap">${SWAP}Move</button>
          <button class="btn danger slim" data-do="letgo">${CLOSE}</button>
        </div>
      </div>
      <div class="roster"></div>`
  }

  // Where a post is, in a few words.
  private postName(post: Post | null): string {
    if (!post) return 'in the hall'
    if (post.trade === 'crane') return `on a crane at berth ${post.at + 1}`
    if (post.trade === 'fitter') return `in a gang at the ${(WORKS[this.port.worksAt(post.at) ?? 'shipyard'].name).toLowerCase()}`
    if (post.trade === 'yard') return 'on a yard crane'
    return post.trade === 'tractor' ? 'on a tractor' : 'at the gate'
  }

  // The thing in the world a post belongs to.
  private postTarget(post: Post | null): Target {
    if (!post) return { kind: 'office' }
    if (post.trade === 'crane' || post.trade === 'fitter') return { kind: 'berth', berth: post.at }
    if (post.trade === 'yard') return { kind: 'block', block: post.at }
    return { kind: post.trade === 'tractor' ? 'tractors' : 'gate' }
  }

  private updateCrew(): void {
    const { game, port } = this
    const rate = (worker: Worker) => `${cents(wage(worker) * game.wages(port))} a minute`
    const tile = (worker: Worker, trade: Trade | null, asking = false) => {
      const best = trade ?? TRADES.map((t) => t.id).sort((a, b) => worker.skill[b] - worker.skill[a])[0]
      return `<button class="hand${asking ? ' asking' : ''}" data-do="hand" data-arg="${worker.id}">${hat(worker.grade)}`
        + `<span class="stars">${'<i class="on"></i>'.repeat(worker.skill[best])}${'<i></i>'.repeat(SKILL.most - worker.skill[best])}</span>`
        + `<i class="ready">${UP}</i></button>`
    }
    const empty = (post: Post) =>
      `<button class="hand empty" data-do="post" data-arg="${post.trade}:${post.at}">${TRADE_ICONS[post.trade]}</button>`
    const open = port.vacancies()
    const gang = (name: string, trade: Trade, places: number[]) => {
      const tiles = places.flatMap((at) => [
        ...port.crew(trade, at).map((worker) => tile(worker, trade)),
        ...open.filter((post) => post.trade === trade && post.at === at).map(empty),
      ])
      return `<div class="group"><span class="spine">${name}</span><div class="tiles">${tiles.join('')}</div></div>`
    }
    const hall = [...port.applicants.map((worker) => tile(worker, null, true)),
      ...port.workers.filter((worker) => !worker.post).map((worker) => tile(worker, null))]
    const berths = port.quays
    const html = `<div class="group"><span class="spine">Hall</span><div class="tiles">${hall.join('')}</div></div>`
      + berths.map((berth) => gang(`Berth ${berth + 1}`, 'crane', [berth])).join('')
      + port.works.map((berth) => gang(WORKS[port.yards[berth] as Works].short, 'fitter', [berth])).join('')
      + gang('Tractors', 'tractor', [0]) + gang('Yard', 'yard', [...port.blocks].sort((a, b) => a - b)) + gang('Gate', 'gate', [0])
    this.put(el('.roster'), html)
    el('.roster').classList.toggle('swapping', this.swapping)

    let chosen = this.chosen === null ? undefined : port.find(this.chosen)
    if (!chosen) this.chosen = null
    const hired = chosen !== undefined && port.workers.includes(chosen)
    if (!hired) this.swapping = false
    for (const button of all('.roster .hand[data-do=hand]')) {
      const worker = port.find(Number(button.dataset.arg))!
      const asking = port.applicants.includes(worker)
      button.classList.toggle('on', worker === chosen)
      button.classList.toggle('promotable', !asking && promotable(worker))
      const job = worker.post ? TRADES.find((t) => t.id === worker.post!.trade)!.job : ''
      button.dataset.tip = `<b>${worker.name}</b><span>${asking ? 'Looking for work' : `${GRADES[worker.grade].name} ${this.postName(worker.post)}`}`
        + `${job && worker.post ? `, working ${Math.round(pace(worker, worker.post.trade) * 100)}% as fast as an ordinary ${job}` : ''}. `
        + `${asking ? 'Asks' : 'Paid'} ${rate(worker)}.</span>${!asking && promotable(worker) ? '<em>Ready for promotion</em>' : ''}`
    }
    for (const button of all('.roster .hand.empty')) {
      const [trade, at] = button.dataset.arg!.split(':')
      button.dataset.tip = `<b>Nobody ${this.postName({ trade: trade as Trade, at: Number(at) })}</b><span>The machine stands idle. `
        + `${hired ? `Press to send ${chosen!.name} here.` : 'Hire someone, or pick a hand and send them here.'}</span>`
    }

    const who = el('.who')
    who.dataset.kind = !chosen ? 'none' : hired ? 'hand' : 'asking'
    this.put(el('.face', who), hat(chosen?.grade ?? 0))
    this.put(el('.called b', who), chosen?.name ?? 'Crew')
    this.put(el('.called small', who), chosen
      ? (hired ? `${GRADES[chosen.grade].name}, ${this.postName(chosen.post)}` : 'Looking for work')
      : `${port.workers.length} on the payroll, ${port.applicants.length} asking`)
    this.put(el('.wage', who), chosen ? cents(wage(chosen) * game.wages(port)) : dollars(game.payroll(port)))
    el('.wage', who).dataset.tip = chosen ? `<b>Wage</b><span>${rate(chosen)}.</span>` : '<b>Payroll</b><span>What everyone here is paid each minute.</span>'
    for (const skill of all('.skill', who)) {
      const trade = TRADES.find((t) => t.id === skill.dataset.trade)!
      const stars = chosen?.skill[trade.id] ?? 0
      all('i', skill).forEach((star, i) => star.classList.toggle('on', i < stars))
      skill.classList.toggle('mine', chosen?.post?.trade === trade.id)
      skill.dataset.tip = `<b>${trade.name}</b><span>${chosen ? `${chosen.name} works them ${Math.round(pace(chosen, trade.id) * 100)}% as fast as an ordinary ${trade.job}.` : `How good someone is as a ${trade.job}: one star to three.`}</span>`
    }
    const grade = GRADES[chosen?.grade ?? 0]
    const next = GRADES[(chosen?.grade ?? 0) + 1]
    const exp = el('.exp', who)
    exp.hidden = !hired || !next
    const share = chosen && next ? Math.min(1, chosen.exp / grade.exp) : 0
    el('i', exp).style.width = `${share * 100}%`
    exp.dataset.tip = next ? `<b>Experience</b><span>${Math.round(share * 100)}% of the time at work it takes to make ${next.name.toLowerCase()}. Only time on a working machine counts.</span>` : ''
    PAY.forEach((pay, level) => {
      const button = el(`.paid[data-arg="${level}"]`, who)
      button.setAttribute('aria-pressed', String(hired && chosen!.pay === level))
      const sum = chosen ? cents((wage(chosen) / PAY[chosen.pay].pay) * pay.pay * game.wages(port)) : ''
      button.dataset.tip = `<b>${pay.name} pay</b><span>${sum ? `${sum} a minute. ` : ''}${pay.pace === 1 ? 'The going rate.'
        : `Works ${Math.round(Math.abs(pay.pace - 1) * 100)}% ${pay.pace < 1 ? 'slower' : 'faster'} and earns promotion ${pay.learns < 1 ? 'half as fast' : 'half as fast again'}.`}</span>`
    })
    const ready = hired && promotable(chosen!)
    const promote = el('[data-do=promote]', who)
    promote.hidden = !hired || !next
    promote.classList.toggle('gold', ready)
    promote.setAttribute('aria-disabled', String(!ready))
    promote.dataset.tip = !chosen || !next ? '' : `<b>Promote to ${next.name.toLowerCase()}</b><span>Works ${Math.round((next.pace / grade.pace - 1) * 100)}% faster at everything, for `
      + `${cents((wage(chosen) / grade.pay) * next.pay * game.wages(port))} a minute instead of ${cents(wage(chosen) * game.wages(port))}.</span>`
      + (ready ? '' : `<strong>Needs more time at work: ${Math.round(share * 100)}% there</strong>`)
    const swap = el('[data-do=swap]', who)
    swap.setAttribute('aria-pressed', String(this.swapping))
    swap.dataset.tip = '<b>Move</b><span>Then press the hand to change places with, or an empty post. Each works a machine at the pace of their skill in it.</span>'
    el('[data-do=hire]', who).dataset.tip = chosen ? `<b>Hire ${chosen.name}</b><span>Goes to the empty post that suits best, or waits in the hall on full pay until there is a machine.</span>` : ''
    const letgo = el('[data-do=letgo]', who)
    this.put(letgo, hired && performance.now() < this.letgoArmed ? 'Sure?' : CLOSE)
    letgo.dataset.tip = hired ? `<b>Let ${chosen!.name} go</b><span>Off the payroll for good. The machine stands idle until someone else takes it.</span>`
      : '<b>Turn away</b><span>Makes room in the hall for the next person who comes asking.</span>'
    if (!this.picked) this.terminal.mark(chosen && hired ? this.postTarget(chosen.post) : null)
  }

  // A press on someone in the roster, or on an empty post.
  private crewClick(action: string, arg: string, button: HTMLElement): void {
    const { game, port } = this
    const chosen = this.chosen === null ? undefined : port.find(this.chosen)
    const hired = chosen !== undefined && port.workers.includes(chosen)
    switch (action) {
      case 'hand': {
        const id = Number(arg)
        const other = port.workers.find((worker) => worker.id === id)
        if (this.swapping && hired && other && other !== chosen) {
          port.swap(chosen!.id, id)
          this.swapping = false
          if (game.sound) purchase()
        } else {
          this.chosen = this.chosen === id ? null : id
          this.swapping = false
        }
        break
      }
      case 'post': {
        const [trade, at] = arg.split(':')
        if (hired) port.move(chosen!.id, { trade: trade as Trade, at: Number(at) })
        else this.kick(button, 'nope')
        this.swapping = false
        break
      }
      case 'hire':
        if (chosen && !hired) {
          port.hire(chosen.id)
          this.kick(el('.who'), 'bought')
          if (game.sound) signed()
        }
        break
      case 'promote':
        if (hired && promotable(chosen!)) {
          port.promote(chosen!.id)
          this.kick(el('.who'), 'bought')
          if (game.sound) signed()
        } else this.kick(button, 'nope')
        break
      case 'pay':
        if (hired) port.setPay(chosen!.id, Number(arg))
        break
      case 'swap':
        this.swapping = hired && !this.swapping
        break
      case 'letgo':
        if (!chosen) break
        // Letting a hand go takes a second press, as starting over does.
        if (hired && performance.now() > this.letgoArmed) {
          this.letgoArmed = performance.now() + 3000
          break
        }
        this.letgoArmed = 0
        port.dismiss(chosen.id)
        this.chosen = null
        break
    }
    game.save()
  }

  private portHtml(): string {
    const toggle = (action: string, name: string, note: string) => `
      <button class="switch" data-do="${action}" role="switch" data-tip="<b>${name}</b><span>${note}.</span>"><i></i><b>${name}</b></button>`
    return `
      <div class="group"><span class="spine">Delays</span>
        <div class="delays">${DELAYS.map(([cause, label, long]) =>
          `<div class="delay" data-cause="${cause}" data-tip="<b>${label}</b><span>${long}.</span>"><span>${label}</span><i class="bar"><i></i></i></div>`).join('')}</div>
      </div>
      <div class="group wide"><span class="spine">Record</span>
        <div class="tiles">${RECORD.map(([key, label]) =>
          `<div class="stat" data-stat="${key}"><b></b><span>${label}</span></div>`).join('')}</div>
      </div>
      <div class="group"><span class="spine">Harbours</span>${this.game.ports.map((port, i) => `
        <article class="card harbour" data-harbour="${i}" style="--stage: var(--c-navy)">
          <span class="pips"></span>
          <span class="icon">${PORT_ICONS[port.def.look]}</span>
          <span class="needs"></span>
          <b class="name">${port.def.name}</b>
          <button class="btn buy" data-do="expand" data-arg="${i}"><span class="tag"></span></button>
        </article>`).join('')}
      </div>
      <div class="group"><span class="spine">Settings</span>
        <div class="settings">
          ${toggle('quiet', 'Quiet mode', 'Hold events until switched off')}
          ${toggle('god', 'God mode', 'Build with no cash, permits or crews')}
          ${toggle('sound', 'Sound', 'Chimes for events, bonuses and purchases')}
          <span class="pair">
            <button class="btn danger" data-do="reset"></button>
            <button class="btn" data-do="quit">Quit</button>
          </span>
        </div>
      </div>`
  }

  private click(e: MouseEvent): void {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-do]')
    if (!target) return
    const arg = target.dataset.arg ?? ''
    const { game } = this
    switch (target.dataset.do) {
      case 'tab':
        this.pick(null, 0)
        this.open(this.tab === arg ? null : (arg as Tab))
        break
      case 'close': this.open(null); break
      case 'unpick': this.pick(null, 0); break
      case 'buy': this.buy(target); break
      case 'found': {
        const works = arg as Works
        const price = game.foundPrice(this.port, works)
        if (!game.found(this.port, works)) {
          this.kick(target, 'nope')
          break
        }
        this.paid(target, price, target.closest<HTMLElement>('.card')!)
        if (this.picked?.kind === 'site') this.pick({ kind: 'berth', berth: this.port.levels.berth }, this.pickedAt())
        break
      }
      case 'convert': {
        const berth = Number(target.closest<HTMLElement>('.rules')!.dataset.berth)
        const price = game.convertPrice(this.port, berth, arg as Industry)
        if (!game.convert(this.port, berth, arg as Industry)) {
          this.kick(target, 'nope')
          break
        }
        this.paid(target, price, target.closest<HTMLElement>('.rules')!)
        this.pick({ kind: 'berth', berth }, this.pickedAt())
        break
      }
      case 'product':
        game.setProduct(this.port, Number(target.closest<HTMLElement>('.rules')!.dataset.berth), Number(arg))
        break
      case 'design': {
        const [key, value] = arg.split('=')
        this.design = { ...this.design, [key]: key === 'engine' ? Number(value) : value }
        break
      }
      case 'order': {
        const panel = target.closest<HTMLElement>('.rules')!
        const input = el<HTMLInputElement>('.naming', panel)
        const design = { ...this.design, name: input.value }
        const price = game.shipPrice(design)
        if (!game.order(this.port, Number(panel.dataset.berth), design)) {
          this.kick(target, 'nope')
          break
        }
        this.paid(target, price, panel)
        input.value = ''
        break
      }
      case 'trade': {
        const vessel = game.fleet.find((v) => v.id === Number(target.closest<HTMLElement>('.deal')!.dataset.vessel))!
        const owned = game.owned.map((p) => p.def.id)
        const from = arg === 'home'
        const fits = (from ? owned : [null, ...owned]).filter((id) =>
          game.tradeBlocker(vessel, from ? id! : vessel.home, from ? vessel.away : id) === null)
        const next = fits[(fits.indexOf(from ? vessel.home : vessel.away) + 1) % Math.max(1, fits.length)]
        if (fits.length < 2 || !game.setTrade(vessel.id, from ? next! : vessel.home, from ? vessel.away : next)) this.kick(target, 'nope')
        break
      }
      case 'scrap': {
        const id = Number(target.closest<HTMLElement>('.deal')!.dataset.vessel)
        if (this.selling.id !== id || performance.now() > this.selling.until) {
          this.selling = { id, until: performance.now() + 3000 }
          break
        }
        this.selling = { id: 0, until: 0 }
        if (game.sell(id) === null) this.kick(target, 'nope')
        break
      }
      case 'info': {
        const offer = this.offerOf(target.closest<HTMLElement>('.card')!)
        this.pinned = same(this.pinned, offer) ? null : offer
        this.setFocus(this.pinned, null)
        break
      }
      case 'hand': case 'post': case 'hire': case 'promote': case 'pay': case 'swap': case 'letgo':
        this.crewClick(target.dataset.do!, arg, target)
        break
      case 'sail': {
        const line = target.closest<HTMLElement>('.deal')!.dataset.deal!
        const level = (this.port.sailings[line] ?? 1) + Number(arg)
        if (SAILINGS[level]) game.setSailings(this.port, line, level)
        else this.kick(target, 'nope')
        break
      }
      case 'accept': case 'decline': {
        const card = target.closest<HTMLElement>('.deal')!
        const id = Number(card.dataset.ask)
        if (target.dataset.do === 'decline') this.terminal.decline(id)
        else if (this.terminal.accept(id)) {
          if (game.sound) signed()
        } else this.kick(target, 'nope')
        break
      }
      case 'home': {
        const berth = Number(target.closest<HTMLElement>('.rules')!.dataset.berth)
        game.setHome(this.port, arg, this.port.home(arg) === berth ? null : berth)
        break
      }
      case 'first': {
        const berth = Number(target.closest<HTMLElement>('.rules')!.dataset.berth)
        game.setFirst(this.port, this.port.first === berth ? null : berth)
        break
      }
      case 'move': {
        const berth = Number(target.closest<HTMLElement>('.rules')!.dataset.berth)
        if (game.moveCrane(this.port, berth, Number(arg))) this.paid(target, game.movePrice, target.closest<HTMLElement>('.rules')!)
        else this.kick(target, 'nope')
        break
      }
      case 'deal': this.deal(arg, target); break
      case 'port':
        // The ports still on sale are in the Port tab.
        if (game.ports[Number(arg)]?.owned) this.hooks.travel(Number(arg))
        else {
          this.pick(null, 0)
          this.open('port')
        }
        break
      case 'expand': this.expand(target, Number(arg)); break
      case 'zoom': this.hooks.zoom(); break
      case 'choice': this.events.choose(Number(arg)); break
      case 'quiet': game.quiet = !game.quiet; game.save(); break
      case 'god': game.god = !game.god; game.save(); break
      case 'sound':
        game.sound = !game.sound
        game.save()
        if (game.sound) purchase()
        break
      case 'reset':
        if (performance.now() < this.resetArmed) {
          game.persist = false
          Game.reset()
          location.reload()
        }
        this.resetArmed = performance.now() + 4000
        break
      case 'quit': window.close(); break
    }
    this.refresh()
  }

  private paid(button: HTMLElement, price: Price, card: HTMLElement): void {
    // In god mode nothing was spent, so nothing is shown leaving the counters.
    if (!this.game.god) {
      this.fx.spend(button.getBoundingClientRect(), price.cash)
      this.kick(el('#cash'), 'spent')
      if (price.permits) this.kick(el('#permits'), 'spent')
      if (price.crews) this.kick(el('#crews'), 'spent')
    }
    this.kick(card, 'bought')
    if (this.game.sound) purchase()
  }

  private buy(button: HTMLElement): void {
    const { game, port } = this
    const card = button.closest<HTMLElement>('.card')!
    const offer = this.offerOf(card)
    if (!game.canBuy(port, offer.id, offer.at)) {
      if (port.level(offer) < port.max(offer)) this.kick(button, 'nope')
      return
    }
    const price = game.price(port, offer.id)
    game.buy(port, offer.id, offer.at)
    this.paid(button, price, card)
    // What was a site or a plot is now a berth or a block, with different things on offer.
    if (this.picked?.kind === 'site') this.pick({ kind: 'berth', berth: this.picked.berth }, this.pickedAt())
    else if (this.picked?.kind === 'plot') this.pick({ kind: 'block', block: this.picked.block }, this.pickedAt())
  }

  private pickedAt(): number {
    const box = el('#context').getBoundingClientRect()
    return box.left + box.width / 2
  }

  // A harbour's card: buys it if it is on sale, and goes there if it is the player's already.
  private expand(button: HTMLElement, index: number): void {
    const sale = this.game.ports[index]
    if (sale.owned) return this.hooks.travel(index)
    const price = this.game.portPrice(sale)
    if (!this.game.expand(sale)) return this.kick(button, 'nope')
    this.paid(button, price, button.closest<HTMLElement>('.card')!)
    this.hooks.opened(sale)
  }

  // A ship left on time and the council stamped the record.
  stamped(): void {
    this.kick(el('#permits'), 'bump')
  }

  // Enough stamps for a permit.
  granted(): void {
    this.events.announce('The council has granted a permit.')
    if (this.game.sound) signed()
  }

  private deal(id: string, button: HTMLElement): void {
    const { game, port } = this
    if (port.contracts.includes(id)) {
      game.cancel(port, id)
    } else if (port.canSign(id)) {
      game.sign(port, id)
      this.kick(button.closest<HTMLElement>('.deal')!, 'bought')
      if (game.sound) signed()
    } else {
      this.kick(button, 'nope')
    }
  }

  private open(tab: Tab | null): void {
    this.tab = tab
    el('#dock').classList.toggle('open', tab !== null)
    document.body.classList.toggle('managing', tab !== null)
    for (const button of all('.tab')) button.classList.toggle('on', button.dataset.arg === tab)
    if (tab) for (const section of all('#tray section')) section.classList.toggle('on', section.dataset.tab === tab)
    this.pinned = null
    this.tip = null
    this.swapping = false
    if (tab !== 'crew' && !this.picked) this.terminal.mark(this.pointed)
    this.setFocus(null, null)
  }

  // The card under the pointer. An upgrade card also shows its blueprint in the world.
  private setFocus(offer: Offer | null, deal: string | null): void {
    if (same(offer, this.focus) && deal === this.dealFocus) return
    this.focus = offer
    this.dealFocus = deal
    for (const card of all('.card')) card.classList.toggle('focus', offer !== null && same(this.offerOf(card), offer))
    this.terminal.preview(offer)
    this.says()
  }

  // Runs every drawn frame: the cash counter rolls towards the balance.
  frame(dt: number): void {
    const target = this.game.money - this.fx.inFlight
    const gap = target - this.shown
    this.shown = Math.abs(gap) < 0.6 ? target : this.shown + gap * (1 - Math.exp(-dt * (gap < 0 ? 12 : 8)))
    this.put(el('#money'), this.game.god ? '∞' : dollars(this.shown))

    const { from, to } = this.hooks.view()
    const window = el('.map i')
    window.style.left = `${from * 100}%`
    window.style.width = `${(to - from) * 100}%`
    const whole = this.game.wide || this.managing
    const zoom = el('.zoom')
    this.put(zoom, whole ? ZOOM_IN : ZOOM_OUT)
    zoom.title = whole ? 'Close view' : 'Show the whole port'
  }

  refresh(): void {
    this.hud()
    if (this.tab === 'build') this.updateBuild()
    if (this.tab === 'crew') this.updateCrew()
    if (this.tab === 'ships') this.updateShips()
    if (this.tab === 'port') this.updatePort()
    if (this.picked) for (const card of all('#context .card[data-up]')) this.updateCard(card)
    if (this.picked) for (const card of all('#context .card.found')) this.updateFound(card)
    this.updateRules()
    this.says()
    this.eventCard()
    this.toast()
  }

  // How this harbour's own rule stands right now: the tide, a typhoon on its way, the rush on the road.
  private local(): void {
    const { port, terminal } = this
    const rules = port.def.rules
    const chip = el('#local')
    const live = rules?.tide ?? rules?.typhoon ?? rules?.rush
    chip.hidden = !live
    if (!rules || !live) return
    chip.title = `${rules.name}. ${rules.text}`
    const meter = el('.meter', chip)
    meter.hidden = !rules.tide
    let warn = false
    if (rules.tide) {
      const turn = terminal.tideTurn!
      const bound = terminal.tideBound.map((size) => CLASSES[size].name)
      warn = !turn.open && bound.length > 0
      el('i', meter).style.width = `${Math.round(((terminal.tide + 1) / 2) * 100)}%`
      this.put(el('.cap', chip), 'Tide')
      this.put(el('b', chip), `${turn.open ? 'High' : 'Low'} ${clock(turn.turns)}`)
      chip.title += bound.length ? ` Waiting for it now: ${bound.join(', ')} ships.` : ' No ship here is deep enough to wait for it.'
    } else if (rules.typhoon) {
      const signal = terminal.signal
      warn = signal !== null || terminal.typhoon
      this.put(el('.cap', chip), 'Typhoon')
      this.put(el('b', chip), terminal.typhoon ? 'Overhead' : signal !== null ? clock(signal) : 'None')
    } else {
      warn = terminal.rush
      this.put(el('.cap', chip), 'Road')
      this.put(el('b', chip), terminal.rush ? 'Rush hour' : 'Clear')
    }
    chip.classList.toggle('warn', warn)
  }

  private hud(): void {
    const { game, port, terminal } = this
    el('.port.more').hidden = game.onSale.length === 0
    all('.port:not(.more)').forEach((button, i) => {
      const other = game.ports[i]
      button.classList.toggle('on', other === port)
      button.hidden = !other.owned
      // A port out of sight flags trouble: a queue offshore, or a decision waiting there.
      const waiting = this.hooks.terminal(other)?.waiting ?? 0
      button.classList.toggle('alarm', other !== port && (waiting >= 3 || this.events.current?.port === other))
    })

    this.local()

    const waiting = terminal.waiting
    all('#queue .fleet i').forEach((ship, i) => ship.classList.toggle('on', i < waiting))
    el('#queue').classList.toggle('warn', waiting >= 3)

    const fill = Math.round(terminal.yardFill * 100)
    el('#yard .meter i').style.width = `${fill}%`
    this.put(el('#yard b'), `${fill}%`)
    el('#yard').classList.toggle('warn', fill >= 85)

    const reliability = Math.round(port.reliability)
    const level = reliability < 60 ? 'signalRed' : reliability < 80 ? 'amber' : 'green'
    el('#reliability .ring').style.cssText = `--v: ${reliability}%; --tone: var(--c-${level})`
    this.put(el('#reliability b'), `${reliability}%`)

    if (port.streak !== this.run) this.kick(el('#run'), port.streak > this.run ? 'bump' : 'spent')
    this.run = port.streak
    this.put(el('#run b'), String(port.streak))
    this.put(el('#run small'), port.run ? `+${Math.round(port.run * 100)}%` : '')

    // What the ports have cleared a minute, over the last couple of minutes of play.
    const sum = game.ports.reduce((total, p) => total + p.stats.earned - p.stats.wages, 0)
    this.takings.push({ at: game.time, sum })
    while (this.takings.length > 2 && game.time - this.takings[1].at >= RATE_SPAN) this.takings.shift()
    const since = this.takings[0]
    const span = game.time - since.at
    const rate = span >= 20 ? ((sum - since.sum) / span) * 60 : null
    this.put(el('#rate'), rate === null ? '' : `${rate < -0.5 ? '' : '+'}${dollars(rate)} a min`)
    el('#rate').classList.toggle('down', rate !== null && rate < -0.5)

    this.put(el('#permits b'), game.god ? '∞' : String(game.permits))
    all('#permits .stamps i').forEach((stamp, i) => stamp.classList.toggle('on', i < game.stamps))
    this.put(el('#crews b'), game.god ? '∞' : String(port.crews))
    const full = port.crews >= CREW_POOL
    el('#crews .ring').style.cssText = `--v: ${full ? 100 : port.training * 100}%; --tone: var(--c-${full ? 'green' : 'amber'})`

    el('.tab[data-arg=build]').classList.toggle('ping', UPGRADES.some((u) => game.canBuy(port, u.id)))
    el('.tab[data-arg=ships]').classList.toggle('ping',
      port.def.contracts.some((c) => port.canSign(c.id)) || terminal.requests.length > 0)
    el('.tab[data-arg=crew]').classList.toggle('ping',
      port.applicants.length > 0 && port.vacancies().length > 0)
    el('.tab[data-arg=port]').classList.toggle('ping', game.onSale.some((sale) => this.affordable(game.portPrice(sale))))
  }

  private affordable(price: Price): boolean {
    const short = this.game.lacks(price, this.port)
    return !short.cash && !short.permits && !short.crews
  }

  private updateBuild(): void {
    const hot = this.terminal.diagnosis().stage
    for (const group of all('section[data-tab=build] .group')) group.classList.toggle('hot', group.dataset.stage === hot)
    for (const card of all('section[data-tab=build] .card[data-up]')) this.updateCard(card)
    for (const card of all('section[data-tab=build] .card.found')) this.updateFound(card)
  }

  // Where an offer stands: built out, waiting on something else, affordable, or still being saved for.
  private state(offer: Offer): 'max' | 'locked' | 'can' | 'short' {
    const { game, port } = this
    if (port.needs(offer) !== null) return 'locked'
    if (port.level(offer) >= port.max(offer)) return 'max'
    return this.affordable(game.price(port, offer.id)) ? 'can' : 'short'
  }

  private updateCard(card: HTMLElement): void {
    const { game, port } = this
    const offer = this.offerOf(card)
    const level = port.level(offer)
    const max = port.max(offer)
    const price = game.price(port, offer.id)
    const short = game.lacks(price, port)
    const state = this.state(offer)
    card.dataset.state = state
    card.classList.toggle('pinned', same(offer, this.pinned))
    // Pips count short ladders up the card's edge; a long one is a single gauge.
    this.put(el('.pips', card), max > MAX_PIPS
      ? `<i class="gauge" style="--v: ${(level / max) * 100}%"></i>`
      : '<i class="on"></i>'.repeat(Math.min(level, max)) + '<i></i>'.repeat(Math.max(0, max - level)))
    // What it takes besides cash sits on the picture: a seal for each permit and a hard hat for someone to work it.
    const need = (icon: string, count: number, lacking: number) =>
      count ? `<span class="need${lacking ? ' lacking' : ''}">${icon}${count > 1 ? count : ''}</span>` : ''
    this.put(el('.needs', card), state === 'max' || game.god ? ''
      : need(SEAL, price.permits, short.permits) + need(HAT, price.crews, short.crews))
    this.price(el('.buy', card), state, price)
  }

  // A price button: gold when it can be paid, a filling gauge while saving up, and beside the cash
  // a seal for each permit and a hard hat for a crew.
  private price(button: HTMLElement, state: 'can' | 'short' | 'max' | 'locked', price: Price, also = ''): void {
    button.classList.toggle('gold', state === 'can')
    button.setAttribute('aria-disabled', String(state !== 'can'))
    button.style.setProperty('--have', state === 'short' ? `${Math.min(1, this.game.money / price.cash) * 100}%` : '0%')
    this.put(el('.tag', button), state === 'max' ? CHECK : state === 'locked' ? LOCK
      : this.game.god ? 'Free' : `<i class="coin"></i>${dollars(price.cash)}${also}`)
  }

  private updatePort(): void {
    const { game, port, terminal } = this
    const delays = terminal.delays()
    const worst = terminal.diagnosis().cause
    for (const [cause] of DELAYS) {
      const row = el(`.delay[data-cause=${cause}]`)
      row.classList.toggle('worst', cause === worst)
      el('.bar i', row).style.width = `${Math.round(delays[cause] * 100)}%`
    }
    const s = port.stats
    const calls = s.onTime + s.late
    const values: Record<(typeof RECORD)[number][0], string> = {
      boxes: s.boxes.toLocaleString(),
      ships: s.ships.toLocaleString(),
      onTime: calls ? `${Math.round((s.onTime / calls) * 100)}%` : '–',
      diverted: s.diverted.toLocaleString(),
      best: dollars(s.best),
      earned: dollars(s.earned),
      wages: dollars(game.payroll(port)),
      rate: dollars(game.rate * 60),
    }
    for (const [key] of RECORD) this.put(el(`.stat[data-stat=${key}] b`), values[key])

    for (const card of all('.card.harbour')) {
      const sale = game.ports[Number(card.dataset.harbour)]
      const { def } = sale
      const price = game.portPrice(sale)
      const short = game.lacks(price, port)
      const state = sale.owned ? 'max' : this.affordable(price) ? 'can' : 'short'
      card.dataset.state = state
      card.classList.toggle('here', sale === port)
      this.put(el('.needs', card), sale.owned || game.god || !price.permits ? ''
        : `<span class="need${short.permits ? ' lacking' : ''}">${SEAL}${price.permits}</span>`)
      this.price(el('.buy', card), state, price)
      const missing = [short.cash ? `${dollars(short.cash)} more` : '', short.permits ? plural(short.permits, 'more permit') : ''].filter(Boolean)
      card.dataset.tip = `<b>${def.name}${def.where ? `, ${def.where}` : ''}</b><span>${def.blurb}${def.rules ? ` ${def.rules.name}: ${def.rules.text}` : ''}</span>`
        + (sale.owned ? `<em>${sale === port ? 'You are here' : 'Yours. Press to go there'}</em>` : missing.length ? `<strong>Need ${missing.join(' and ')}</strong>` : '')
    }

    el('.switch[data-do=quiet]').setAttribute('aria-checked', String(game.quiet))
    el('.switch[data-do=god]').setAttribute('aria-checked', String(game.god))
    el('.switch[data-do=sound]').setAttribute('aria-checked', String(game.sound))
    this.put(el('.btn[data-do=reset]'), performance.now() < this.resetArmed ? 'Erase everything?' : 'Start over')
  }

  // What an offer does, what the next step changes, and whatever still stands in its way.
  private describe(offer: Offer): string {
    const { game, port } = this
    const u = upgrade(offer.id)
    const name = `<b>${cardName(offer)}</b>`
    const needs = port.needs(offer)
    if (needs) return `${name}<span>${u.desc}</span><strong>${needs.replace(': ', ', because ')}.</strong>`
    const level = port.level(offer)
    if (level >= port.max(offer)) return `${name}<span>${port.max(offer) === 1 ? 'Already built.' : 'Fully built.'}</span>`
    const price = game.price(port, offer.id)
    const short = game.lacks(price, port)
    const wage = price.crews ? ` Whoever works it is paid about ${dollars(WAGE * game.wages(port))} a minute.` : ''
    const missing = [
      short.cash ? `${dollars(short.cash)} more` : '',
      short.permits ? plural(short.permits, 'more permit') : '',
      short.crews ? `someone to work it: the next comes asking in ${clock((1 - port.training) * TRAIN_TIME)}` : '',
    ].filter(Boolean)
    return `${name}<span>${u.desc}${wage}</span><em>${u.delta(port.levels[offer.id])}</em>`
      + (missing.length ? `<strong>Need ${missing.join(' and ')}</strong>` : '')
  }

  // The line of words above a tray: the card under the pointer, otherwise how things stand.
  private says(): void {
    const { port } = this
    if (this.picked) {
      const [name, state] = naming(this.picked, port)
      const inContext = this.focus && all('#context .card').some((card) => same(this.offerOf(card), this.focus))
      const rule = this.picked.kind === 'berth' ? this.ruleSays(this.picked.berth) : null
      this.put(el('#context .say'), rule ?? this.tip ?? (inContext ? this.describe(this.focus!) : `<b>${name}</b><span>${state}</span>`))
    }
    if (!this.tab) return
    const contract = this.tab === 'ships' && this.dealFocus
      ? port.def.contracts.find((c) => c.id === this.dealFocus) : null
    let html: string
    if (this.tip) {
      html = this.tip
    } else if (this.tab === 'build' && this.focus) {
      html = this.describe(this.focus)
    } else if (contract) {
      html = this.lineSays(contract)
    } else {
      // The lamp says how things are (fine, room to improve, trouble); the tag says which link it is about.
      const advice = this.terminal.diagnosis()
      const stage = STAGES.find((s) => s.id === advice.stage)
      const mood = advice.cause || this.terminal.held ? 'trouble' : stage ? 'hint' : 'fine'
      const where = stage
        ? `<span class="where" style="--stage: var(--c-${stage.color}); --stage-ink: var(--c-${stage.ink})">${stage.id}</span>` : ''
      html = `<i class="lamp ${mood}"></i>${where}<span>${advice.text}</span>`
    }
    this.put(el('#ribbon'), html)
  }

  private eventCard(): void {
    const card = el('#event')
    const event = this.events.current
    card.hidden = !event
    if (!event) {
      this.eventKey = ''
      return
    }
    if (this.eventKey !== event.title) {
      this.eventKey = event.title
      // With more than one port, say which one it is about.
      const where = this.game.owned.length > 1 ? `<small>${event.port.def.name}</small>` : ''
      if (this.alerts) {
        if (this.game.sound) chime()
        notify(event.title, event.body)
      }
      card.innerHTML = `${where}<h2>${event.title}</h2><p>${event.body}</p>
        <div class="choices">${event.choices.map((c, i) => `
          <button class="btn choice" data-do="choice" data-arg="${i}">
            <b>${c.label}${i === event.fallback ? '<em>If ignored</em>' : ''}</b><span>${c.hint}</span>
          </button>`).join('')}</div>
        <div class="fuse"><i></i></div>`
    }
    const left = Math.max(0, (this.events.expires - this.game.time) / event.deadline)
    el('.fuse i', card).style.width = `${left * 100}%`
  }

  private toast(): void {
    const text = this.events.lastOutcome
    if (text !== this.outcome) {
      this.outcome = text
      this.toastUntil = performance.now() + 9000
      el('#toast').textContent = text
    }
    el('#toast').hidden = !text || performance.now() > this.toastUntil
  }
}
