import * as THREE from 'three/webgpu'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { ao } from 'three/addons/tsl/display/GTAONode.js'
import { builtinAOContext, mrt, normalView, pass, screenUV } from 'three/tsl'
import { Fx, WINDFALL } from './fx'
import { buildHarbor, type Harbor } from './harbor'
import { BLOCK, smooth } from './kit'
import { Life } from './life'
import { Events } from './sim/events'
import { Game, HULL_PAINTS, UPGRADES, type Port, type Works } from './sim/game'
import { Terminal, type Target } from './sim/terminal'
import { payout, windfall } from './sound'
import { hourAt } from './sim/clock'
import { Sky, WEATHERS, forecast, type WeatherName } from './sky'
import { LIGHT } from './style'
import { UI } from './ui'
import { Water } from './water'

const FRAME = 1 / 30
// Two views: close up, which is dragged along the quay, and the whole port. While the build tray is open
// the camera shows the whole port and lifts it clear of the tray.
const VIEW = { width: 13, margin: 0.4, lift: 0.17, height: 1.95, fov: 12, pitch: 0.42, y: 0.16, z: -0.08 }
const WEST = BLOCK.x0 - VIEW.margin
const FULL_WIDTH = BLOCK.x1 - BLOCK.x0 + VIEW.margin * 2
const WIPE_HALF = 300
const params = new URLSearchParams(location.search)
// ?zoom=<n> brings the close view n times nearer, for looking at models.
const zoom = Number(params.get('zoom') ?? 1)
VIEW.width /= zoom
VIEW.height /= zoom

const renderer = new THREE.WebGPURenderer({ antialias: true })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.toneMapping = THREE.NeutralToneMapping
document.body.prepend(renderer.domElement)
await renderer.init()

const scene = new THREE.Scene()
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture
scene.environmentIntensity = LIGHT.environmentIntensity

const camera = new THREE.PerspectiveCamera(VIEW.fov, 1, 1, 400)
// Where the close view looks, and how far the camera has eased towards the whole port and the lifted framing.
let viewX = 0
let far = 0
let lifted = 0
// What the close view really shows: a very wide window sees more than the nominal width.
const closeWidth = () => Math.max(VIEW.width, VIEW.height * camera.aspect)
function aim(): void {
  const w = window.innerWidth
  const h = window.innerHeight
  camera.aspect = w / h
  const half = closeWidth() / 2
  viewX = half * 2 >= FULL_WIDTH ? WEST + FULL_WIDTH / 2 : Math.min(WEST + FULL_WIDTH - half, Math.max(WEST + half, viewX))
  const ease = smooth(far)
  const width = VIEW.width + (FULL_WIDTH - VIEW.width) * ease
  const x = viewX + (WEST + FULL_WIDTH / 2 - viewX) * ease
  const distance = Math.max(width / camera.aspect, VIEW.height) / (2 * Math.tan(THREE.MathUtils.degToRad(VIEW.fov / 2)))
  camera.position.set(x, VIEW.y + Math.sin(VIEW.pitch) * distance, VIEW.z + Math.cos(VIEW.pitch) * distance)
  camera.lookAt(x, VIEW.y, VIEW.z)
  camera.setViewOffset(w, h, 0, h * VIEW.lift * smooth(lifted), w, h)
}
function resize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight)
  aim()
}
window.addEventListener('resize', resize)
resize()

const sky = new Sky(scene, camera)

