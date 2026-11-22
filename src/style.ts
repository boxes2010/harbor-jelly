// Single source of truth for the game's look. Rules and rationale: STYLE.md

export const C = {
  paper: '#efe6d6',
  ink: '#3b3229',
  inkSoft: '#8c7f70',

  white: '#f6f3ea',
  cream: '#eee8dc',
  rope: '#d9d4c8',
  steel: '#8d9199',
  slate: '#5b5f6b',
  asphalt: '#5d5f66',
  iron: '#3b3f46',
  rubber: '#26272b',
  glass: '#55697a',

  signalRed: '#c8473b',
  signalBlue: '#2f6f9f',
  signalYellow: '#f2c230',
  navy: '#27405e',
  antifoul: '#b8443a',
  tealDeep: '#2f7f78',
  maroon: '#8a3b4a',

  amber: '#e0a030',
  green: '#3d8f6b',
  violet: '#7a4f9a',
  orange: '#d9713a',
  teal: '#5fb0b7',
  berry: '#b03a5b',

  concrete: '#c9c4ba',
  stone: '#b4a692',
  rock: '#b9b0a2',
  sand: '#ecdcb4',
  clay: '#f0a48f',
  timber: '#7a5a44',
  timberDark: '#5d4037',
  brick: '#8a6a5a',
  cobble: '#d3c7b1',
  deck: '#93574b',

  grass: '#9cc27a',
  leaf: '#6fae6a',
  leafLight: '#7fbd76',
  weed: '#4f9a6a',
  moss: '#5f7f5a',
  mussel: '#3e4a44',
  copper: '#6fae96',
  buoyGreen: '#3d9f6b',

  faluRed: '#b5442f',
  ochre: '#d9a441',
  paleBlue: '#a9c7dc',
  mint: '#b7dcc6',
  pink: '#e9b7b9',
  roofTile: '#8a4a3a',
  roofTerracotta: '#9c5a42',

  mackerel: '#6f8fa8',
  herring: '#a9b8c4',
  wrasse: '#f08a3c',
  coral: '#e96a8a',
  jellyBell: '#f7dbe6',
  jellyGlow: '#f2a9c4',
  gullGrey: '#c9ced6',

  waterSurface: '#d8f7ee',
  waterBody: '#58cdbd',

  enamel: '#fbf5e8',
  enamelEdge: '#dccdb2',
  tile: '#fffdf8',
  coinEdge: '#c58a1e',
  blueprint: '#2f9be6',
  blueprintFill: '#d3eafb',

  lampWarm: '#fff2c4',
  lampWhite: '#ffffff',
  lampGreen: '#c8ffd8',
  lampRed: '#ff8a70',
  lampAmber: '#ffc04a',
  windowGlow: '#ffd27a',
  sun: '#fff1dc',
  sky: '#fff6e6',
  bounce: '#cdb9a0',

  moon: '#f6efd9',
  star: '#fff2c4',
  rain: '#eef4f6',
  storm: '#6f7688',
} as const

// The backdrop and the light at one moment of the day; the hours between are blended. Rules: STYLE.md
export interface Mood {
  hour: number
  // The backdrop: the top of the strip, behind the port, and the paper the block stands on.
  top: string
  horizon: string
  floor: string
  // What the backdrop turns to under full cloud.
  veil: string
  cloud: string
  sun: string
  sunIntensity: number
  sky: string
  bounce: string
  skyIntensity: number
  // 0 by day, 1 at night: lamps, lit windows, stars.
  night: number
}

const NIGHT = {
  top: '#3a4467', horizon: '#56618a', floor: '#465075', veil: '#4a5068', cloud: '#6b779e',
  sun: '#b4c4ee', sunIntensity: 1.1, sky: '#8494c8', bounce: '#3d4666', skyIntensity: 0.8, night: 1,
}
// The sun is just under the horizon: no direct light, so its direction can change hands with the moon's.
const TWILIGHT = {
  top: '#565f8c', horizon: '#b3909f', floor: '#7c7b9c', veil: '#787b92', cloud: '#a898b4',
  sun: '#ffc9a8', sunIntensity: 0, sky: '#a9a8d2', bounce: '#665f7c', skyIntensity: 0.85, night: 0.8,
}
export const MOODS: Mood[] = [
  { hour: 0, ...NIGHT },
  { hour: 4.4, ...NIGHT },
  { hour: 5, ...TWILIGHT },
  {
    hour: 6.25, top: '#bcc6e2', horizon: '#f6cfc0', floor: '#efdbd0', veil: '#d6d2d6', cloud: '#fde6dc',
    sun: '#ffd0a8', sunIntensity: 1.5, sky: '#f0e2ee', bounce: '#c8a79c', skyIntensity: 0.9, night: 0.2,
  },
  {
    hour: 8, top: '#cfe4ea', horizon: '#f3ecdc', floor: '#efe6d6', veil: '#dfe0da', cloud: '#fdfaf2',
    sun: '#fff0d6', sunIntensity: 2.5, sky: '#fbf6ea', bounce: '#cdb9a0', skyIntensity: 0.9, night: 0,
  },
  {
    hour: 12.5, top: '#d2e6ec', horizon: '#f1ecdd', floor: '#efe6d6', veil: '#dfe0da', cloud: '#fefcf6',
    sun: '#fff5e6', sunIntensity: 2.7, sky: '#fff6e6', bounce: '#cdb9a0', skyIntensity: 0.9, night: 0,
  },
  {
    hour: 16.5, top: '#dbe6e2', horizon: '#f3e9d6', floor: '#efe6d6', veil: '#dfdfd8', cloud: '#fdf9ef',
    sun: '#fff1dc', sunIntensity: 2.6, sky: '#fff6e6', bounce: '#cdb9a0', skyIntensity: 0.9, night: 0,
  },
  {
    hour: 18.75, top: '#d3cfe2', horizon: '#f8d4a6', floor: '#f1ddc2', veil: '#ddd0c8', cloud: '#fde0c4',
    sun: '#ffc488', sunIntensity: 2.1, sky: '#ffe6d2', bounce: '#d1a98c', skyIntensity: 0.85, night: 0,
  },
  {
    hour: 20, top: '#7e86b4', horizon: '#eaa79e', floor: '#b3a4ba', veil: '#9c94aa', cloud: '#d7a0ae',
    sun: '#ff9a78', sunIntensity: 0.5, sky: '#c2b8dc', bounce: '#8c7890', skyIntensity: 0.85, night: 0.6,
  },
  { hour: 21, ...TWILIGHT },
  { hour: 21.75, ...NIGHT },
  { hour: 24, ...NIGHT },
]

export const FORM = {
  cornerRatio: 0.18,
  cornerSegments: 3,
  curveSegments: 20,
}

export const FINISH = {
  matte: 0.8,
  ground: 0.95,
  paint: 0.7,
  hull: 0.6,
  wet: 0.4,
}

export const LIGHT = {
  sunIntensity: 2.6,
  skyIntensity: 0.9,
  environmentIntensity: 0.55,
  shadowRadius: 4,
  contactRadius: 0.12,
  contactStrength: 1.7,
}
