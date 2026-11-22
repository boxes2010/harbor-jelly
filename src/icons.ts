import type { Look, UpgradeId } from './sim/game'

// Small pictures of the port's machines, drawn in the same blocky shapes and colours as the world.
type Tone = string
const fill = (tone: Tone) => `fill="var(--c-${tone})"`
const rect = (x: number, y: number, w: number, h: number, r: number, tone: Tone, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${fill(tone)} ${extra}/>`
const edge = 'stroke="var(--c-inkSoft)" stroke-width=".8"'
const line = (d: string, tone: Tone, width: number) =>
  `<path d="${d}" fill="none" stroke="var(--c-${tone})" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
const svg = (body: string, size = 32) => `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true">${body}</svg>`

const faster = `<circle cx="25" cy="25" r="6.6" ${fill('ink')} stroke="var(--c-tile)" stroke-width="1.6"/>`
  + line('M21.7 22.2l2.8 2.8-2.8 2.8M25.7 22.2l2.8 2.8-2.8 2.8', 'signalYellow', 1.9)

const crane = rect(7, 9, 3, 19, 1, 'signalRed') + rect(18, 9, 3, 19, 1, 'signalRed')
  + rect(7, 17, 14, 2.6, 1, 'signalRed') + rect(2, 6.4, 28, 3.6, 1.6, 'signalRed')
  + rect(4, 2.4, 8, 4.6, 1.4, 'cream', edge) + rect(23.2, 10, 4.6, 2.2, 0.8, 'ink')
  + line('M25.5 12.2v5.6', 'ink', 1) + rect(22, 17.8, 7, 5, 1.2, 'signalBlue')

const tractor = rect(3, 10, 17, 8, 1.5, 'teal') + rect(2, 18, 20, 3, 1, 'iron')
  + rect(21.5, 11, 8, 10, 2.2, 'signalYellow') + rect(24.6, 13, 3.4, 3.4, 0.9, 'glass')
  + [7.5, 16.5, 25.5].map((x) => `<circle cx="${x}" cy="23.6" r="2.7" ${fill('rubber')}/>`).join('')

const gantry = rect(3.5, 7, 2.8, 21, 1, 'slate') + rect(25.7, 7, 2.8, 21, 1, 'slate')
  + rect(2, 4.6, 28, 3.6, 1.6, 'slate') + rect(12.5, 8.2, 7, 2.2, 0.8, 'ink')
  + line('M16 10.4v3', 'ink', 1) + rect(11.5, 13.2, 9, 1.8, 0.8, 'signalYellow')
  + rect(11.5, 15.2, 9, 5, 1.2, 'teal') + rect(9, 23, 6.6, 5, 1.2, 'orange') + rect(16.4, 23, 6.6, 5, 1.2, 'signalBlue')

// A gang: three hard hats and a spanner.
const spanner = line('M20.5 11.5l6.5 6.5', 'steel', 3) + `<circle cx="19.2" cy="10.2" r="3.4" ${fill('steel')}/>`
  + `<circle cx="18" cy="9" r="1.7" ${fill('tile')}/>` + `<circle cx="27.6" cy="18.6" r="2" ${fill('steel')}/>`
const helmet = (x: number, y: number, tone: Tone, band: Tone) =>
  `<path d="M${x} ${y}a6 6 0 0112 0z" ${fill(tone)}/>` + rect(x - 1.6, y - 0.4, 15.2, 2.8, 1.4, band)
const gang = helmet(3, 16, 'signalYellow', 'amber') + helmet(10, 24, 'signalYellow', 'amber') + spanner

export const ICONS: Record<UpgradeId, string> = {
  gang: svg(gang),
  berth: svg(
    `<path d="M2 16h25.5q2.8 0 2.2 2.6l-1.6 5.2q-.5 1.7-2.3 1.7H5.6q-1.7 0-2.2-1.6z" ${fill('navy')}/>`
    + `<path d="M3 22h25.3l-.6 1.8q-.5 1.7-2.3 1.7H5.6q-1.7 0-2.2-1.6z" ${fill('antifoul')}/>`
    + rect(4, 8.5, 6.5, 7.5, 1.3, 'white', edge)
    + rect(12, 11, 5.2, 5, 1, 'orange') + rect(17.7, 11, 5.2, 5, 1, 'teal') + rect(23.4, 11, 4.4, 5, 1, 'signalYellow')
    + rect(14.8, 5.6, 5.2, 5, 1, 'signalRed'),
  ),
  dredge: svg(
    line('M2 8.4q3.5-3 7 0t7 0 7 0 7 0', 'teal', 2.4)
    + `<path d="M2 30V15h8l3 10.5h6L22 15h8v15z" ${fill('stone')} stroke="var(--c-stone)" stroke-width="2" stroke-linejoin="round"/>`
    + line('M16 12.5v8M12.6 17.6l3.4 3.6 3.4-3.6', 'ink', 2.4),
  ),
  tug: svg(
    `<path d="M3 17h26l-2.4 7q-.5 1.6-2.2 1.6H7.6q-1.7 0-2.3-1.6z" ${fill('maroon')}/>`
    + rect(9, 10, 10, 7, 1.6, 'white', edge) + rect(11, 12, 3, 2.6, 0.7, 'glass') + rect(15, 12, 3, 2.6, 0.7, 'glass')
    + rect(20.5, 6.5, 4.2, 10.5, 1.2, 'signalYellow') + rect(20.5, 8.6, 4.2, 2, 0, 'ink'),
  ),
  crane: svg(crane),
  craneSpeed: svg(crane + faster),
  carrier: svg(tractor),
  carrierSpeed: svg(tractor + faster),
  yardBlock: svg(
    rect(2, 25, 28, 3, 1.4, 'asphalt')
    + rect(3, 18.5, 8, 6, 1.2, 'signalRed') + rect(12, 18.5, 8, 6, 1.2, 'signalBlue') + rect(21, 18.5, 8, 6, 1.2, 'amber')
    + rect(3, 11.5, 8, 6, 1.2, 'green') + rect(12, 11.5, 8, 6, 1.2, 'violet'),
  ),
  stackHeight: svg(
    rect(5, 22, 13, 6, 1.2, 'signalBlue') + rect(5, 15, 13, 6, 1.2, 'amber')
    + rect(5, 8, 13, 6, 1.2, 'blueprintFill', 'stroke="var(--c-blueprint)" stroke-width="1.4" stroke-dasharray="2.4 1.6"')
    + line('M25 26V10.5M20.6 14.6L25 9.8l4.4 4.8', 'ink', 2.6),
  ),
  yardCrane: svg(gantry + faster),
  gate: svg(
    rect(2, 26.5, 28, 2.5, 1.2, 'asphalt') + rect(3, 12.5, 10, 14, 1.6, 'cream', edge)
    + rect(2, 9, 12, 4, 1.4, 'signalRed') + rect(5.6, 15.5, 4.8, 4.4, 1, 'glass')
    + rect(13, 17, 17, 3, 1.5, 'white', edge) + rect(17, 17.4, 3, 2.2, 0, 'signalRed') + rect(23, 17.4, 3, 2.2, 0, 'signalRed'),
  ),
}

export const LOCK = svg(
  `<rect x="2" y="5.2" width="8" height="5.6" rx="1.4" fill="currentColor"/>`
  + `<path d="M4 5.2V3.8a2 2 0 014 0v1.4" fill="none" stroke="currentColor" stroke-width="1.5"/>`, 12)
export const CHECK = svg(
  `<path d="M2.2 6.4l2.6 2.6 5-5.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`, 12)
export const CLOSE = svg(
  `<path d="M3 3l6 6M9 3l-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`, 12)

const lens = `<circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.7"/>`
  + `<path d="M7.6 7.6l2.9 2.9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`
export const ZOOM_IN = svg(lens + `<path d="M3.5 5h3M5 3.5v3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`, 12)
export const ZOOM_OUT = svg(lens + `<path d="M3.5 5h3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`, 12)

// The two things besides cash that building can take: a council permit and a trained crew.
export const SEAL = svg(
  `<path d="M5 10.4L3.4 15.4l2.9-1.3 1.5 2.3 1.3-5z" ${fill('maroon')}/><path d="M11 10.4l1.6 5-2.9-1.3-1.5 2.3-1.3-5z" ${fill('maroon')}/>`
  + `<circle cx="8" cy="6.6" r="5.6" ${fill('signalRed')}/><circle cx="8" cy="6.6" r="3" fill="none" stroke="var(--c-tile)" stroke-width="1.3"/>`, 16)
export const HAT = svg(
  `<path d="M2.8 10.4a5.2 5.2 0 0110.4 0z" ${fill('signalYellow')}/>` + rect(6.9, 4.2, 2.2, 6.2, 1.1, 'amber')
  + rect(1.2, 10, 13.6, 2.6, 1.3, 'amber'), 16)
// A run of ships on time: the gold pennant a berth flies in the world.
export const PENNANT = svg(
  rect(3, 1.6, 1.8, 13, 0.9, 'ink')
  + `<path d="M5.6 2.6l8.6 3.3-8.6 3.3z" ${fill('signalYellow')} stroke="var(--c-coinEdge)" stroke-width="1" stroke-linejoin="round"/>`, 16)

// The trades, as the machine each one works.
export const TRADE_ICONS = { crane: svg(crane), tractor: svg(tractor), yard: svg(gantry), gate: ICONS.gate, fitter: ICONS.gang }

// What a stretch of quay can be given over to besides containers.
const sea = line('M2 27.4q3.5-2.4 7 0t7 0 7 0 7 0', 'teal', 2.2)
export const WORKS_ICONS = {
  // A hull on the slip under a gantry crane, half built.
  shipyard: svg(
    rect(4, 5, 2.6, 19, 1, 'signalYellow') + rect(25.4, 5, 2.6, 19, 1, 'signalYellow') + rect(2, 3, 28, 3.4, 1.6, 'signalYellow')
    + rect(14, 6.4, 4, 2, 0.8, 'ink') + line('M16 8.4v3.2', 'ink', 1)
    + `<path d="M7 16h11v7.4H9.4q-1.6 0-2-1.6z" ${fill('antifoul')}/>`
    + line('M18 16h5.5q1.6 0 1.2 1.6l-1 4.4q-.4 1.4-1.8 1.4H18', 'blueprint', 1.3)
    + rect(5, 24, 22, 2.4, 1, 'concrete', edge)),
  // A ship lifted clear of the water between two piers.
  repair: svg(
    rect(2, 9, 3.4, 16, 1, 'slate') + rect(26.6, 9, 3.4, 16, 1, 'slate') + rect(1.4, 6.6, 4.6, 3, 1, 'signalYellow') + rect(26, 6.6, 4.6, 3, 1, 'signalYellow')
    + `<path d="M7 11h18l-1.6 6q-.5 1.6-2.2 1.6H10.8q-1.7 0-2.2-1.6z" ${fill('tealDeep')}/>`
    + `<path d="M7.8 14.4h16.4l-.8 2.6q-.5 1.6-2.2 1.6H10.8q-1.7 0-2.2-1.6z" ${fill('antifoul')}/>`
    + rect(11, 7.4, 6, 3.6, 1, 'white', edge) + rect(5, 20, 22, 2.6, 1, 'steel') + sea),
  // A grey warship.
  navy: svg(
    `<path d="M1.5 17h29l-2.6 5.6q-.6 1.4-2.2 1.4H6.4q-1.6 0-2.4-1.4z" ${fill('slate')}/>`
    + rect(9, 12.4, 11, 4.6, 1, 'steel') + rect(12, 8.6, 5, 4, 1, 'steel') + rect(14, 3.4, 1.4, 5.4, 0.7, 'iron')
    + rect(11.6, 5, 6, 1.3, 0.6, 'iron') + rect(22, 14.6, 3.4, 2.4, 1, 'steel') + line('M24.6 15.4h4', 'iron', 1.3)
    + `<circle cx="14.7" cy="3" r="1.2" ${fill('signalRed')}/>` + sea),
  // A white ferry with a blue band on her funnel.
  ferry: svg(
    `<path d="M2 17.4h28l-1.8 5q-.6 1.6-2.3 1.6H6q-1.7 0-2.3-1.6z" ${fill('navy')}/>`
    + rect(4, 11.4, 22, 6, 1.4, 'white', edge) + rect(7, 7.4, 14, 4.2, 1.2, 'white', edge)
    + [6.4, 10.6, 14.8, 19, 23.2].map((x) => rect(x, 13.4, 2.6, 2, 0.6, 'glass')).join('')
    + rect(15.6, 3, 4, 4.6, 1, 'white', edge) + rect(15.6, 4.2, 4, 1.6, 0, 'signalBlue') + sea),
}

// What a ship carries: an ordinary box, a chilled one, and a piece of machinery on a flat.
export const CARGO_ICONS = {
  goods: svg(
    rect(2, 4, 12, 9, 1.6, 'orange') + line('M5 6v5M8 6v5M11 6v5', 'coinEdge', 0.9), 16),
  food: svg(
    rect(2, 4, 12, 9, 1.6, 'cream', edge) + line('M8 5.4v6.2M5.3 7l5.4 3M10.7 7l-5.4 3', 'teal', 1.3), 16),
  machines: svg(
    rect(1.5, 11.4, 13, 2.2, 1, 'iron')
    + `<circle cx="8" cy="7" r="3.6" ${fill('amber')}/><circle cx="8" cy="7" r="1.4" ${fill('tile')}/>`
    + line('M8 2.2v1.4M8 10.4v1M3.3 7h1.3M11.4 7h1.3M4.7 3.7l.9.9M10.4 9.4l.9.9M11.3 3.7l-.9.9M5.6 9.4l-.9.9', 'amber', 1.6), 16),
}

// A hard hat in the colour of a grade: yellow for a hand, orange for a skilled hand, blue for a leading
// hand and white for a foreman.
const HATS: [Tone, Tone][] = [['signalYellow', 'amber'], ['orange', 'coinEdge'], ['signalBlue', 'navy'], ['white', 'inkSoft']]
export const hat = (grade: number) => svg(
  `<path d="M2.8 10.4a5.2 5.2 0 0110.4 0z" ${fill(HATS[grade][0])} stroke="var(--c-${HATS[grade][1]})" stroke-width=".7"/>`
  + rect(6.9, 4.2, 2.2, 6.2, 1.1, HATS[grade][1]) + rect(1.2, 10, 13.6, 2.6, 1.3, HATS[grade][1]), 16)

export const INFO = svg(
  `<circle cx="6" cy="3" r="1.2" fill="currentColor"/>`
  + `<path d="M6 5.6v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`, 12)
export const UP = svg(
  `<path d="M6 9.6V2.8M2.9 5.6L6 2.4l3.1 3.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`, 12)
export const SWAP = svg(
  `<path d="M2 4.2h7.6M7.4 2l2.4 2.2-2.4 2.2M10 8h-7.6M4.6 5.8L2.2 8l2.4 2.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`, 12)
export const PLUS = svg(
  `<path d="M6 2.6v6.8M2.6 6h6.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`, 12)
export const MINUS = svg(
  `<path d="M2.6 6h6.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`, 12)
// A ship seen from the side, for counting sailings.
export const SHIP = svg(
  `<path d="M1 7h14l-1.6 4.2q-.4 1-1.5 1H4q-1.1 0-1.5-1z" fill="currentColor"/>`
  + `<rect x="3" y="3.4" width="3.4" height="3.6" rx=".8" fill="currentColor"/><rect x="7.4" y="4.6" width="5" height="2.4" rx=".6" fill="currentColor"/>`, 16)

// A harbour is known by its skyline: one small picture for each.
const land = (tone: Tone) => rect(1, 26, 30, 4, 1.5, tone)
const palm = (x: number, top: number) => line(`M${x} 27V${top}`, 'timber', 1.6)
  + `<path d="M${x} ${top}q-5-3.6-7.6-.4 4.4-.9 7.6.4zM${x} ${top}q5-3.6 7.6-.4-4.4-.9-7.6.4zM${x} ${top}q-1.8-5.4-6-4.8 3.8 1.5 6 4.8zM${x} ${top}q1.8-5.4 6-4.8-3.8 1.5-6 4.8z" ${fill('leaf')}/>`
export const PORT_ICONS: Record<Look, string> = {
  nordic: svg(
    land('grass') + rect(4.5, 15, 11, 11, 1, 'faluRed') + `<path d="M3.5 15.6l6.5-7.2 6.5 7.2z" ${fill('roofTile')}/>`
    + rect(8, 18.6, 4, 4, 0.6, 'white') + rect(21, 9, 5, 17, 1, 'white') + rect(21, 13, 5, 3, 0, 'signalRed')
    + rect(21, 20, 5, 3, 0, 'signalRed') + rect(20, 5.8, 7, 3.6, 1, 'iron') + `<circle cx="23.5" cy="7.6" r="1.3" ${fill('lampAmber')}/>`,
  ),
  sunbelt: svg(
    land('sand') + rect(3.5, 15, 13, 11, 1.2, 'white', edge) + `<path d="M6 15a4 4 0 018 0z" ${fill('signalBlue')}/>`
    + rect(8.2, 19.4, 3.6, 6.6, 0.6, 'signalBlue') + palm(23.5, 12),
  ),
  rotterdam: svg(
    land('grass') + rect(2, 24.6, 28, 1.6, 0.6, 'signalRed') + rect(2, 22.8, 28, 1.6, 0.6, 'signalYellow') + rect(2, 21, 28, 1.6, 0.6, 'violet')
    + `<path d="M12.4 21l2.2-11h2.8l2.2 11z" ${fill('brick')}/>` + `<path d="M13.4 10.4a2.6 2.6 0 015.2 0z" ${fill('timberDark')}/>`
    + line('M16 9.4L8 3.6M16 9.4l8-5.8M16 9.4l-5.6 8.2M16 9.4l5.6 8.2', 'timberDark', 1.5)
    + line('M9.6 4.8l3.6 2.6M22.4 4.8l-3.6 2.6M12 15.6l2.2-3.4M20 15.6l-2.2-3.4', 'cream', 2.6),
  ),
  yokohama: svg(
    `<path d="M1 27L12.4 8.4h7.2L31 27z" ${fill('mackerel')}/>`
    + `<path d="M12.4 8.4h7.2l2.4 3.9-2.3 1.2-1.9-1.7-1.7 1.9-1.8-1.9-2 1.7-2.3-1.2z" ${fill('white')}/>`
    + land('grass') + rect(9, 17.4, 2.2, 9.6, 0.5, 'signalRed') + rect(20.8, 17.4, 2.2, 9.6, 0.5, 'signalRed')
    + rect(6.4, 14.8, 19.2, 2.6, 1, 'signalRed') + rect(8.2, 19.4, 15.6, 1.7, 0.5, 'signalRed') + rect(5.6, 13.6, 20.8, 1.5, 0.7, 'rubber'),
  ),
  losangeles: svg(
    `<circle cx="22.5" cy="8.5" r="5" ${fill('signalYellow')}/>` + `<path d="M1 27q7-12.5 15-7.5 8-3.5 15 7.5z" ${fill('stone')}/>`
    + rect(5.5, 18.6, 11, 2.2, 0.5, 'white') + land('sand') + palm(24.5, 15),
  ),
  shanghai: svg(
    land('cobble') + rect(2.6, 12, 5.2, 14, 1, 'mackerel') + rect(24.4, 8, 5, 18, 1, 'herring')
    + line('M11 26.4l4-9M21 26.4l-4-9', 'concrete', 1.8) + `<path d="M14.9 26l.6-21h1l.6 21z" ${fill('concrete')}/>`
    + `<circle cx="16" cy="17" r="4.7" ${fill('berry')}/>` + `<circle cx="16" cy="8.8" r="3" ${fill('berry')}/>` + line('M16 5.6V1.8', 'steel', 1),
  ),
}
