import * as THREE from 'three/webgpu'
import { fog, instanceIndex, mix, positionWorld, screenUV, smoothstep, time, uniform, userData, varying } from 'three/tsl'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { HORIZONS } from './horizon'
import { BLOCK, QUAY_Z, nightfall, rand, smooth } from './kit'
import { hourAt } from './sim/clock'
import type { Look } from './sim/game'
import { C, LIGHT, MOODS } from './style'
import type { Water } from './water'

// Things with no body (the backdrop, rain) are drawn on this layer, which contact shading leaves out.
export const AIR = 1

// How long one kind of weather holds.
const SPELL = 300

export interface Weather {
  cover: number
  rain: number
  mist: number
  wind: number
  // How far the light is taken down: only a storm does it fully.
  gloom: number
}
export const WEATHERS = {
  clear: { cover: 0.1, rain: 0, mist: 0, wind: 0.3, gloom: 0 },
  fair: { cover: 0.45, rain: 0, mist: 0, wind: 0.5, gloom: 0 },
  overcast: { cover: 0.95, rain: 0, mist: 0.12, wind: 0.5, gloom: 0 },
  rain: { cover: 1, rain: 0.5, mist: 0.22, wind: 0.6, gloom: 0.15 },
  mist: { cover: 0.3, rain: 0, mist: 1, wind: 0.12, gloom: 0 },
  storm: { cover: 1, rain: 1, mist: 0.3, wind: 1.6, gloom: 1 },
} satisfies Record<string, Weather>
export type WeatherName = keyof typeof WEATHERS

// How often each kind of weather comes round. A storm is never drawn here: it is an event in the game.
const CLIMATE: Record<Look, [WeatherName, number][]> = {
  nordic: [['clear', 2], ['fair', 4], ['overcast', 2.5], ['rain', 2], ['mist', 1.5]],
  sunbelt: [['clear', 6], ['fair', 4], ['overcast', 1], ['rain', 0.6], ['mist', 0.6]],
  rotterdam: [['clear', 1.5], ['fair', 3.5], ['overcast', 3.5], ['rain', 2.5], ['mist', 1.5]],
  yokohama: [['clear', 3], ['fair', 4], ['overcast', 2], ['rain', 2], ['mist', 1.5]],
  losangeles: [['clear', 8], ['fair', 3], ['overcast', 0.6], ['rain', 0.2], ['mist', 1.2]],
  shanghai: [['clear', 2], ['fair', 3.5], ['overcast', 3], ['rain', 2.5], ['mist', 2]],
}

function chance(n: number): number {
  let t = (n + 0x6d2b79f5) | 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// The weather over a port. It follows from the time alone, so it needs no saving and every port has its own.
export function forecast(time: number, look: Look, seed: number): WeatherName {
  const spell = Math.floor(time / SPELL)
  // A new game opens on a fair morning.
  if (spell === 0) return 'fair'
  const odds = CLIMATE[look]
  let roll = chance(spell * 31 + seed * 977) * odds.reduce((sum, [, weight]) => sum + weight, 0)
  let name: WeatherName = 'fair'
  for (const [kind, weight] of odds) {
    roll -= weight
    if (roll < 0) {
      name = kind
      break
    }
  }
  // Mist belongs to the early morning.
  const hour = hourAt(spell * SPELL)
  return name === 'mist' && (hour < 3.5 || hour > 9) ? 'fair' : name
}

const TONES = ['top', 'horizon', 'floor', 'veil', 'cloud', 'sun', 'sky', 'bounce'] as const
type Tone = (typeof TONES)[number]
type Tones = Record<Tone, THREE.Color>
const tonesOf = (pick: (tone: Tone) => THREE.Color): Tones =>
  Object.fromEntries(TONES.map((tone) => [tone, pick(tone)])) as Tones
const moods = MOODS.map((mood) => ({ ...mood, tones: tonesOf((tone) => new THREE.Color(mood[tone])) }))

const RAIN = { drops: 520, top: 1.7, fall: 2.1 }
// Cloud belt and star field, in strip heights: wide enough for a very wide screen.
const BELT = 16
const CLOUDS = 18
const STARS = 170
const BACK = 150
// The height of the port the close view shows, which the horizon cut-outs are drawn against.
const CLOSE_VIEW = 1.95

// A cloud cut from paper: a flat-bottomed pill with a few bumps on top.
function puff(random: () => number): THREE.BufferGeometry {
  const w = 0.16 + random() * 0.2
  const h = 0.03 + random() * 0.012
  const parts: THREE.BufferGeometry[] = [new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0)]
  for (const end of [-w / 2, w / 2]) parts.push(new THREE.CircleGeometry(h / 2, 16).translate(end, h / 2, 0))
  const bumps = 2 + Math.floor(random() * 3)
  for (let i = 0; i < bumps; i++) {
    const r = h * (0.7 + random() * 0.5)
    const x = ((i + 0.5) / bumps - 0.5) * w * 0.8 + (random() - 0.5) * w * 0.1
    parts.push(new THREE.CircleGeometry(r, 24).translate(x, Math.max(r, h * 0.8), 0))
  }
  return mergeGeometries(parts)
}

