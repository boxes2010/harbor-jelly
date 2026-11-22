import { C } from '../style'
import { GRADES, PAY, WAGE, applicant, hand, promotable, samePost, wage, type Post, type Trade, type Worker } from './crew'
import { BERTH_X, CLASSES, type ClassId } from './layout'
import { UNLOCK_ORDER, YARD } from './yard'

const SAVE_KEY = 'harbor-jelly-save-v2'
const OLD_SAVE_KEY = 'harbor-jelly-save-v1'
const AWAY_CAP = 8 * 3600
const AWAY_SHARE = 0.5
const SAVE_EVERY = 10

// The council stamps the port's record for every ship that leaves on time. This many stamps make a permit.
export const STAMPS_PER_PERMIT = 10
const STAMPS_LOST = 2
// Someone new comes looking for work every few minutes, until this many are waiting in the hall.
export const CREW_POOL = 3
export const TRAIN_TIME = 240
export { WAGE }

// What a purchase takes: cash, council permits for anything that changes the port's footprint,
// and someone to work it for anything that needs a hand: an applicant, or a hand with no machine.
export interface Price {
  cash: number
  permits: number
  crews: number
}

export type UpgradeId =
  | 'berth' | 'dredge' | 'tug' | 'gang' | 'crane' | 'craneSpeed' | 'carrier' | 'carrierSpeed'
  | 'yardBlock' | 'stackHeight' | 'yardCrane' | 'gate'

// The four links of the port's chain, in the order a box passes through them.
export type ChainStage = 'Berth' | 'Cranes' | 'Yard' | 'Gate'

export interface Upgrade {
  id: UpgradeId
  stage: ChainStage
  name: string
  // One short line for the card, then the full sentence, then what the next level changes.
  effect: (level: number) => string
  desc: string
  delta: (level: number) => string
  max: number
  cost: (level: number) => number
  permits?: (level: number) => number
  crew?: boolean
}

const SIZES = ['Feeder', 'Panamax', 'Neo-Panamax']
export const CRANES_PER_BERTH = 3
export const GANGS_PER_YARD = 4
// A crane keeps about this many tractors busy; more would only stand idle on the payroll.
const TRACTORS_PER_CRANE = 3
const START_BLOCKS = 2
// What it costs to run a quay crane along the rails to the next berth.
export const CRANE_MOVE = 500

// Something on offer: an upgrade, and for a crane or a yard block the place the player picked for it.
export interface Offer {
  id: UpgradeId
  at?: number
}
// The trade of whoever works each kind of machine. A berth is built with a crane.
const TRADE_OF: Partial<Record<UpgradeId, Trade>> = {
  berth: 'crane', crane: 'crane', carrier: 'tractor', yardBlock: 'yard', gate: 'gate', gang: 'fitter',
}

// What a stretch of quay is given over to. A yard does one thing at a time: it is a container berth, or one
// of the works below. The first berth is always a container berth.
export type Works = 'shipyard' | 'repair' | 'navy' | 'ferry'
export type Industry = 'boxes' | Works
export type VesselId = 'tugboat' | 'trawler' | 'patrol' | 'ferry' | 'frigate' | 'coaster'

// One kind of work a yard takes: the vessel, the seconds of one gang's work in it, and what it pays.
export interface Job {
  vessel: VesselId
  name: string
  work: number
  fee: number
  bonus: number
  hull: string
}

export interface WorksDef {
  name: string
  short: string
  blurb: string
  // What founding one costs, against a container berth on the same site, and any permits on top.
  price: number
  permits: number
  // Seconds between ships for the yard, least and most. A shipyard makes its own work and has none.
  every: [number, number] | null
  // Booked ships come whether the yard is free or not and wait offshore. Others only come to a free yard.
  booked: boolean
  // Dollars a minute paid for keeping the yard ready, while the port's reliability holds up.
  retainer: number
  // A ship's deadline: the time the work takes, as much again as `slack`, and seconds to come and go. A booked
  // ship's is reckoned for one gang, so more gangs earn the bonus for an early turn; any other is quoted from
  // the gangs the yard has when she is taken on.
  slack: number
  transit: number
  jobs: Job[]
  names: string[]
}

export const RETAINER_FLOOR = 60
// Share of a newbuilding's price paid at each quarter of the work. The rest is paid on delivery.
export const STAGE_PAY = 0.15

export const WORKS: Record<Works, WorksDef> = {
  shipyard: {
    name: 'Shipyard', short: 'Shipyard', price: 1, permits: 0, every: null, booked: false, retainer: 0, slack: 1.25, transit: 0,
    blurb: 'Builds one vessel at a time, section by section under its gantry, and launches her sideways. '
      + 'The price is paid in stages as the hull grows, and the delivery date is quoted from the gangs on the slip.',
    jobs: [
      { vessel: 'tugboat', name: 'Harbour tug', work: 1500, fee: 2000, bonus: 400, hull: C.maroon },
      { vessel: 'trawler', name: 'Stern trawler', work: 2400, fee: 3300, bonus: 660, hull: C.tealDeep },
      { vessel: 'patrol', name: 'Patrol boat', work: 3600, fee: 5200, bonus: 1040, hull: C.slate },
      { vessel: 'ferry', name: 'Car ferry', work: 5400, fee: 8300, bonus: 1660, hull: C.navy },
    ],
    names: ['HULL 101', 'HULL 102', 'HULL 103', 'HULL 104', 'HULL 105', 'HULL 106', 'HULL 107', 'HULL 108'],
  },
  repair: {
    name: 'Repair dock', short: 'Dock', price: 0.8, permits: 0, every: [200, 380], booked: false, retainer: 0, slack: 1.4, transit: 100,
    blurb: 'A ship lift between two piers. Ships come in for hull cleaning, painting and engine work whenever '
      + 'the dock is free, are lifted clear of the water, and pay when they float off again.',
    jobs: [
      { vessel: 'tugboat', name: 'Tug refit', work: 260, fee: 340, bonus: 85, hull: C.maroon },
      { vessel: 'trawler', name: 'Trawler overhaul', work: 380, fee: 500, bonus: 125, hull: C.tealDeep },
      { vessel: 'coaster', name: 'Hull survey and paint', work: 700, fee: 920, bonus: 230, hull: C.iron },
      { vessel: 'ferry', name: 'Ferry dry-docking', work: 900, fee: 1200, bonus: 300, hull: C.navy },
    ],
    names: ['BULLDOG', 'SKUA', 'NORTHERN LIGHT', 'GANNET', 'ROSA', 'HAVSULA', 'TEAL', 'AURORA', 'BRISK', 'DUNLIN'],
  },
  navy: {
    name: 'Naval base', short: 'Navy', price: 0.7, permits: 1, every: [300, 420], booked: true, retainer: 60, slack: 1.5, transit: 120,
    blurb: 'The navy pays a standing retainer to keep the berth ready and sends its ships in on a rota to store, '
      + 'fuel and make good. They come whether the berth is free or not, and a port that keeps them waiting loses the retainer.',
    jobs: [
      { vessel: 'patrol', name: 'Patrol boat storing', work: 150, fee: 200, bonus: 100, hull: C.slate },
      { vessel: 'frigate', name: 'Frigate maintenance period', work: 300, fee: 420, bonus: 200, hull: C.slate },
    ],
    names: ['P281 KESTREL', 'P282 MERLIN', 'P283 HOBBY', 'F310 RESOLVE', 'F311 STEADFAST'],
  },
  ferry: {
    name: 'Ferry terminal', short: 'Ferry', price: 0.5, permits: 0, every: [170, 210], booked: true, retainer: 0, slack: 1.5, transit: 100,
    blurb: 'A car ferry runs to a timetable: she is alongside for a few minutes while the linesmen turn her round, '
      + 'and pays for every sailing that leaves on time.',
    jobs: [{ vessel: 'ferry', name: 'Ferry sailing', work: 45, fee: 130, bonus: 50, hull: C.navy }],
    names: ['SOUND LINK', 'ISLAND QUEEN'],
  },
}
// What converting a yard to another use costs, against founding it new.
const CONVERT = 0.5

// What ships carry, and what it asks of the port. `dwell` is how long an import waits for its truck,
// `heft` how much slower a quay crane handles it, and `liveries` the box colours it comes in.
export type CargoId = 'goods' | 'food' | 'machines'
export const CARGO: Record<CargoId, { name: string; note: string; dwell: [number, number]; heft: number; liveries: number[] }> = {
  goods: {
    name: 'Dry goods', note: 'Ordinary boxes. Nothing special is asked of the port.',
    dwell: [240, 600], heft: 1, liveries: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  },
  food: {
    name: 'Chilled food', note: 'Pays well and cannot wait: short deadlines, and trucks come for it within a couple of minutes.',
    dwell: [60, 150], heft: 1, liveries: [4, 8, 3],
  },
  machines: {
    name: 'Machinery', note: 'Heavy lifts at the best rates. Quay cranes handle them at two thirds of their speed.',
    dwell: [240, 600], heft: 1.5, liveries: [2, 6, 7],
  },
}

// How often a line's ships call, against its timetable. More sailings is more money if the port keeps up.
export const SAILINGS = [
  { name: 'Fewer sailings', every: 1.35 }, { name: 'Usual sailings', every: 1 }, { name: 'More sailings', every: 0.75 },
]
const USUAL = 1