// Dev switches: ?fresh ignores the save, ?money=N, ?events for frequent events, ?speed=N, ?ff=seconds,
// ?panel=build, ?levels=max, ?ports=2 owns every port, ?port=1 starts on the second one, ?wide shows the whole
// port, ?x=-6 starts the close view there.
const fresh = params.has('fresh')
const game = fresh ? new Game() : Game.load()
game.persist = !fresh
if (params.has('money')) game.money = Number(params.get('money'))
if (params.has('permits')) game.permits = Number(params.get('permits'))
if (params.has('god')) game.god = true
if (params.has('ports')) for (const port of game.ports) port.owned = true
// ?port takes a number or a port's id, and owns that port if need be.
const wanted = game.ports.findIndex((port, i) => params.get('port') === port.def.id || params.get('port') === String(i))
if (wanted >= 0) {
  game.ports[wanted].owned = true
  game.active = wanted
}
if (params.get('levels') === 'max') {
  for (const port of game.owned) {
    port.levels.berth = 1
    for (const u of UPGRADES) port.levels[u.id] = port.maxLevel(u.id)
    port.contracts = port.def.contracts.slice(0, 6).map((c) => c.id)
  }
}
// ?homes=asiaeu@1,transpac@2 keeps those lines' ships for those berths, ?first=1 gives a berth first call on tractors.
for (const pair of params.get('homes')?.split(',') ?? []) game.port.homes[pair.split('@')[0]] = Number(pair.split('@')[1])
if (params.has('first')) game.port.first = Number(params.get('first'))
// ?yards=shipyard,repair,navy opens the next stretches of quay as those yards; ?gangs=3 gives each that many gangs.
for (const works of params.get('yards')?.split(',') ?? []) if (game.port.levels.berth < 3) game.port.found(works as Works)
if (params.has('gangs')) game.port.gangs = game.port.gangs.map((n) => (n ? Number(params.get('gangs')) : 0))
// ?fleet=2 gives the port on screen that many ships of its own, due in from sea one after another.
for (let k = 0; k < Number(params.get('fleet') ?? 0); k++) {
  const size = game.port.levels.dredge && k % 2 ? 'panamax' : 'feeder'
  game.commission(game.port, { name: '', hull: HULL_PAINTS[k % HULL_PAINTS.length], size, engine: 1, fit: 'goods' }).due = 5 + k * 40
}
// ?cranes=3,2,1 stands that many quay cranes at each berth in turn.
if (params.has('cranes')) {
  const cranes = params.get('cranes')!.split(',').map(Number)
  game.port.cranes = game.port.cranes.map((_, berth) => cranes[berth] ?? 0)
  game.port.levels.crane = cranes.reduce((sum, n) => sum + n, 0) - 1
}
if (params.has('wide')) game.wide = true
if (params.has('x')) viewX = Number(params.get('x'))
aim()

const fx = new Fx(camera, document.getElementById('fx')!, () => document.querySelector<HTMLElement>('#cash .coin')!)

// Every port the player runs is a whole diorama of its own. All of them keep working; one is on screen.
interface World {
  port: Port
  root: THREE.Group
  water: Water
  harbor: Harbor
  terminal: Terminal
}
const worlds: World[] = []

function open(port: Port): World {
  const water = new Water()
  const harbor = buildHarbor(port.def)
  const terminal = new Terminal(game, port, water)
  const root = new THREE.Group()
  root.add(harbor.group, terminal.group, water.mesh, water.meniscus)
  const onScreen = () => fx.enabled && game.port === port
  terminal.onPay = (at, amount) => onScreen() && fx.earn(at, amount)
  terminal.onBuilt = (at) => onScreen() && fx.ring(at)
  terminal.onPayday = (at, amount) => onScreen() && fx.payday(at, amount)
  terminal.onVoyage = (at, cost) => onScreen() && fx.payday(at, cost, 'voyage')
  terminal.onDeparture = (at, bonus, onTime, permit, note) => {
    // A permit is news wherever it was earned; the rest is only shown for the port on screen.
    if (permit && fx.enabled) ui.granted()
    if (!onScreen()) return
    if (!onTime) return fx.late(at, Math.max(0, -bonus))
    // One of the player's own ships earns her freight box by box and no bonus on leaving.
    if (bonus > 0) fx.earn(at, bonus, note)
    fx.stamp(at, document.getElementById('permits')!, () => ui.stamped())
    if (game.sound && bonus > 0) (bonus >= WINDFALL ? windfall : payout)()
  }
  const world = { port, root, water, harbor, terminal }
  worlds.push(world)
  scene.add(root)
  return world
}
const worldOf = (port: Port) => worlds.find((world) => world.port === port)!
function show(): void {
  for (const world of worlds) world.root.visible = world.port === game.port
}