interface Cloud {
  mesh: THREE.Mesh
  x: number
  speed: number
  // The cloud cover at which this one appears, and how strongly it stands out once it has.
  from: number
  weight: number
}

// The backdrop behind the diorama and the light that goes with it: the hour, the weather, the lamps.
export class Sky {
  readonly sun = new THREE.DirectionalLight(C.sun, LIGHT.sunIntensity)
  readonly fill = new THREE.HemisphereLight(C.sky, C.bounce, LIGHT.skyIntensity)
  readonly weather: Weather = { ...WEATHERS.fair }
  // 0 by day, 1 at night.
  night = 0

  private now = { tones: tonesOf(() => new THREE.Color()), sunIntensity: 0, skyIntensity: 0, night: 0 }
  private top = uniform(new THREE.Color(C.paper))
  private horizon = uniform(new THREE.Color(C.paper))
  private floor = uniform(new THREE.Color(C.paper))
  private cloudTone = uniform(new THREE.Color(C.white))
  private hazeTone = uniform(new THREE.Color(C.paper))
  private haze = uniform(0)
  private mist = uniform(0)
  private stars = uniform(0)
  private moonlight = uniform(0)
  private backdrop = new THREE.Group()
  private clouds: Cloud[] = []
  private starField: THREE.InstancedMesh
  private moon = new THREE.Group()
  // What stands on the horizon behind each famous harbour, and how plainly it shows through the weather.
  private horizons = new Map<Look, THREE.Group>()
  private farTone = uniform(new THREE.Color(C.navy))
  private nearTone = uniform(new THREE.Color(C.navy))
  private distance = uniform(1)
  private ink = new THREE.Color(C.navy)
  private rain: THREE.InstancedMesh
  private seeds = new Float32Array(RAIN.drops * 3)
  private streak = new THREE.Object3D()
  private centre = new THREE.Vector3((BLOCK.x0 + BLOCK.x1) / 2, 0, 0)
  private scratch = new THREE.Color()
  private storm = new THREE.Color(C.storm)
  private drift = 0
  private clock = 0
  private splashes = 0

  constructor(private scene: THREE.Scene, private camera: THREE.PerspectiveCamera) {
    const half = (BLOCK.x1 - BLOCK.x0) / 2
    const { sun } = this
    sun.target.position.copy(this.centre)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 8192)
    // The block's long side runs up the shadow map, so it is all covered wherever the sun stands.
    sun.shadow.camera.up.set(1, 0, 0)
    sun.shadow.camera.left = -2.4
    sun.shadow.camera.right = 2.4
    sun.shadow.camera.top = half + 1.5
    sun.shadow.camera.bottom = -half - 1.5
    sun.shadow.camera.near = 2
    sun.shadow.camera.far = 48
    sun.shadow.camera.updateProjectionMatrix()
    sun.shadow.radius = LIGHT.shadowRadius
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.01
    scene.add(this.fill, sun, sun.target)

    // The backdrop is one sweep of paper: sky at the top of the strip, and the sheet the block stands on below.
    const paper = mix(
      mix(this.top, this.horizon, smoothstep(0, 0.42, screenUV.y)), this.floor, smoothstep(0.42, 0.96, screenUV.y),
    )
    // Tone mapping takes a little off every colour, which muddies dark paper. Putting it back first
    // keeps the backdrop the colour its token says.
    const flat = (tone: THREE.Node<'vec3'>): THREE.Node<'vec3'> => tone.add(0.04)
    scene.backgroundNode = flat(paper)