const faster = (what: string, step: number) => (n: number) => `${what} ${100 + step * n}% → ${100 + step * (n + 1)}%`

export const UPGRADES: Upgrade[] = [
  {
    id: 'berth', stage: 'Berth', name: 'Container berth', max: BERTH_X.length - 1, cost: (n) => 6000 * 3.2 ** n,
    permits: (n) => 2 + 2 * n, crew: true,
    effect: () => 'One more ship at once',
    desc: 'The next stretch of quay as a container berth, built with its first crane, so one more ship can be worked at once.',
    delta: (n) => `Berths ${n + 1} → ${n + 2}`,
  },
  {
    id: 'dredge', stage: 'Berth', name: 'Dredging', max: 2, cost: (n) => 2500 * 3.6 ** n,
    permits: (n) => 1 + 2 * n,
    effect: () => 'Bigger ships call',
    desc: 'Deeper water lets bigger ships call, and the bigger contracts need them. The channel is shut while the dredger works.',
    delta: (n) => (SIZES[n + 1] ? `Largest ship ${SIZES[n]} → ${SIZES[n + 1]}` : 'The biggest ships no longer wait for high water'),
  },
  {
    id: 'tug', stage: 'Berth', name: 'Tugs', max: 3, cost: (n) => 600 * 2 ** n,
    effect: () => 'Quicker berthing',
    desc: 'Ships berth and leave faster, so the channel clears sooner.',
    delta: faster('Manoeuvring speed', 25),
  },
  {
    id: 'gang', stage: 'Berth', name: 'Yard gang', max: (GANGS_PER_YARD - 1) * (BERTH_X.length - 1), cost: (n) => 700 * 1.5 ** n,
    crew: true,
    effect: () => 'One more gang',
    desc: 'Another gang at a shipyard, repair dock, naval base or ferry terminal. Its work goes as fast as its gangs. Up to four to a yard.',
    delta: () => 'One more gang at the yard',
  },
  {
    id: 'crane', stage: 'Cranes', name: 'Quay crane', max: CRANES_PER_BERTH * BERTH_X.length - 1, cost: (n) => 800 * 1.5 ** n,
    crew: true,
    effect: () => 'One more crane',
    desc: 'Another crane at a berth, to work its ships faster. Up to three to a berth.',
    delta: (n) => `Quay cranes ${n + 1} → ${n + 2}`,
  },
  {
    id: 'craneSpeed', stage: 'Cranes', name: 'Crane drives', max: 5, cost: (n) => 400 * 1.8 ** n,
    effect: () => 'Cranes 15% faster',
    desc: 'Faster hoist and trolley on every quay crane.',
    delta: faster('Crane speed', 15),
  },
  {
    id: 'carrier', stage: 'Yard', name: 'Yard tractor', max: 23, cost: (n) => 300 * 1.25 ** n,
    crew: true,
    effect: () => 'One more tractor',
    desc: 'Carries boxes between the cranes and the stacks.',
    delta: (n) => `Tractors ${n + 1} → ${n + 2}`,
  },
  {
    id: 'carrierSpeed', stage: 'Yard', name: 'Tractor engines', max: 5, cost: (n) => 350 * 1.8 ** n,
    effect: () => 'Drive 15% faster',
    desc: 'Every tractor drives faster.',
    delta: faster('Tractor speed', 15),
  },
  {
    id: 'yardBlock', stage: 'Yard', name: 'Yard block', max: 10, cost: (n) => 500 * 1.45 ** n,
    // The first six blocks are land the port already has leave to use.
    permits: (n) => (n >= 4 ? 1 : 0), crew: true,
    effect: () => 'More stack space',
    desc: 'More ground for stacks, with its own yard crane.',
    delta: (n) => `Yard blocks ${n + 2} → ${n + 3}`,
  },
  {
    id: 'stackHeight', stage: 'Yard', name: 'Stack height', max: 2, cost: (n) => 900 * 2.2 ** n,
    effect: () => 'One box higher',
    desc: 'One more tier. More room, but buried boxes take longer to dig out.',
    delta: (n) => `Stacks ${n + 2} → ${n + 3} boxes high`,
  },
  {
    id: 'yardCrane', stage: 'Yard', name: 'Yard crane drives', max: 4, cost: (n) => 450 * 1.8 ** n,
    effect: () => 'Lifts 20% faster',
    desc: 'Faster lifts between vehicles and stacks.',
    delta: faster('Yard crane speed', 20),
  },
  {
    id: 'gate', stage: 'Gate', name: 'Gate lane', max: 5, cost: (n) => 450 * 1.9 ** n,
    crew: true,
    effect: () => 'More trucks',
    desc: 'Another lane and booth, so more trucks take imports away and bring exports in.',
    delta: (n) => `Gate lanes ${n + 1} → ${n + 2}`,
  },
]

export interface Contract {
  id: string
  line: string
  route: string
  every: number
  unload: number
  load: number
  fee: number
  bonus: number
  window: number
  minReliability: number
  ship: ClassId
  hull: string
  ships: string[]
  // What the line carries. Left out, it is dry goods.
  cargo?: CargoId
}

// Which scenery a port is built with.
export type Look = 'nordic' | 'sunbelt' | 'rotterdam' | 'yokohama' | 'losangeles' | 'shanghai'

// What is different about working one harbour. Anything left out is as it is everywhere else.
export interface Rules {
  name: string
  text: string
  // Dredging already done when the port opens, and how far it can be taken.
  depth?: number
  deepest?: number
  // The tide: seconds from one high water to the next, and the level, from -1 at low water to 1 at high,
  // under which a ship that needs all the channel's depth cannot move.
  tide?: { period: number; sill: number }
  // Typhoons: seconds between them, least and most, the warning given, and how long one blows.
  typhoon?: { every: [number, number]; warning: number; blow: number }
  // The yard blocks the port has ground for: the first and the last of them.
  plots?: [number, number]
  // The share of her bonus a ship that leaves late costs the port.
  fine?: number
  // Imports wait this many times as long for a truck, and in these hours of the day only `crawl` of the
  // trucks get through.
  dwell?: number
  rush?: { hours: [number, number][]; crawl: number }
  // Pay, against what the same hand earns anywhere else.
  wages?: number
}

export interface PortDef {
  id: string
  name: string
  // The country, for the famous ones.
  where?: string
  // Where it lies on the globe, as longitude and latitude: sets how long a ship is at sea between two ports.
  sea: [number, number]
  blurb: string
  price: number
  permits: number
  look: Look
  rules?: Rules
  // Smallest line first: a new port opens with only that one signed.
  contracts: Contract[]
}