for (const port of game.owned) open(port)
show()
// ?typhoon=<seconds> brings the next typhoon at the port on screen that near, for looking at it.
if (params.has('typhoon')) worldOf(game.port).terminal.hasten(Number(params.get('typhoon')))
const life = new Life()
scene.add(life.group)
const events = new Events(game, () => worlds, params.has('events'))
if (game.awayNote) events.announce(game.awayNote)

let time = 0
let nextRipple = 0
// ?hour=<0 to 24> and ?weather=<clear|fair|overcast|rain|mist|storm> hold the sky still, for looking at it.
const fixedHour = params.has('hour') ? Number(params.get('hour')) % 24 : null
const fixedWeather = params.get('weather') as WeatherName | null
let skyOver: Port | null = null

function update(dt: number): void {
  time += dt
  const here = worldOf(game.port)
  // A storm is the game's doing. All other weather is only scenery, and each port has its own.
  // A typhoon on its way clouds over and brings rain ahead of it.
  const weather = here.terminal.storm ? 'storm' : here.terminal.signal !== null ? 'rain'
    : fixedWeather ?? forecast(game.time, here.port.def.look, game.ports.indexOf(here.port))
  const whole = smooth(far)
  sky.update(dt, fixedHour ?? hourAt(game.time), WEATHERS[weather], {
    x: viewX + (WEST + FULL_WIDTH / 2 - viewX) * whole,
    span: closeWidth() + (FULL_WIDTH - closeWidth()) * whole,
    tall: Math.max((VIEW.width + (FULL_WIDTH - VIEW.width) * whole) / camera.aspect, VIEW.height),
  }, here.water, here.port.def.look, skyOver !== here.port)
  skyOver = here.port
  const storm = sky.weather.gloom > 0.5
  if (time > nextRipple) {
    nextRipple = time + (storm ? 0.08 : 0.5 + Math.random() * 1.5)
    const size = storm ? 0.05 : 0.02
    const x = BLOCK.x0 + 0.5 + Math.random() * (BLOCK.x1 - BLOCK.x0 - 1)
    here.water.disturb(x, 0.1 + Math.random() * 0.95, (Math.random() - 0.5) * size, 0.2)
  }
  const saving = game.tick(dt)
  for (const world of worlds) world.terminal.update(dt)
  if (saving) {
    for (const world of worlds) world.terminal.snapshot()
    game.save()
  }
  events.update()
  here.water.update(dt)
  life.update(dt, sky.night)
  here.harbor.lamp.rotation.y += dt * 0.9
  for (const spinner of here.harbor.spinners) spinner.object.rotation.z += dt * spinner.speed
  for (const f of here.harbor.floaters) {
    const h = here.water.height(f.x, f.z)
    f.object.position.set(f.x, h, f.z)
    f.object.rotation.z = Math.atan2(here.water.height(f.x + f.span, f.z) - here.water.height(f.x - f.span, f.z), f.span * 2)
  }
}