    // A little haze towards the back ties the block to the sky; mist lies low and thickens it.
    const back = smoothstep(-1.1, 1.3, positionWorld.z.negate())
    const low = smoothstep(-1, -0.05, positionWorld.y.negate())
    scene.fogNode = fog(
      this.hazeTone,
      this.haze.mul(back).add(this.mist.mul(back.mul(0.22).add(0.12)).mul(low.mul(0.75).add(0.25))),
    )

    // Cut-outs pinned to the sweep. They are coloured as a blend with the paper behind them, so they
    // can come and go without being see-through.
    const cutout = (tone: THREE.Node<'color'>, level: THREE.Node<'float'>): THREE.MeshBasicNodeMaterial => {
      const material = new THREE.MeshBasicNodeMaterial()
      material.colorNode = flat(mix(paper, tone, level))
      material.fog = false
      return material
    }
    const pin = <T extends THREE.Mesh>(mesh: T, x: number, y: number, z: number): T => {
      mesh.position.set(x, y, z)
      mesh.frustumCulled = false
      mesh.layers.set(AIR)
      return mesh
    }

    const random = rand(41)
    const cloudPaper = cutout(this.cloudTone, userData('presence', 'float') as unknown as THREE.Node<'float'>)
    for (let i = 0; i < CLOUDS; i++) {
      // Nearer clouds are bigger, quicker and whiter.
      const near = 0.45 + random() * 0.55
      const mesh = pin(new THREE.Mesh(puff(random), cloudPaper), 0, 0.27 + random() * 0.17, -0.02 + near * 0.01 + i * 0.0002)
      mesh.scale.setScalar(0.55 + near * 0.55)
      mesh.userData.presence = 0
      this.clouds.push({
        mesh, x: ((i + random() * 0.7) / CLOUDS) * BELT, speed: 0.5 + near * 0.6,
        from: (((i * 7) % CLOUDS) / CLOUDS) * 0.88, weight: 0.55 + near * 0.45,
      })
      this.backdrop.add(mesh)
    }

    const twinkle = varying(time.mul(0.6).add(instanceIndex.toFloat().mul(2.4)).sin().mul(0.22).add(0.78))
    this.starField = pin(
      new THREE.InstancedMesh(new THREE.CircleGeometry(1, 8), cutout(uniform(new THREE.Color(C.star)), this.stars.mul(twinkle)), STARS),
      0, 0, -0.04,
    )
    const place = new THREE.Object3D()
    for (let i = 0; i < STARS; i++) {
      // More of them high up than near the horizon.
      place.position.set((random() - 0.5) * BELT, 0.5 - random() ** 1.6 * 0.38, 0)
      place.scale.setScalar(0.0028 + random() ** 3 * 0.0045)
      place.updateMatrix()
      this.starField.setMatrixAt(i, place.matrix)
    }
    this.backdrop.add(this.starField)

    const moonTone = uniform(new THREE.Color(C.moon))
    const disc = new THREE.CircleGeometry(1, 40)
    const face = cutout(moonTone, this.moonlight)
    const sea = cutout(moonTone, this.moonlight.mul(0.8))
    for (const [x, y, r, z, material] of [
      [0, 0, 0.075, -0.004, cutout(moonTone, this.moonlight.mul(0.07))],
      [0, 0, 0.04, -0.002, face],
      [-0.012, 0.008, 0.011, 0, sea], [0.012, -0.014, 0.007, 0, sea], [0.014, 0.014, 0.005, 0, sea],
    ] as const) {
      const part = pin(new THREE.Mesh(disc, material), x, y, z)
      part.scale.setScalar(r)
      this.moon.add(part)
    }
    this.backdrop.add(this.moon)

    // Distant land is three sheets of paper: far, near, and snow. It stands in front of the moon and
    // behind the clouds.
    const sheets = { far: cutout(this.farTone, this.distance), snow: cutout(this.cloudTone, this.distance), near: cutout(this.nearTone, this.distance) }
    for (const [look, make] of Object.entries(HORIZONS) as [Look, NonNullable<(typeof HORIZONS)[Look]>][]) {
      const parts = make()
      const group = new THREE.Group()
      ;(['far', 'snow', 'near'] as const).forEach((sheet, k) => {
        if (parts[sheet].length) group.add(pin(new THREE.Mesh(mergeGeometries(parts[sheet]), sheets[sheet]), 0, 0, -0.027 + k * 0.0006))
      })
      group.visible = false
      this.horizons.set(look, group)
      this.backdrop.add(group)
    }