export const PORTS: PortDef[] = [
  {
    sea: [5, 60], id: 'sound', name: 'Jelly Sound', blurb: 'A small northern harbour.', price: 0, permits: 0, look: 'nordic',
    contracts: [
      { id: 'feeder', line: 'Baltic Feeder', route: 'Coastal loop', every: 210, unload: 8, load: 8, fee: 20, bonus: 150, window: 300, minReliability: 0, ship: 'feeder', hull: C.navy, ships: ['NORDHAVN', 'MOLLY B'] },
      { id: 'intra', line: 'Kittiwake Lines', route: 'Regional', every: 300, unload: 14, load: 10, fee: 22, bonus: 400, window: 420, minReliability: 60, ship: 'feeder', hull: C.maroon, ships: ['KITTIWAKE', 'FULMAR'] },
      { id: 'skerry', line: 'Skerry Line', route: 'North Sea', every: 270, unload: 20, load: 16, fee: 23, bonus: 520, window: 400, minReliability: 66, ship: 'feeder', hull: C.iron, ships: ['SKERRY', 'EIDER'] },
      { id: 'transpac', line: 'Sea Glass Maritime', route: 'Transpacific', every: 420, unload: 32, load: 24, fee: 26, bonus: 1200, window: 480, minReliability: 72, ship: 'panamax', hull: C.tealDeep, ships: ['SEA GLASS', 'TIDEWATER'] },
      { id: 'atlantic', line: 'Grey Heron Atlantic', route: 'Transatlantic', every: 460, unload: 40, load: 32, fee: 28, bonus: 1700, window: 520, minReliability: 78, ship: 'panamax', hull: C.navy, ships: ['GREY HERON', 'PETREL'] },
      { id: 'asiaeu', line: 'Iron Star', route: 'Asia–Europe', every: 600, unload: 72, load: 56, fee: 30, bonus: 3600, window: 720, minReliability: 82, ship: 'neo', hull: C.iron, ships: ['IRON STAR', 'POLARIS'] },
      { id: 'fresh', line: 'Fjord Fresh', route: 'Fish and dairy', every: 260, unload: 12, load: 10, fee: 30, bonus: 620, window: 290, minReliability: 68, ship: 'feeder', hull: C.tealDeep, ships: ['SILVERFIN', 'COLDWATER'], cargo: 'food' },
      { id: 'heavy', line: 'Nordic Heavy Lift', route: 'Turbines and plant', every: 540, unload: 22, load: 12, fee: 44, bonus: 1900, window: 540, minReliability: 76, ship: 'panamax', hull: C.maroon, ships: ['ATLAS', 'STRONGBACK'], cargo: 'machines' },
    ],
  },
  {
    sea: [-6, 36], id: 'amber', name: 'Amber Bay', price: 30000, permits: 5, look: 'sunbelt',
    blurb: 'A second terminal on a busier coast, where every line pays more.',
    contracts: [
      { id: 'coastal', line: 'Pelican Coastal', route: 'Bay shuttle', every: 210, unload: 8, load: 8, fee: 28, bonus: 220, window: 300, minReliability: 0, ship: 'feeder', hull: C.tealDeep, ships: ['PELICAN', 'SANDPIPER'] },
      { id: 'sunbelt', line: 'Mesa Lines', route: 'Gulf run', every: 290, unload: 16, load: 12, fee: 30, bonus: 520, window: 420, minReliability: 60, ship: 'feeder', hull: C.iron, ships: ['MESA', 'SAGUARO'] },
      { id: 'reef', line: 'Coral Coast Line', route: 'Island run', every: 260, unload: 22, load: 18, fee: 31, bonus: 680, window: 400, minReliability: 66, ship: 'feeder', hull: C.navy, ships: ['CORAL COAST', 'TRADEWIND'] },
      { id: 'pacific', line: 'Long Swell Pacific', route: 'Transpacific', every: 400, unload: 36, load: 28, fee: 36, bonus: 1600, window: 480, minReliability: 72, ship: 'panamax', hull: C.maroon, ships: ['LONG SWELL', 'PACIFICA'] },
      { id: 'andes', line: 'Condor Pacific', route: 'South Pacific', every: 450, unload: 44, load: 34, fee: 38, bonus: 2200, window: 520, minReliability: 78, ship: 'panamax', hull: C.tealDeep, ships: ['CONDOR', 'ALTIPLANO'] },
      { id: 'meridian', line: 'Meridian', route: 'Round the world', every: 580, unload: 76, load: 60, fee: 42, bonus: 4800, window: 720, minReliability: 82, ship: 'neo', hull: C.navy, ships: ['MERIDIAN', 'ZENITH'] },
      { id: 'citrus', line: 'Citrus Reefer', route: 'Fruit run', every: 250, unload: 14, load: 12, fee: 40, bonus: 820, window: 300, minReliability: 68, ship: 'feeder', hull: C.maroon, ships: ['VALENCIA', 'TANGELO'], cargo: 'food' },
      { id: 'sierra', line: 'Sierra Heavy Lift', route: 'Mining plant', every: 520, unload: 24, load: 14, fee: 56, bonus: 2500, window: 560, minReliability: 76, ship: 'panamax', hull: C.iron, ships: ['SIERRA', 'BULLDOG'], cargo: 'machines' },
    ],
  },
  {
    sea: [4, 52], id: 'rotterdam', name: 'Rotterdam', where: 'Netherlands', price: 90000, permits: 6, look: 'rotterdam',
    blurb: 'Europe\'s front door, at the mouth of the Maas.',
    rules: {
      name: 'North Sea tide',
      text: 'A ship that needs all the depth the channel has moves only around high water. Dredge deeper than she needs, one step further than anywhere else, and she comes and goes at any tide.',
      deepest: 3, tide: { period: 720, sill: -0.3 },
    },
    contracts: [
      { id: 'maas', line: 'Maas Shuttle', route: 'River run', every: 210, unload: 8, load: 8, fee: 35, bonus: 280, window: 300, minReliability: 0, ship: 'feeder', hull: C.navy, ships: ['MAASVLIET', 'WAAL'] },
      { id: 'hansa', line: 'Hansa Feeder', route: 'Baltic loop', every: 290, unload: 16, load: 12, fee: 38, bonus: 650, window: 420, minReliability: 60, ship: 'feeder', hull: C.maroon, ships: ['HANSA', 'KOGGE'] },
      { id: 'dogger', line: 'Doggerbank Line', route: 'North Sea', every: 260, unload: 22, load: 18, fee: 39, bonus: 850, window: 400, minReliability: 66, ship: 'feeder', hull: C.iron, ships: ['DOGGERBANK', 'NOORDZEE'] },
      { id: 'oranje', line: 'Oranje Atlantic', route: 'Transatlantic', every: 400, unload: 36, load: 28, fee: 45, bonus: 2000, window: 540, minReliability: 72, ship: 'panamax', hull: C.tealDeep, ships: ['ORANJE', 'ZEELAND'] },
      { id: 'kaap', line: 'Kaap Lijn', route: 'Cape route', every: 450, unload: 44, load: 34, fee: 48, bonus: 2750, window: 580, minReliability: 78, ship: 'panamax', hull: C.navy, ships: ['GOEDE HOOP', 'BATAVIA'] },
      { id: 'zijde', line: 'Zijde Express', route: 'Asia–Europe', every: 580, unload: 76, load: 60, fee: 53, bonus: 6000, window: 780, minReliability: 82, ship: 'neo', hull: C.maroon, ships: ['ZIJDE', 'MERWEDE'] },
      { id: 'bloem', line: 'Westland Bloem', route: 'Flowers and greens', every: 250, unload: 14, load: 12, fee: 50, bonus: 1000, window: 300, minReliability: 68, ship: 'feeder', hull: C.tealDeep, ships: ['TULP', 'WESTLAND'], cargo: 'food' },
      { id: 'rijn', line: 'Rijn Heavy Lift', route: 'Dredgers and cranes', every: 520, unload: 24, load: 14, fee: 70, bonus: 3100, window: 600, minReliability: 76, ship: 'panamax', hull: C.iron, ships: ['SCHELDE', 'KRAANVOGEL'], cargo: 'machines' },
    ],
  },
  {
    sea: [140, 35], id: 'yokohama', name: 'Yokohama', where: 'Japan', price: 180000, permits: 8, look: 'yokohama',
    blurb: 'Tokyo Bay, under Mount Fuji: a port hemmed in by its own city.',
    rules: {
      name: 'No room, no excuses',
      text: 'The city keeps both ends of the waterfront, so the yard has seven blocks and no more. The lines run to the minute: a ship that leaves late is fined half her bonus.',
      plots: [3, 9], fine: 0.5,
    },
    contracts: [
      { id: 'bay', line: 'Tokyo Bay Feeder', route: 'Bay shuttle', every: 210, unload: 8, load: 8, fee: 49, bonus: 380, window: 280, minReliability: 0, ship: 'feeder', hull: C.navy, ships: ['HAMAKAZE', 'SHIOKAZE'] },
      { id: 'seto', line: 'Seto Inland Line', route: 'Inland Sea', every: 280, unload: 16, load: 14, fee: 53, bonus: 900, window: 390, minReliability: 62, ship: 'feeder', hull: C.tealDeep, ships: ['SETO', 'AWAJI'] },
      { id: 'kuroshio', line: 'Kuroshio Lines', route: 'East Asia loop', every: 270, unload: 22, load: 18, fee: 54, bonus: 1190, window: 380, minReliability: 68, ship: 'feeder', hull: C.iron, ships: ['KUROSHIO', 'OYASHIO'] },
      { id: 'hokuto', line: 'Hokuto Pacific', route: 'North Pacific', every: 410, unload: 36, load: 30, fee: 62, bonus: 2760, window: 450, minReliability: 74, ship: 'panamax', hull: C.maroon, ships: ['HOKUTO', 'TSUBAME'] },
      { id: 'minami', line: 'Minami Cross', route: 'Australia run', every: 460, unload: 42, load: 34, fee: 66, bonus: 3840, window: 490, minReliability: 80, ship: 'panamax', hull: C.navy, ships: ['MINAMI', 'TANCHO'] },
      { id: 'asahi', line: 'Asahi World Line', route: 'Round the world', every: 600, unload: 76, load: 60, fee: 73, bonus: 8400, window: 680, minReliability: 84, ship: 'neo', hull: C.iron, ships: ['ASAHI', 'FUJISAN'] },
      { id: 'sanriku', line: 'Sanriku Fresh', route: 'Tuna and scallops', every: 240, unload: 14, load: 12, fee: 70, bonus: 1440, window: 280, minReliability: 70, ship: 'feeder', hull: C.tealDeep, ships: ['MAGURO', 'HOTATE'], cargo: 'food' },
      { id: 'keihin', line: 'Keihin Heavy', route: 'Machine tools', every: 500, unload: 24, load: 18, fee: 97, bonus: 4320, window: 520, minReliability: 78, ship: 'panamax', hull: C.maroon, ships: ['KEIHIN', 'DAIKOKU'], cargo: 'machines' },
    ],
  },
  {
    sea: [-118, 34], id: 'losangeles', name: 'Los Angeles', where: 'United States', price: 320000, permits: 10, look: 'losangeles',
    blurb: 'San Pedro Bay, where the Pacific trade meets the American road.',
    rules: {
      name: 'The long road inland',
      text: 'Imports wait nearly twice as long for a truck, and in the morning and evening rush the freeway lets a third of the trucks through. The dockers are union hands, on a third more pay.',
      dwell: 1.8, rush: { hours: [[7, 9.5], [16, 19]], crawl: 0.35 }, wages: 1.35,
    },
    contracts: [
      { id: 'catalina', line: 'Catalina Coastal', route: 'Coast shuttle', every: 210, unload: 8, load: 8, fee: 42, bonus: 330, window: 300, minReliability: 0, ship: 'feeder', hull: C.tealDeep, ships: ['CATALINA', 'AVALON'] },
      { id: 'baja', line: 'Baja Lines', route: 'Mexico run', every: 290, unload: 16, load: 12, fee: 45, bonus: 770, window: 420, minReliability: 60, ship: 'feeder', hull: C.maroon, ships: ['BAJA', 'ENSENADA'] },
      { id: 'aloha', line: 'Aloha Island Line', route: 'Hawaii run', every: 260, unload: 22, load: 18, fee: 47, bonus: 1020, window: 400, minReliability: 66, ship: 'feeder', hull: C.navy, ships: ['ALOHA', 'MAUNA KEA'] },
      { id: 'jade', line: 'Jade Pacific', route: 'Transpacific', every: 400, unload: 40, load: 22, fee: 54, bonus: 2380, window: 480, minReliability: 72, ship: 'panamax', hull: C.tealDeep, ships: ['JADE', 'GOLDEN GATE'] },
      { id: 'southern', line: 'Southern Cross Pacific', route: 'Oceania', every: 450, unload: 48, load: 26, fee: 57, bonus: 3260, window: 520, minReliability: 78, ship: 'panamax', hull: C.iron, ships: ['SOUTHERN CROSS', 'KIWI'] },
      { id: 'sunset', line: 'Sunset Express', route: 'Asia–America', every: 580, unload: 88, load: 40, fee: 62, bonus: 7200, window: 720, minReliability: 82, ship: 'neo', hull: C.maroon, ships: ['SUNSET', 'EL DORADO'] },
      { id: 'valley', line: 'Central Valley Reefer', route: 'Fruit and nuts', every: 250, unload: 12, load: 16, fee: 60, bonus: 1230, window: 300, minReliability: 68, ship: 'feeder', hull: C.navy, ships: ['ALMOND', 'NAVEL'], cargo: 'food' },
      { id: 'mojave', line: 'Mojave Heavy Lift', route: 'Aerospace and plant', every: 520, unload: 24, load: 14, fee: 84, bonus: 3740, window: 560, minReliability: 76, ship: 'panamax', hull: C.iron, ships: ['MOJAVE', 'JOSHUA TREE'], cargo: 'machines' },
    ],
  },
  {
    sea: [122, 31], id: 'shanghai', name: 'Shanghai', where: 'China', price: 600000, permits: 12, look: 'shanghai',
    blurb: 'Yangshan: the busiest container port in the world, built on islands in deep water.',
    rules: {
      name: 'Typhoon season',
      text: 'The water is deep enough for any ship from the first day, and the ships are the biggest afloat. Typhoons cross the port: the signal goes up two minutes ahead, then nothing moves until it has blown over.',
      depth: 2, typhoon: { every: [900, 1500], warning: 120, blow: 70 },
    },
    contracts: [
      { id: 'yangtze', line: 'Yangtze Feeder', route: 'River shuttle', every: 200, unload: 8, load: 8, fee: 59, bonus: 480, window: 300, minReliability: 0, ship: 'feeder', hull: C.navy, ships: ['CHANG JIANG', 'WUSONG'] },
      { id: 'bohai', line: 'Bohai Coastal', route: 'Coastal loop', every: 300, unload: 18, load: 14, fee: 63, bonus: 1150, window: 420, minReliability: 60, ship: 'feeder', hull: C.tealDeep, ships: ['BOHAI', 'HAI YAN'] },
      { id: 'strait', line: 'Strait Runner', route: 'Straits run', every: 290, unload: 24, load: 20, fee: 65, bonus: 1500, window: 440, minReliability: 66, ship: 'feeder', hull: C.maroon, ships: ['YU LONG', 'BAI HE'] },
      { id: 'dragon', line: 'Dragon Pacific', route: 'Transpacific', every: 460, unload: 48, load: 36, fee: 76, bonus: 3900, window: 540, minReliability: 72, ship: 'panamax', hull: C.maroon, ships: ['LONG TENG', 'PACIFIC DRAGON'] },
      { id: 'silk', line: 'Maritime Silk Road', route: 'Asia–Europe', every: 800, unload: 84, load: 66, fee: 80, bonus: 8600, window: 840, minReliability: 78, ship: 'neo', hull: C.navy, ships: ['SI LU', 'ZHENG HE'] },
      { id: 'pearl', line: 'Oriental Pearl World', route: 'Round the world', every: 960, unload: 104, load: 84, fee: 88, bonus: 12500, window: 1000, minReliability: 84, ship: 'neo', hull: C.iron, ships: ['DONG FANG', 'MING ZHU'] },
      { id: 'zhoushan', line: 'Zhoushan Fresh', route: 'Seafood', every: 240, unload: 16, load: 12, fee: 84, bonus: 1900, window: 300, minReliability: 68, ship: 'feeder', hull: C.tealDeep, ships: ['ZHOUSHAN', 'HAI XIAN'], cargo: 'food' },
      { id: 'baoshan', line: 'Baoshan Heavy', route: 'Steel and plant', every: 500, unload: 28, load: 18, fee: 118, bonus: 5600, window: 600, minReliability: 76, ship: 'panamax', hull: C.iron, ships: ['BAOSHAN', 'GANG TIE'], cargo: 'machines' },
    ],
  },
]