// Dragging the world slides the close view along the quay. A press on the water also leaves a ripple.
const raycaster = new THREE.Raycaster()
const surface = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const hit = new THREE.Vector3()
function splash(e: PointerEvent): void {
  raycaster.setFromCamera(
    new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1),
    camera,
  )
  const { water } = worldOf(game.port)
  if (raycaster.ray.intersectPlane(surface, hit) && water.contains(hit.x, hit.z)) {
    water.disturb(hit.x, hit.z, -0.012, 0.12)
  }
}
const closeUp = () => !game.wide && !ui.managing
function pan(by: number): void {
  if (!closeUp()) return
  viewX += by
  aim()
}
const canvas = renderer.domElement
// The pointer's last position while it is held down on the world, and how far it has travelled since the press.
let held: number | null = null
let dragged = 0
canvas.addEventListener('pointerdown', (e) => {
  held = e.clientX
  dragged = 0
  canvas.setPointerCapture(e.pointerId)
  splash(e)
})
// Where the pointer is over the world. What lies under it is looked up once a frame, not on every mouse event.
let pointer: { x: number; y: number } | null = null
function under(x: number, y: number): Target | null {
  raycaster.setFromCamera(new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1), camera)
  return worldOf(game.port).terminal.pick(raycaster)
}
canvas.addEventListener('pointermove', (e) => {
  pointer = { x: e.clientX, y: e.clientY }
  if (held === null) return
  const moved = e.clientX - held
  held = e.clientX
  dragged += Math.abs(moved)
  if (closeUp()) pan((-moved * closeWidth()) / window.innerWidth)
  else splash(e)
})
canvas.addEventListener('pointerleave', () => {
  pointer = null
  ui.point(null, 0, 0)
})
for (const end of ['pointerup', 'pointercancel'] as const) canvas.addEventListener(end, () => (held = null))
// A plain click, not the end of a drag: on something in the port it opens that thing's options,
// on empty ground it puts every tray away.
canvas.addEventListener('click', (e) => {
  if (dragged >= 6) return
  const target = under(e.clientX, e.clientY)
  if (target) ui.pick(target, e.clientX)
  else ui.dismiss()
})
canvas.addEventListener('wheel', (e) => {
  const turn = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
  pan((turn * closeWidth()) / window.innerWidth)
}, { passive: true })
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return
  if (e.key === 'ArrowLeft') pan(-1.2)
  if (e.key === 'ArrowRight') pan(1.2)
})

// Contact shading: a first pass measures how hemmed in every surface is, and the picture proper lets
// less of the sky's light into the crevices. ?flat draws without it.
const pipeline = new THREE.RenderPipeline(renderer)
// The first pass looks through a camera of its own, which sees only solid things: the backdrop and the
// rain are on another layer. It cannot share the main camera, because it is drawn part-way through the
// picture proper and the two would then share one list of things to draw.
const solid = new THREE.PerspectiveCamera()
const depthPass = pass(scene, solid, { samples: 0 })
depthPass.setMRT(mrt({ output: normalView }))
const crevices = ao(depthPass.getTextureNode('depth'), depthPass.getTextureNode(), camera)
crevices.radius.value = LIGHT.contactRadius
crevices.scale.value = LIGHT.contactStrength
crevices.resolutionScale = 0.5
const scenePass = pass(scene, camera)
scenePass.contextNode = builtinAOContext(crevices.getTextureNode().sample(screenUV).r)
pipeline.outputNode = scenePass
const draw = params.has('flat') ? () => renderer.render(scene, camera) : () => {
  solid.copy(camera, false)
  solid.layers.set(0)
  pipeline.render()
}

const fastForward = Number(params.get('ff') ?? 0)
if (fastForward) {
  for (let i = 0; i < fastForward / FRAME; i++) update(FRAME)
  const { port, terminal } = worldOf(game.port)
  console.log('STATS ' + JSON.stringify({
    port: port.def.name, minutes: Math.round(game.time / 60), money: Math.round(game.money),
    reliability: Math.round(port.reliability), ...port.stats, yard: Math.round(terminal.yardFill * 100),
    waiting: terminal.waiting, hint: terminal.hint(), rate: Math.round(game.rate * 60),
    lost: Object.fromEntries(Object.entries(terminal.lost).map(([k, v]) => [k, Math.round(v)])),
  }))
}

// Changing port: a sheet of paper slides across, and the diorama underneath is swapped while it covers the view.
const wipe = document.getElementById('wipe')!
let travelling = false
function travel(index: number): void {
  if (index === game.active || travelling || !game.ports[index].owned) return
  travelling = true
  wipe.classList.remove('run')
  void wipe.offsetWidth
  wipe.classList.add('run')
  setTimeout(() => {
    game.active = index
    show()
    ui.portChanged()
    game.save()
    travelling = false
  }, WIPE_HALF)
}