    // One unit of the backdrop is the height of the strip.
    this.backdrop.position.z = -BACK
    this.backdrop.scale.setScalar(2 * BACK * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))
    camera.add(this.backdrop)
    camera.layers.enable(AIR)
    scene.add(camera)

    const drop = new THREE.PlaneGeometry(0.0034, 1).translate(0, 0.5, 0)
    this.rain = new THREE.InstancedMesh(
      drop, new THREE.MeshBasicMaterial({ color: C.rain, transparent: true, opacity: 0, depthWrite: false, fog: false }), RAIN.drops,
    )
    this.rain.frustumCulled = false
    this.rain.renderOrder = 2
    this.rain.layers.set(AIR)
    for (let i = 0; i < this.seeds.length; i++) this.seeds[i] = random()
    scene.add(this.rain)
  }

  // `jump` takes the weather over at once, for a change of port.
  // `view` is the stretch of quay on screen: where it is centred, how wide it is and how much height it shows.
  update(dt: number, hour: number, goal: Weather, view: { x: number; span: number; tall: number }, water: Water, look: Look, jump = false): void {
    const w = this.weather
    const ease = jump ? 1 : 1 - Math.exp(-dt / 18)
    for (const key of Object.keys(w) as (keyof Weather)[]) w[key] += (goal[key] - w[key]) * ease

    const next = moods.findIndex((mood) => mood.hour > hour)
    const a = moods[next - 1]
    const b = moods[next]
    const t = (hour - a.hour) / (b.hour - a.hour)
    const { now } = this
    for (const tone of TONES) now.tones[tone].lerpColors(a.tones[tone], b.tones[tone], t)
    now.sunIntensity = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t
    now.skyIntensity = a.skyIntensity + (b.skyIntensity - a.skyIntensity) * t
    now.night = a.night + (b.night - a.night) * t
    this.night = now.night

    // Cloud greys the paper, mist pales it, a storm darkens it.
    const { tones } = now
    const top = this.top.value.copy(tones.top).lerp(tones.veil, w.cover * 0.85)
    const horizon = this.horizon.value.copy(tones.horizon).lerp(tones.veil, w.cover * 0.6)
    const floor = this.floor.value.copy(tones.floor).lerp(tones.veil, w.cover * 0.2)
    const cloud = this.cloudTone.value.copy(tones.cloud).lerp(tones.veil, w.cover * 0.45)
    const pale = this.scratch.copy(horizon).lerp(cloud, 0.6)
    top.lerp(pale, w.mist * 0.7)
    horizon.lerp(pale, w.mist * 0.7)
    floor.lerp(pale, w.mist * 0.25)
    const dark = this.scratch.copy(this.storm).multiplyScalar(1 - 0.6 * now.night)
    top.lerp(dark, w.gloom * 0.6)
    horizon.lerp(dark, w.gloom * 0.45)
    floor.lerp(dark, w.gloom * 0.2)
    cloud.lerp(dark.multiplyScalar(0.82), w.gloom * 0.7)
    this.hazeTone.value.copy(horizon)
    // Far land takes the colour of the sky above it, a little deeper; nearer land deeper still.
    this.farTone.value.copy(top).lerp(this.ink, 0.22)
    this.nearTone.value.copy(top).lerp(this.ink, 0.4)
    this.distance.value = (1 - 0.8 * w.mist) * (1 - 0.35 * w.cover) * (1 - 0.4 * w.gloom)
    // The horizon is drawn for the close view and shrinks with the port when the whole of it is shown.
    const scale = Math.min(1.3, CLOSE_VIEW / view.tall)
    for (const [name, group] of this.horizons) {
      group.visible = name === look
      group.scale.setScalar(scale)
      group.position.x = (0.75 - view.x * 0.03) * scale
    }
    this.haze.value = 0.06 + 0.05 * w.cover
    this.mist.value = w.mist

    // Under cloud the sun is weaker and whiter, the shadows fade and more of the light comes from the sky.
    const veiled = Math.max(w.cover, w.mist)
    this.sun.color.copy(tones.sun).lerp(tones.sky, w.cover * 0.5)
    this.sun.intensity = now.sunIntensity * (1 - 0.55 * w.cover) * (1 - 0.45 * w.gloom) * (1 - 0.3 * w.mist)
    this.sun.shadow.intensity = 1 - 0.65 * veiled
    this.fill.color.copy(tones.sky)
    this.fill.groundColor.copy(tones.bounce)
    this.fill.intensity = now.skyIntensity * (1 + 0.22 * w.cover) * (1 - 0.3 * w.gloom)
    this.scene.environmentIntensity = LIGHT.environmentIntensity * (1 - 0.55 * now.night) * (1 - 0.25 * w.gloom)

    // The sun comes up over the town, passes behind the viewer and goes down over the sea. The moon is up
    // from nine in the evening until five and goes the same way round; they change places at twilight,
    // when neither throws any light.
    const offset = this.sun.position
    const up = (hour + 3) % 24
    if (up > 8) {
      const arc = ((hour - 5) / 16) * Math.PI
      offset.set(6.5 * Math.cos(arc), 3 + 6.5 * Math.sin(arc), 6)
    } else {
      offset.set(4 * Math.cos((up / 8) * Math.PI), 8, 6)
    }
    offset.setLength(24).add(this.centre)

    // Storm light brings the lamps on as night does.
    nightfall(Math.max(now.night, w.gloom * 0.6))

    this.drift += dt * w.wind * 0.012
    for (const c of this.clouds) {
      const x = (((c.x + this.drift * c.speed - view.x * 0.03) % BELT) + BELT) % BELT
      c.mesh.position.x = x - BELT / 2
      c.mesh.userData.presence = c.weight * smooth((w.cover - c.from) / 0.14) * (1 - 0.5 * w.mist)
      c.mesh.visible = c.mesh.userData.presence > 0.002
    }
    this.stars.value = smooth((now.night - 0.6) / 0.4) * (1 - w.cover) ** 1.5 * (1 - 0.8 * w.mist)
    this.starField.visible = this.stars.value > 0.002
    this.moonlight.value = up > 8 ? 0 : smooth(Math.min(up, 8 - up) / 0.7) * (1 - 0.85 * w.cover) * (1 - 0.5 * w.mist)
    this.moon.visible = this.moonlight.value > 0.002
    const passage = (up / 8) * Math.PI
    // It rides low, in the gap between the status chips and the stacks.
    this.moon.position.set(this.camera.aspect * 0.4 * Math.cos(passage), 0.285 + 0.03 * Math.sin(passage), -0.03)

    this.fall(dt, view, water)
  }

  private fall(dt: number, view: { x: number; span: number }, water: Water): void {
    const w = this.weather
    this.clock += dt
    const drops = Math.round(RAIN.drops * Math.min(1, w.rain))
    this.rain.count = drops
    this.rain.visible = drops > 0
    if (!drops) return
    ;(this.rain.material as THREE.MeshBasicMaterial).opacity = 0.34 * (1 - 0.45 * this.night)
    const width = view.span + 2
    const slant = 0.1 + 0.16 * w.wind
    const speed = RAIN.fall * (1 + 0.4 * w.gloom)
    const length = 0.07 + 0.05 * w.gloom
    const { streak, seeds } = this
    streak.rotation.z = Math.atan(slant)
    streak.scale.set(1, length, 1)
    for (let i = 0; i < drops; i++) {
      const fallen = (this.clock * speed * (0.8 + seeds[i * 3 + 2] * 0.4) + seeds[i * 3 + 1] * RAIN.top) % RAIN.top
      const x = seeds[i * 3] * width + fallen * slant
      streak.position.set(
        view.x - width / 2 + ((((x - view.x) % width) + width) % width),
        RAIN.top - fallen,
        BLOCK.z0 - 0.1 + ((seeds[i * 3 + 1] * 7.3 + seeds[i * 3 + 2]) % 1) * (BLOCK.z1 - BLOCK.z0 + 0.2),
      )
      streak.updateMatrix()
      this.rain.setMatrixAt(i, streak.matrix)
    }
    this.rain.instanceMatrix.needsUpdate = true

    // Every so often a drop rings the water.
    this.splashes += dt * w.rain * 30
    while (this.splashes >= 1) {
      this.splashes--
      water.disturb(view.x + (Math.random() - 0.5) * view.span, QUAY_Z + 0.08 + Math.random() * 0.95, -0.003, 0.04)
    }
  }
}