// The player's own ships. One is ordered at a shipyard to a design, built on its slip by the gangs there, and
// then trades for the player: from a home port overseas and back, or between two of the player's ports.
export interface Design {
  name: string
  hull: string
  size: ClassId
  // An index into ENGINES.
  engine: number
  // What her holds are fitted for.
  fit: CargoId
}

export interface Vessel extends Design {
  id: number
  // The port she trades from, and the one she trades to: another of the player's, or null for overseas.
  home: string
  away: string | null
  // The port she is bound for or lying at, when she is due offshore there, and the boxes aboard for it.
  at: string
  due: number
  aboard: number
  // Offshore or alongside there now.
  calling: boolean
  voyages: number
  // Freight less voyage costs, over her life.
  earned: number
}

// What a slip can build: the boxes she carries each way, her price and the seconds of one gang's work in her,
// and what one round trip overseas costs to run at the standard speed.
export const HOLDS: Partial<Record<ClassId, { boxes: number; price: number; work: number; running: number }>> = {
  feeder: { boxes: 22, price: 5000, work: 1500, running: 300 },
  panamax: { boxes: 56, price: 16000, work: 3200, running: 760 },
}
// Speed at sea against fuel burnt. Crew are paid by the day, so a slow ship saves less than her fuel.
export const ENGINES = [
  { name: 'Economy', pace: 0.75, fuel: 0.55, price: 0.9, note: 'A quarter slower at sea, on about half the fuel' },
  { name: 'Standard', pace: 1, fuel: 1, price: 1, note: 'The usual service speed' },
  { name: 'Fast', pace: 1.4, fuel: 2, price: 1.3, note: 'Two fifths faster at sea, on twice the fuel' },
]
// What her holds are fitted for. Special cargo pays more a box but there is less of it to carry, so a ship
// fitted for it earns about the same on a voyage in fewer lifts: it pays where berth time is what is short.
export const FITS: Record<CargoId, { name: string; price: number; freight: number; boxes: number }> = {
  goods: { name: 'Dry holds', price: 1, freight: 1, boxes: 1 },
  food: { name: 'Reefer plugs', price: 1.2, freight: 1.35, boxes: 0.75 },
  machines: { name: 'Heavy-lift deck', price: 1.3, freight: 1.6, boxes: 0.6 },
}
export const HULL_PAINTS = [C.navy, C.maroon, C.tealDeep, C.iron, C.berry, C.signalBlue]
// What an own ship earns for each box she lands or takes on, against the first line's handling fee at that
// port. There is no bonus on top: a quicker turn pays by getting her back sooner.
export const FREIGHT = 2.6
// Seconds at sea each way to the ports overseas, at the standard speed. A longer haul pays more a box.
export const OVERSEAS = 300
const HAUL = { base: 0.6, perLeg: 0.4 }
const CREW_SHARE = 0.4
// What selling a ship brings back, against her price new.
export const RESALE = 0.4
const SHIP_NAMES = [
  'MOON JELLY', 'COMPASS ROSE', 'FAIR WIND', 'NORTH STAR', 'LITTLE AUK', 'SEA BISCUIT', 'BLUE PETER', 'HOMEWARD',
  'FIRST LIGHT', 'SALT AND STEEL', 'HIGH WATER', 'LONG WAY ROUND',
]

// Seconds at sea between two ports at the standard speed: a start, and so long for the distance over the globe.
export function passage(a: PortDef, b: PortDef): number {
  const rad = Math.PI / 180
  const [lon1, lat1] = a.sea
  const [lon2, lat2] = b.sea
  const h = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2
  const km = 2 * 6371 * Math.asin(Math.sqrt(h))
  return Math.round(120 + km / 25)
}

// A ship turned round well inside its window earns more than its bonus, and so does a run of ships on time.
export const PACE = [{ within: 0.5, pays: 2, name: 'Express' }, { within: 0.75, pays: 1.5, name: 'Fast' }]
export const STREAK = { step: 0.05, most: 10 }