const ui = new UI(game, events, fx, {
  terminal: (port) => worlds.find((world) => world.port === port)?.terminal ?? null,
  travel,
  opened: (port) => {
    open(port).root.visible = false
    travel(game.ports.indexOf(port))
  },
  // The stretch of the port in view, as fractions of its length.
  view: () => {
    const whole = far > 0.5
    const center = whole ? WEST + FULL_WIDTH / 2 : viewX
    const half = Math.min(FULL_WIDTH, whole ? FULL_WIDTH : closeWidth()) / 2
    return { from: (center - half - WEST) / FULL_WIDTH, to: (center + half - WEST) / FULL_WIDTH }
  },
  lookAt: (fraction) => {
    game.wide = false
    viewX = WEST + fraction * FULL_WIDTH
    aim()
  },
  zoom: () => {
    game.wide = !game.wide
    game.save()
  },
}, { open: params.get('panel'), hover: params.get('hover'), pick: params.get('pick'), alerts: !fresh })
fx.enabled = true

// ?demo replays the money effects on a loop, for looking at them.
if (params.has('demo')) {
  let turn = 0
  setInterval(() => {
    const size = turn++ % 3
    fx.earn(new THREE.Vector3(-1, 0.5, 0.3), [1200, 3600, 8640][size], ['On time', 'Fast ×1.5 · 3 in a row', 'Express ×2 · 5 in a row'][size])
    fx.earn(new THREE.Vector3(-1.4, 0.6, -0.26), 20)
    fx.late(new THREE.Vector3(-4.3, 0.5, 0.3))
    fx.stamp(new THREE.Vector3(-1, 0.5, 0.3), document.getElementById('permits')!, () => ui.stamped())
    fx.payday(new THREE.Vector3(3.4, 0.3, -0.84), 25)
    fx.ring(new THREE.Vector3(0.5, 0.5, -0.3))
    const button = document.querySelector('.buy')
    if (button) fx.spend(button.getBoundingClientRect(), 1760)
  }, 1300)
}

// ?press=<selector> clicks an element a few seconds in, to exercise a button without a mouse. Several
// selectors parted by semicolons are clicked one after another.
params.get('press')?.split(';').forEach((selector, turn) => {
  setTimeout(() => document.querySelector<HTMLElement>(selector)?.click(), 5200 + turn * 500)
})

// ?fps logs how long frames take, measured over a few seconds once things have settled.
if (params.has('fps')) {
  let frames = 0
  let busy = 0
  const begin = performance.now()
  const sample = (): void => {
    const t0 = performance.now()
    update(FRAME)
    draw()
    busy += performance.now() - t0
    frames++
    if (performance.now() - begin < 5000) return void setTimeout(sample, 0)
    console.log(`FPS work per frame ${(busy / frames).toFixed(1)} ms over ${frames} frames`)
  }
  setTimeout(sample, 500)
}

const speed = Number(params.get('speed') ?? 1)
let last = performance.now()
renderer.setAnimationLoop((now) => {
  const elapsed = (now - last) / 1000
  if (elapsed < FRAME - 0.002 || document.hidden) return
  last = now
  for (let i = 0; i < speed; i++) update(Math.min(elapsed, 0.05))
  ui.frame(elapsed)
  fx.locate(worldOf(game.port).terminal.previewSpot)
  if (pointer && held === null) {
    const target = under(pointer.x, pointer.y)
    ui.point(target, pointer.x, pointer.y)
    canvas.style.cursor = target ? 'pointer' : closeUp() ? 'grab' : 'default'
  }
  const farGoal = game.wide || ui.managing ? 1 : 0
  const liftGoal = ui.managing ? 1 : 0
  if (far !== farGoal || lifted !== liftGoal) {
    const step = elapsed / 0.5
    far = Math.min(1, Math.max(0, far + Math.sign(farGoal - far) * step))
    lifted = Math.min(1, Math.max(0, lifted + Math.sign(liftGoal - lifted) * step))
    aim()
  }
  draw()
})