interface PortSave {
  keels: Port['keels']
  streak: number
  yards: Industry[]
  gangs: number[]
  products: Record<number, number>
  homes: Record<string, number>
  first: number | null
  last: Port['last']
  owned: boolean
  reliability: number
  levels: Record<UpgradeId, number>
  contracts: string[]
  stats: Port['stats']
  yardImports: number
  yardExports: number
  // Saves from before the port had people by name kept only a count of crews waiting.
  crews?: number
  workers: Worker[]
  applicants: Worker[]
  serial: number
  sailings: Record<string, number>
  training: number
  cranes: number[]
  blocks: number[]
}

// One terminal the player owns or can buy: what is built there, who calls, and how it has done.
export class Port {
  owned = false
  reliability = 70
  levels: Record<UpgradeId, number> = {
    berth: 0, dredge: 0, tug: 0, gang: 0, crane: 0, craneSpeed: 0, carrier: 0, carrierSpeed: 0,
    yardBlock: 0, stackHeight: 0, yardCrane: 0, gate: 0,
  }
  contracts: string[]
  stats = { boxes: 0, ships: 0, onTime: 0, late: 0, trucks: 0, diverted: 0, earned: 0, wages: 0, best: 0, jobs: 0 }
  yardImports = 14
  yardExports = 12
  // What each stretch of quay is given over to, and the gangs at each yard that is not a container berth.
  yards: Industry[] = BERTH_X.map(() => 'boxes')
  gangs: number[] = BERTH_X.map(() => 0)
  // What each shipyard builds next: an index into its jobs.
  products: Record<number, number> = {}
  // A ship of the player's own ordered at a shipyard, by berth, and the seconds of work done on her so far.
  keels: Record<number, { design: Design; done: number }> = {}
  // Kept by the terminal: which berths have a ship at them or bound for them.
  busy: boolean[] = BERTH_X.map(() => false)
  // Quay cranes standing at each berth, and the yard blocks opened, in the order they were.
  cranes: number[] = BERTH_X.map((_, berth) => (berth === 0 ? 1 : 0))
  blocks: number[] = UNLOCK_ORDER.slice(0, START_BLOCKS)
  // Everyone on the payroll, in the order they work their trade's machines; those without a post are in the hall.
  workers: Worker[] = []
  // People asking for work, and how near the next one is to turning up, from 0 to 1.
  applicants: Worker[] = []
  training = 0
  // Whether the port has been given a hand for every machine it started with.
  mustered = false
  // How often each line's ships call: an index into SAILINGS. A line not listed keeps its timetable.
  sailings: Record<string, number> = {}
  private serial: number
  // Ships in a row that have left on time.
  streak = 0
  // The berth each line's ships are kept for. A line not listed takes whichever berth is free.
  homes: Record<string, number> = {}
  // The berth whose cranes get the first call on idle tractors, if the player has picked one.
  first: number | null = null
  // How each line's last ship did: the share of her window she used, and what she paid on leaving.
  last: Record<string, { used: number; paid: number }> = {}
  holdUntil = 0
  stormUntil = 0
  gateSlowUntil = 0

  constructor(readonly def: PortDef) {
    this.contracts = [def.contracts[0].id]
    this.levels.dredge = def.rules?.depth ?? 0
    // Each port draws its people from numbers of its own.
    this.serial = PORTS.indexOf(def) * 100000 + 1
    this.applicants.push(applicant(this.serial++))
  }

  // People who could take a new machine: applicants, and hands with nothing to work.
  get crews(): number {
    return this.applicants.length + this.workers.filter((worker) => !worker.post).length
  }

  // Every post there is: one for each machine.
  posts(): Post[] {
    const posts: Post[] = []
    this.cranes.forEach((count, berth) => {
      for (let k = 0; k < count; k++) posts.push({ trade: 'crane', at: berth })
    })
    this.gangs.forEach((count, berth) => {
      for (let k = 0; k < count; k++) posts.push({ trade: 'fitter', at: berth })
    })
    for (let k = 0; k <= this.levels.carrier; k++) posts.push({ trade: 'tractor', at: 0 })
    for (const block of this.blocks) posts.push({ trade: 'yard', at: block })
    for (let k = 0; k <= this.levels.gate; k++) posts.push({ trade: 'gate', at: 0 })
    return posts
  }

  // Whoever holds a kind of post, in the order of the machines they work.
  crew(trade: Trade, at = 0): Worker[] {
    return this.workers.filter((worker) => worker.post?.trade === trade && worker.post.at === at)
  }

  // Posts with nobody on them.
  vacancies(): Post[] {
    const open = this.posts()
    for (const worker of this.workers) {
      const i = open.findIndex((post) => samePost(post, worker.post))
      if (i >= 0) open.splice(i, 1)
    }
    return open
  }

  // Brings the roster in line with the machines. A hand whose machine has gone waits in the hall, and anyone
  // waiting there takes the empty post they are best at. A port starts with an ordinary hand on every machine.
  private restaff(): void {
    const open = this.posts()
    for (const worker of this.workers) {
      const i = open.findIndex((post) => samePost(post, worker.post))
      if (i >= 0) open.splice(i, 1)
      else worker.post = null
    }
    if (!this.mustered) {
      this.mustered = true
      for (const post of open) this.workers.push({ ...hand(this.serial++), post })
      return
    }
    for (const post of open) {
      const idle = this.workers.filter((worker) => !worker.post)
      if (!idle.length) return
      idle.sort((a, b) => b.skill[post.trade] - a.skill[post.trade])[0].post = post
    }
  }

  // Finds someone for a new machine: a hand already waiting, or else the applicant best at the trade.
  man(trade: Trade): void {
    if (this.workers.some((worker) => !worker.post) || !this.applicants.length) return
    const best = [...this.applicants].sort((a, b) => b.skill[trade] - a.skill[trade])[0]
    this.hire(best.id)
  }

  // An ordinary hand for every empty post, from nowhere: for god mode.
  conjure(): void {
    for (const post of this.vacancies()) this.workers.push({ ...hand(this.serial++), post })
  }

  find(id: number): Worker | undefined {
    return this.workers.find((worker) => worker.id === id) ?? this.applicants.find((worker) => worker.id === id)
  }

  hire(id: number): void {
    const i = this.applicants.findIndex((worker) => worker.id === id)
    if (i < 0) return
    this.workers.push(...this.applicants.splice(i, 1))
    this.restaff()
  }

  // Sends an applicant away, or lets a hand go. Their machine stands idle until someone takes it.
  dismiss(id: number): void {
    this.applicants = this.applicants.filter((worker) => worker.id !== id)
    this.workers = this.workers.filter((worker) => worker.id !== id)
    this.restaff()
  }

  promote(id: number): void {
    const worker = this.workers.find((w) => w.id === id)
    if (!worker || !promotable(worker)) return
    worker.exp = 0
    worker.grade++
  }

  setPay(id: number, pay: number): void {
    const worker = this.workers.find((w) => w.id === id)
    if (worker && PAY[pay]) worker.pay = pay
  }

  // Two hands change places. Either may be waiting in the hall.
  swap(a: number, b: number): void {
    const [one, other] = [this.workers.find((w) => w.id === a), this.workers.find((w) => w.id === b)]
    if (!one || !other) return
    ;[one.post, other.post] = [other.post, one.post]
    this.restaff()
  }

  // Sends a hand to a post that is standing empty.
  move(id: number, post: Post): void {
    const worker = this.workers.find((w) => w.id === id)
    if (!worker || !this.vacancies().some((open) => samePost(open, post))) return
    worker.post = { ...post }
    this.restaff()
  }

  // Time worked, towards a promotion.
  credit(worker: Worker, seconds: number): void {
    if (GRADES[worker.grade].exp < Infinity) worker.exp += seconds * PAY[worker.pay].learns
  }

  // Seconds between a line's ships, with the sailings the player has asked for.
  every(contract: Contract): number {
    return contract.every * SAILINGS[this.sailings[contract.id] ?? USUAL].every
  }

  contract(id: string): Contract {
    return this.def.contracts.find((c) => c.id === id)!
  }

  // The open berths that handle containers, and the open yards that do something else.
  get quays(): number[] {
    return this.yards.map((_, berth) => berth).filter((berth) => berth <= this.levels.berth && this.yards[berth] === 'boxes')
  }

  get works(): number[] {
    return this.yards.map((_, berth) => berth).filter((berth) => berth <= this.levels.berth && this.yards[berth] !== 'boxes')
  }

  // What a berth is given over to, if it is open and not a container berth.
  worksAt(berth: number): Works | null {
    const industry = this.yards[berth]
    return berth <= this.levels.berth && industry !== 'boxes' ? industry : null
  }

  // The yard blocks this port has ground for: the ones nearest the first berth.
  get plots(): number[] {
    const [first, last] = this.def.rules?.plots ?? [0, YARD.blocks - 1]
    return UNLOCK_ORDER.filter((block) => block >= first && block <= last)
  }

  maxLevel(id: UpgradeId): number {
    if (id === 'crane') return CRANES_PER_BERTH * this.quays.length - 1
    if (id === 'dredge') return this.def.rules?.deepest ?? 2
    if (id === 'yardBlock') return this.plots.length - START_BLOCKS
    if (id === 'gang') return (GANGS_PER_YARD - 1) * this.works.length
    return UPGRADES.find((u) => u.id === id)!.max
  }

  // Brings the placements in line with the counts. Old saves and the dev switches only set counts.
  settle(): void {
    const { levels, cranes, blocks, gangs } = this
    this.yards[0] = 'boxes'
    const quays = this.quays
    const works = this.works
    // Every container berth has at least the crane it was built with, and nowhere else has any.
    const total = Math.max(quays.length, 1 + levels.crane)
    levels.crane = total - 1
    for (let berth = 0; berth < cranes.length; berth++) {
      cranes[berth] = quays.includes(berth) ? Math.max(1, cranes[berth]) : 0
    }
    const count = () => cranes.reduce((sum, n) => sum + n, 0)
    const pick = (best: (a: number, b: number) => boolean) => {
      let chosen = 0
      for (const berth of quays) if (best(cranes[berth], cranes[chosen])) chosen = berth
      return chosen
    }
    while (count() < total) cranes[pick((a, b) => a < b)]++
    while (count() > total) cranes[pick((a, b) => a >= b)]--
    // Every other yard has at least the gang it was founded with.
    for (let berth = 0; berth < gangs.length; berth++) {
      gangs[berth] = works.includes(berth) ? Math.min(GANGS_PER_YARD, Math.max(1, gangs[berth])) : 0
    }
    levels.gang = gangs.reduce((sum, n) => sum + n, 0) - works.length

    const wanted = START_BLOCKS + levels.yardBlock
    for (const block of this.plots) {
      if (blocks.length >= wanted) break
      if (!blocks.includes(block)) blocks.push(block)
    }
    blocks.length = Math.min(blocks.length, wanted)
    this.restaff()
  }

  // The place an offer applies to: a berth for a berth or a crane, a block for a yard block.
  // Without a place picked, a crane goes to the open berth with the fewest and a block next to the others.
  where(offer: Offer): number {
    const { levels, cranes, blocks } = this
    if (offer.at !== undefined) return offer.at
    if (offer.id === 'berth') return levels.berth + 1
    if (offer.id === 'crane') {
      let chosen = 0
      for (const berth of this.quays) if (cranes[berth] < cranes[chosen]) chosen = berth
      return chosen
    }
    if (offer.id === 'gang') {
      return this.works.reduce((chosen, berth) => (chosen < 0 || this.gangs[berth] < this.gangs[chosen] ? berth : chosen), -1)
    }
    if (offer.id === 'yardBlock') {
      const free = this.plots.filter((block) => !blocks.includes(block))
      return free.find((block) => this.beside(block)) ?? free[0] ?? -1
    }
    return -1
  }

  private beside(block: number): boolean {
    return this.blocks.some((mine) => Math.abs(mine - block) === 1)
  }

  // How far along an offer is, and how far it goes. A crane or block at a picked place is counted there;
  // otherwise the count is for the whole port.
  level(offer: Offer): number {
    if (offer.at === undefined) return this.levels[offer.id]
    if (offer.id === 'crane') return this.cranes[offer.at]
    if (offer.id === 'gang') return this.gangs[offer.at]
    if (offer.id === 'yardBlock') return this.blocks.includes(offer.at) ? 1 : 0
    if (offer.id === 'berth') return offer.at <= this.levels.berth ? 1 : 0
    return this.levels[offer.id]
  }

  max(offer: Offer): number {
    if (offer.at === undefined) return this.maxLevel(offer.id)
    if (offer.id === 'crane') return CRANES_PER_BERTH
    if (offer.id === 'gang') return GANGS_PER_YARD
    if (offer.id === 'yardBlock' || offer.id === 'berth') return 1
    return this.maxLevel(offer.id)
  }

  // What has to exist before an offer makes sense, or null when nothing is in the way.
  needs(offer: Offer): string | null {
    const { levels, cranes, blocks } = this
    const at = this.where(offer)
    switch (offer.id) {
      case 'berth':
        // The quay is built outwards from the town, one berth after another.
        return at > levels.berth + 1 ? `Open berth ${levels.berth + 2} first` : null
      case 'gang':
        return at < 0 || this.worksAt(at) === null ? 'Needs a shipyard, repair dock, naval base or ferry terminal' : null
      case 'crane':
        if (at > levels.berth) return 'Open this berth first'
        if (this.yards[at] !== 'boxes') return 'Not a container berth'
        // Left to the port, a crane goes to the emptiest berth: if that one is full, they all are.
        if (offer.at === undefined && cranes[at] >= CRANES_PER_BERTH) {
          return levels.berth < BERTH_X.length - 1 ? 'Needs another berth' : null
        }
        // Cranes need room between them, and a feeder is too short for three.
        if (cranes[at] === CRANES_PER_BERTH - 1 && !levels.dredge) {
          return 'Dredge first: only bigger ships have room for a third crane'
        }
        return null
      case 'carrier':
        return 1 + levels.carrier >= TRACTORS_PER_CRANE * (1 + levels.crane)
          ? 'Needs another crane: three tractors are all one crane keeps busy' : null
      case 'yardBlock':
        if (at >= 0 && !this.plots.includes(at)) return 'The city keeps this ground'
        return at < 0 || blocks.includes(at) || this.beside(at) ? null : 'Open a block next to it first'
      case 'gate':
        return 1 + levels.gate >= blocks.length ? 'Needs another yard block: each lane needs a block for its trucks' : null
      default:
        return null
    }
  }

  // The berth a line's ships wait for, or null when they take any. A berth that is not working holds no one up.
  home(line: string | null): number | null {
    const berth = line === null ? undefined : this.homes[line]
    return berth !== undefined && this.quays.includes(berth) && this.cranes[berth] > 0 ? berth : null
  }

  // Why a crane cannot go from one berth to the next, or null when it can. A crane runs on the quay rails
  // and cannot pass another, so it only ever moves to the berth beside its own.
  moveBlocker(from: number, to: number): string | null {
    if (Math.abs(from - to) !== 1 || to > this.levels.berth || from > this.levels.berth) return 'Open that berth first'
    if (this.yards[to] !== 'boxes' || this.yards[from] !== 'boxes') return 'Not a container berth'
    if (this.cranes[from] <= 1) return 'A berth keeps its last crane'
    if (this.cranes[to] >= CRANES_PER_BERTH) return 'That berth is full'
    if (this.cranes[to] === CRANES_PER_BERTH - 1 && !this.levels.dredge) return 'Dredge first'
    return null
  }

  // Puts a paid-for offer in place.
  build(offer: Offer): void {
    const at = this.where(offer)
    this.levels[offer.id]++
    if (offer.id === 'crane') this.cranes[at]++
    if (offer.id === 'gang') this.gangs[at]++
    if (offer.id === 'yardBlock') this.blocks.push(at)
    // A berth is built with its first crane.
    if (offer.id === 'berth') {
      this.yards[at] = 'boxes'
      this.cranes[at] = 1
      this.levels.crane++
    }
  }

  // Opens the next stretch of quay as a yard for some other work, with its first gang.
  found(industry: Works): void {
    const at = ++this.levels.berth
    this.yards[at] = industry
    this.gangs[at] = 1
  }

  // Why a yard cannot be turned over to another use, or null when it can.
  convertBlocker(berth: number, industry: Industry): string | null {
    if (berth === 0) return 'The first berth stays a container berth'
    if (berth > this.levels.berth) return 'Open this berth first'
    if (this.yards[berth] === industry) return 'It is that already'
    if (this.keels[berth]) return 'A ship of yours is on order here'
    return this.busy[berth] ? 'Wait until the yard is empty' : null
  }

  // Turns a yard over to another use. Its cranes or gangs are sold with it, and their hands wait in the hall
  // for whatever the new yard needs.
  convert(berth: number, industry: Industry): void {
    this.levels.crane -= this.cranes[berth]
    this.cranes[berth] = 0
    this.gangs[berth] = 0
    this.yards[berth] = industry
    if (industry === 'boxes') {
      this.cranes[berth] = 1
      this.levels.crane++
    } else {
      this.gangs[berth] = 1
    }
    for (const line of Object.keys(this.homes)) if (this.homes[line] === berth) delete this.homes[line]
    if (this.first === berth) this.first = null
    delete this.products[berth]
    delete this.keels[berth]
    this.settle()
  }

  // Everyone on the payroll, working or waiting.
  get staff(): number {
    return this.workers.length
  }

  // Word gets round until the hall is full. Returns true when someone new has just turned up.
  train(dt: number): boolean {
    if (this.applicants.length >= CREW_POOL) return false
    this.training += dt / TRAIN_TIME
    if (this.training < 1) return false
    this.training = 0
    this.applicants.push(applicant(this.serial++))
    return true
  }

  // Why a contract cannot be signed yet, or null if it can.
  blocker(id: string): string | null {
    const c = this.contract(id)
    if (this.levels.dredge < CLASSES[c.ship].dredge) return 'Needs dredging'
    if (this.reliability < c.minReliability) return `Needs ${c.minReliability}% reliability`
    return null
  }

  canSign(id: string): boolean {
    return !this.contracts.includes(id) && this.blocker(id) === null
  }

  // What a ship's on-time bonus comes to, given the share of her window she used, and how to describe it.
  reward(bonus: number, used: number): { sum: number; note: string } {
    const pace = PACE.find((p) => used <= p.within)
    const run = 1 + this.run
    const note = [pace ? `${pace.name} ×${pace.pays}` : 'On time', this.streak > 0 ? `${this.streak + 1} in a row` : '']
    return { sum: Math.round((bonus * (pace?.pays ?? 1) * run) / 10) * 10, note: note.filter(Boolean).join(' · ') }
  }

  // How much a run of ships on time adds to the next bonus, as a share.
  get run(): number {
    return Math.min(this.streak, STREAK.most) * STREAK.step
  }

  score(onTime: boolean): void {
    this.streak = onTime ? this.streak + 1 : 0
    this.reliability = this.reliability * 0.85 + (onTime ? 100 : 0) * 0.15
    if (onTime) this.stats.onTime++
    else this.stats.late++
  }

  toJSON(): PortSave {
    const { owned, reliability, levels, contracts, stats, yardImports, yardExports, training, cranes, blocks, streak } = this
    const { homes, first, last, workers, applicants, serial, sailings, yards, gangs, products, keels } = this
    return {
      owned, reliability, levels, contracts, stats, yardImports, yardExports, training, cranes, blocks, streak,
      homes, first, last, workers, applicants, serial, sailings, yards, gangs, products, keels,
    }
  }

  restore(data: Partial<PortSave>): void {
    Object.assign(this.levels, data.levels)
    Object.assign(this.stats, data.stats)
    const kept = [
      'owned', 'reliability', 'yardImports', 'yardExports', 'training', 'streak', 'homes', 'first', 'last',
      'workers', 'applicants', 'sailings', 'products', 'keels',
    ] as const
    if (data.yards) this.yards = BERTH_X.map((_, berth) => data.yards![berth] ?? 'boxes')
    if (data.gangs) this.gangs = BERTH_X.map((_, berth) => data.gangs![berth] ?? 0)
    // A save from before the port had people by name: its machines get ordinary hands, and the crews it had
    // waiting become applicants.
    this.mustered = data.workers !== undefined
    if (data.serial) this.serial = data.serial
    if (data.crews !== undefined) {
      this.applicants = Array.from({ length: Math.min(CREW_POOL, data.crews) }, () => applicant(this.serial++))
    }
    for (const key of kept) {
      if (data[key] !== undefined) (this[key] as unknown) = data[key]
    }
    if (data.contracts) this.contracts = data.contracts.filter((id) => this.def.contracts.some((c) => c.id === id))
    this.levels.stackHeight = Math.min(this.levels.stackHeight, this.maxLevel('stackHeight'))
    if (data.cranes) this.cranes = BERTH_X.map((_, berth) => data.cranes![berth] ?? 0)
    if (data.blocks) this.blocks = data.blocks.filter((block) => this.plots.includes(block))
    this.settle()
  }
}

export class Game {
  money = 600
  permits = 0
  // Stamps towards the next permit.
  stamps = 0
  // How far pay deals have pushed wages above the starting rate.
  wageLevel = 1
  quiet = false
  sound = true
  // Showing the whole port rather than the close view.
  wide = false
  // God mode: everything is free. Nothing is short and nothing is spent, so the real balances are
  // untouched when it is switched off. What has to be built first still has to be.
  god = false
  // Recent income after wages, in dollars a second. Also used to pay for time away.
  rate = 0
  awayNote = ''
  time = 0
  persist = true
  ports = PORTS.map((def) => new Port(def))
  // The player's own ships, the keels ordered so far and the ships launched.
  fleet: Vessel[] = []
  private hulls = 0
  private launched = 0
  // The port on screen.
  active = 0
  private clock = 0
  private earnedMark: number | null = null

  constructor() {
    this.ports[0].owned = true
  }

  get port(): Port {
    return this.ports[this.active]
  }

  get owned(): Port[] {
    return this.ports.filter((port) => port.owned)
  }

  // The ports still on sale, and the first of them.
  get onSale(): Port[] {
    return this.ports.filter((port) => !port.owned)
  }

  get forSale(): Port | null {
    return this.onSale[0] ?? null
  }

  cost(port: Port, id: UpgradeId): number {
    return this.price(port, id).cash
  }

  price(port: Port, id: UpgradeId): Price {
    const upgrade = UPGRADES.find((u) => u.id === id)!
    const level = port.levels[id]
    return {
      cash: Math.round(upgrade.cost(level) / 10) * 10,
      permits: upgrade.permits?.(level) ?? 0,
      crews: upgrade.crew ? 1 : 0,
    }
  }

  // How much of a price is still missing. All zeros means it can be paid.
  lacks(price: Price, port: Port): Price {
    if (this.god) return { cash: 0, permits: 0, crews: 0 }
    return {
      cash: Math.max(0, price.cash - this.money),
      permits: Math.max(0, price.permits - this.permits),
      crews: Math.max(0, price.crews - port.crews),
    }
  }

  private pay(price: Price, port: Port): boolean {
    if (this.god) return true
    const short = this.lacks(price, port)
    if (short.cash || short.permits || short.crews) return false
    this.money -= price.cash
    this.permits -= price.permits
    return true
  }

  // `at` picks the berth for a crane or the yard block to open; without it the port chooses.
  canBuy(port: Port, id: UpgradeId, at?: number): boolean {
    const offer = { id, at }
    const short = this.lacks(this.price(port, id), port)
    return port.level(offer) < port.max(offer) && port.needs(offer) === null
      && !short.cash && !short.permits && !short.crews
  }

  buy(port: Port, id: UpgradeId, at?: number): void {
    const offer = { id, at }
    if (port.level(offer) >= port.max(offer) || port.needs(offer) !== null) return
    port.settle()
    if (!this.pay(this.price(port, id), port)) return
    port.build(offer)
    port.settle()
    // Someone has to work it: nobody is taken on in god mode, so a hand is found from nowhere.
    const trade = TRADE_OF[id]
    if (trade && this.god) port.conjure()
    else if (trade) port.man(trade)
    this.save()
  }

  portPrice(port: Port): Price {
    return { cash: port.def.price, permits: port.def.permits, crews: 0 }
  }

  // Buys a port that is on sale: the first, unless one is named. Returns it, or null if it cannot be paid for.
  expand(port: Port | null = this.forSale): Port | null {
    if (!port || port.owned || !this.pay(this.portPrice(port), port)) return null
    port.owned = true
    this.save()
    return port
  }

  // The council marks each departure: a stamp for a ship on time, stamps taken back for one late or
  // turned away. Returns true when the stamps have just made a permit.
  stamp(onTime: boolean): boolean {
    if (!onTime) {
      this.stamps = Math.max(0, this.stamps - STAMPS_LOST)
      return false
    }
    if (++this.stamps < STAMPS_PER_PERMIT) return false
    this.stamps = 0
    this.permits++
    return true
  }

  // Wages a minute for everyone on a port's payroll.
  payroll(port: Port): number {
    return port.workers.reduce((sum, worker) => sum + wage(worker), 0) * this.wages(port)
  }

  // What a dollar of pay comes to at a port: the pay deals so far, and what that harbour's hands hold out for.
  wages(port: Port): number {
    return this.wageLevel * (port.def.rules?.wages ?? 1)
  }

  // What it costs to open the next stretch of quay as a yard, or to turn an open one over to another use.
  // The first follows the price of a container berth on the same site.
  private berthPrice(step: number): number {
    return UPGRADES.find((u) => u.id === 'berth')!.cost(step)
  }

  foundPrice(port: Port, industry: Works): Price {
    const berth = UPGRADES.find((u) => u.id === 'berth')!
    return {
      cash: Math.round((this.berthPrice(port.levels.berth) * WORKS[industry].price) / 10) * 10,
      permits: berth.permits!(port.levels.berth) + WORKS[industry].permits, crews: 1,
    }
  }

  canFound(port: Port, industry: Works): boolean {
    const short = this.lacks(this.foundPrice(port, industry), port)
    return port.levels.berth < BERTH_X.length - 1 && !short.cash && !short.permits && !short.crews
  }

  found(port: Port, industry: Works): boolean {
    if (port.levels.berth >= BERTH_X.length - 1) return false
    port.settle()
    if (!this.pay(this.foundPrice(port, industry), port)) return false
    port.found(industry)
    port.settle()
    if (this.god) port.conjure()
    else port.man('fitter')
    this.save()
    return true
  }

  convertPrice(port: Port, berth: number, industry: Industry): Price {
    const share = industry === 'boxes' ? 1 : WORKS[industry].price
    return { cash: Math.round((this.berthPrice(berth - 1) * share * CONVERT) / 10) * 10, permits: 0, crews: 0 }
  }

  convert(port: Port, berth: number, industry: Industry): boolean {
    if (port.convertBlocker(berth, industry) !== null || !this.pay(this.convertPrice(port, berth, industry), port)) return false
    port.convert(berth, industry)
    if (this.god) port.conjure()
    this.save()
    return true
  }

  // A name for the next ship off the slips, for a player who gives none.
  get nextName(): string {
    return SHIP_NAMES[this.hulls % SHIP_NAMES.length]
  }

  shipPrice(design: Design): Price {
    const hold = HOLDS[design.size]
    const cash = hold ? hold.price * ENGINES[design.engine].price * FITS[design.fit].price : 0
    return { cash: Math.round(cash / 10) * 10, permits: 0, crews: 0 }
  }

  // Seconds of one gang's work in a ship of this design.
  shipWork(design: Design): number {
    return Math.round((HOLDS[design.size]?.work ?? 0) * FITS[design.fit].price)
  }

  // Why a ship cannot be ordered at a yard, or null when she can.
  orderBlocker(port: Port, berth: number, design: Design): string | null {
    if (port.worksAt(berth) !== 'shipyard') return 'Needs a shipyard'
    if (port.keels[berth]) return 'One is on order here already'
    if (!HOLDS[design.size]) return 'Too big for the slip'
    if (port.levels.dredge < CLASSES[design.size].dredge) return 'Dredge first: she could not leave the port'
    return null
  }

  // Orders a ship of the player's own at a shipyard. She is paid for now and laid down when the slip is clear.
  order(port: Port, berth: number, design: Design): boolean {
    if (this.orderBlocker(port, berth, design) !== null || !this.pay(this.shipPrice(design), port)) return false
    const name = design.name.toUpperCase().replace(/[^A-Z0-9 '-]/g, '').trim().slice(0, 14) || this.nextName
    port.keels[berth] = { design: { ...design, name }, done: 0 }
    this.hulls++
    this.save()
    return true
  }

  // A ship comes off the slip and joins the fleet. Her first voyage is overseas and back to the port that built her.
  commission(port: Port, design: Design): Vessel {
    const vessel: Vessel = {
      ...design, name: design.name || SHIP_NAMES[this.launched % SHIP_NAMES.length],
      id: ++this.launched, home: port.def.id, away: null, at: port.def.id, due: 0,
      aboard: this.capacity(design), calling: false, voyages: 0, earned: 0,
    }
    vessel.due = this.time + this.seaTime(vessel)
    this.fleet.push(vessel)
    this.save()
    return vessel
  }

  capacity(vessel: Design): number {
    return Math.round((HOLDS[vessel.size]?.boxes ?? 0) * FITS[vessel.fit].boxes)
  }

  private portOf(id: string): Port {
    return this.ports.find((port) => port.def.id === id)!
  }

  // Seconds at sea each way on a ship's trade, at the standard speed.
  private leg(vessel: Vessel): number {
    return vessel.away === null ? OVERSEAS : passage(this.portOf(vessel.home).def, this.portOf(vessel.away).def)
  }

  // How long she is gone after leaving a port: to her other port, or overseas and back.
  seaTime(vessel: Vessel): number {
    return (this.leg(vessel) * (vessel.away === null ? 2 : 1)) / ENGINES[vessel.engine].pace
  }

  // What she earns for each box landed or taken on at a port.
  freight(vessel: Vessel, port: Port): number {
    const haul = HAUL.base + (HAUL.perLeg * this.leg(vessel)) / OVERSEAS
    return Math.round(port.def.contracts[0].fee * FREIGHT * FITS[vessel.fit].freight * haul)
  }

  // What it costs to send her to sea: crew for the days away, and fuel for the miles.
  voyageCost(vessel: Vessel): number {
    const engine = ENGINES[vessel.engine]
    const miles = (this.leg(vessel) * (vessel.away === null ? 2 : 1)) / (OVERSEAS * 2)
    return Math.round((HOLDS[vessel.size]?.running ?? 0) * miles * (CREW_SHARE / engine.pace + (1 - CREW_SHARE) * engine.fuel))
  }

  // Why a ship cannot trade between two places, or null when she can.
  tradeBlocker(vessel: Vessel, home: string, away: string | null): string | null {
    for (const id of [home, away]) {
      if (id === null) continue
      const port = this.ports.find((p) => p.def.id === id)
      if (!port?.owned) return 'Not a port of yours'
      if (port.levels.dredge < CLASSES[vessel.size].dredge) return `${port.def.name} is too shallow for her`
    }
    return home === away ? 'She needs somewhere to go' : null
  }

  // Puts a ship on another trade. At sea, she makes for whichever end of it is hers to make for.
  setTrade(id: number, home: string, away: string | null): boolean {
    const vessel = this.fleet.find((v) => v.id === id)
    if (!vessel || this.tradeBlocker(vessel, home, away) !== null) return false
    vessel.home = home
    vessel.away = away
    if (!vessel.calling && vessel.at !== home && vessel.at !== away) vessel.at = home
    this.save()
    return true
  }

  // Sells a ship that is at sea. Returns what she fetched, or null if she is in port.
  sell(id: number): number | null {
    const vessel = this.fleet.find((v) => v.id === id)
    if (!vessel || vessel.calling) return null
    const sum = Math.round((this.shipPrice(vessel).cash * RESALE) / 10) * 10
    this.fleet = this.fleet.filter((v) => v !== vessel)
    this.money += sum
    this.save()
    return sum
  }

  // What a shipyard lays down next.
  setProduct(port: Port, berth: number, product: number): void {
    port.products[berth] = product
    this.save()
  }

  // Asks for more or fewer of a line's ships.
  setSailings(port: Port, line: string, level: number): void {
    if (!SAILINGS[level]) return
    port.sailings[line] = level
    this.save()
  }

  // Payday: a minute's wages leave the purse. Returns the amount.
  payWages(port: Port): number {
    const amount = this.payroll(port)
    this.money -= amount
    port.stats.wages += amount
    return amount
  }

  earn(amount: number, port: Port): void {
    this.money += amount
    port.stats.earned += amount
  }

  // Keeps a line's ships for one berth, or with null lets them take any.
  setHome(port: Port, line: string, berth: number | null): void {
    if (berth === null) delete port.homes[line]
    else port.homes[line] = berth
    this.save()
  }

  // Gives one berth's cranes the first call on idle tractors, or with null shares them out evenly.
  setFirst(port: Port, berth: number | null): void {
    port.first = berth
    this.save()
  }

  get movePrice(): Price {
    return { cash: CRANE_MOVE, permits: 0, crews: 0 }
  }

  // Sends a crane from one berth to the next along the quay. Returns false when it cannot go or be paid for.
  moveCrane(port: Port, from: number, to: number): boolean {
    if (port.moveBlocker(from, to) !== null || !this.pay(this.movePrice, port)) return false
    port.cranes[from]--
    port.cranes[to]++
    this.save()
    return true
  }

  sign(port: Port, id: string): void {
    if (port.canSign(id)) port.contracts.push(id)
    this.save()
  }

  cancel(port: Port, id: string): void {
    port.contracts = port.contracts.filter((c) => c !== id)
    delete port.homes[id]
    delete port.sailings[id]
    this.save()
  }

  // Advances the clock. Returns true every ten seconds, when it is time to save.
  tick(dt: number): boolean {
    this.time += dt
    this.clock += dt
    if (this.clock < SAVE_EVERY) return false
    // What the ports clear after wages.
    const earned = this.ports.reduce((sum, port) => sum + port.stats.earned - port.stats.wages, 0)
    if (this.earnedMark !== null) this.rate = this.rate * 0.97 + ((earned - this.earnedMark) / this.clock) * 0.03
    this.earnedMark = earned
    this.clock = 0
    return true
  }

  save(): void {
    if (!this.persist) return
    const { money, permits, stamps, wageLevel, quiet, sound, wide, god, rate, active, hulls, launched, time } = this
    const ports = Object.fromEntries(this.ports.map((port) => [port.def.id, port]))
    // The clock starts again with each session, so a ship's arrival is kept as the time she still has to run.
    const fleet = this.fleet.map((vessel) => ({ ...vessel, due: Math.max(0, vessel.due - time) }))
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money, permits, stamps, wageLevel, quiet, sound, wide, god, rate, active, ports, fleet, hulls, launched, savedAt: Date.now(),
    }))
  }

  // The ports keep trading while the game is closed: half their recent pace, for up to eight hours.
  private absence(savedAt: number | undefined): void {
    if (!savedAt || this.rate <= 0) return
    const away = Math.min((Date.now() - savedAt) / 1000, AWAY_CAP)
    if (away < 120) return
    const sum = Math.round(this.rate * away * AWAY_SHARE)
    this.earn(sum, this.ports[0])
    const span = away >= 3600 ? `${Math.round(away / 360) / 10} h` : `${Math.round(away / 60)} min`
    this.awayNote = `While you were away for ${span} your ports earned $${sum.toLocaleString()}.`
  }

  static load(): Game {
    const game = new Game()
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      const old = localStorage.getItem(OLD_SAVE_KEY)
      if (raw || old) {
        const data = JSON.parse((raw ?? old)!)
        for (const key of ['money', 'permits', 'stamps', 'wageLevel', 'quiet', 'sound', 'wide', 'god', 'rate', 'hulls', 'launched'] as const) {
          if (data[key] !== undefined) (game[key] as unknown) = data[key]
        }
        // A ship that was in port when the game was closed comes in again with what she had aboard.
        game.fleet = ((data.fleet ?? []) as Vessel[]).map((vessel) => ({ ...vessel, calling: false }))
        // Wages were once a cut taken out of every box's fee.
        if (data.wage) game.wageLevel = 1 / data.wage
        // A save from before there were several ports holds the first port's state at the top level.
        if (raw) for (const port of game.ports) port.restore(data.ports?.[port.def.id] ?? {})
        else game.ports[0].restore(data)
        game.ports[0].owned = true
        game.active = game.ports[data.active]?.owned ? data.active : 0
        game.absence(data.savedAt)
      }
    } catch {
      localStorage.removeItem(SAVE_KEY)
    }
    return game
  }

  static reset(): void {
    localStorage.removeItem(SAVE_KEY)
    localStorage.removeItem(OLD_SAVE_KEY)
  }
}
