# Harbor Jelly style guide

The look is a soft, toy-like diorama: a cut block of harbour sitting on warm paper, lit like a product photo.
Colour and shape values live in `src/style.ts`. This file explains the rules behind them.

## Principles

1. **Soft, never sharp.** Every solid has rounded or bevelled edges. No raw boxes, no hard 90° corners on props.
2. **Matte clay, not metal.** Surfaces are flat, rough paint. No textures, no noise, no metalness. Detail comes from shape and colour blocks.
3. **Candy on paper.** Saturated props sit on a warm paper background and warm neutrals, so the colourful things are the things that matter: containers, ships, cranes.
4. **A cut diorama.** The world is a block sliced flat at its sides. Cut faces show cross-sections (soil bands, the jelly sea).
5. **Readable at strip size.** The game runs in a strip about 280 px tall. Anything the player must read is at least ~12 px on screen; decoration can be smaller.

## Colour

- Use only named tokens from `C` in `src/style.ts`. Never write a hex value anywhere else. If a new colour is needed, add a named token first.
- The backdrop is one sweep of paper behind the block: by day it is `C.paper` with a pale wash of sky at the top
  of the strip. Its colours through the day are the `MOODS` in `src/style.ts`; the hours between are blended.
  Every mood is a soft, low-contrast pair of tints that sits behind the candy colours, never beside them:
  peach and periwinkle at dawn, apricot and lilac in the evening, dusty indigo at night. Night is never black.
- **Signal colours** (`signalRed`, `signalBlue`, `signalYellow`) are for machinery and things that move or matter: cranes, spreaders, quay markings, buoys.
- **Liveries** (`LIVERIES` in `src/kit.ts`) are the only container colours.
- **Neutrals** (`white`, `cream`, `concrete`, `stone`, `asphalt`, `iron`, `rubber`) carry the land and structures. Whites are warm, darks are blue-grey; never pure white or pure black on a solid.
- **Nordic house colours** (`faluRed`, `ochre`, `white`, `paleBlue`, `mint`, `pink`) with `roofTile`, `roofTerracotta` or `slate` roofs.
- Each port has its own surroundings (`LOOKS` in `src/harbor.ts`). The sunbelt look uses `white`, `cream`, `ochre`, `pink`
  and `clay` houses under `roofTerracotta` or `roofTile`, `sand` land, palms, and a `signalBlue` and `white` lighthouse.
  The terminal itself looks the same everywhere.
- Ship hulls are a deep colour above the waterline (`navy`, `tealDeep`, `maroon`, `iron`) and `antifoul` below,
  with a white boot-top between them, a `deck` red deck, and one accent colour on the funnel band and the stripe under the deck.
  Warships are the exception: `slate` hulls and `steel` upperworks, with no accent.
- A crane's colour says whose it is: `signalYellow` for a yard's own gear (the shipyard gantry, the winch houses
  of a slip or ship lift), the signal colours for quay cranes.
- Glowing things (`lampWarm`, `lampWhite`, `lampGreen`, `lampRed`, `lampAmber`) are small emissive spheres or
  cylinders (`bulb()`), never large surfaces. Red marks the top of something tall, amber something that moves.

## Shape

- Build boxes with `rbox()` from `src/kit.ts`. Corner radius defaults to `FORM.cornerRatio` (18%) of the smallest dimension.
  Details a few pixels across (windows, doors, stripes) are `chip()`: the same soft corners with far fewer faces.
- Struts and braces are `bar()`, gables and roofs `prism()`.
- Build round things with `cyl()` and `ball()` (at least `FORM.curveSegments` sides). Use smooth shading.
- Extruded shapes (hulls, roofs) always have a bevel with 3 segments.
- Rocks and stones are subdivided dodecahedra, squashed and randomly rotated.
- Only the big ground slabs (`slab()`) have sharp edges, because they are the cut faces of the block.
- Proportions are chunky and slightly exaggerated: thick crane legs, fat hulls, big lamps. Avoid thin wires except for cables.
- Scale reference: a container is 0.18 × 0.08 × 0.08 (`BOX`). Size everything else relative to it.

## Models

Models live in `src/models/`. A model is built from as many pieces as it needs and then passed through `fuse()`,
which bakes it into a few meshes; only parts that move on their own stay separate.

- **Detail has to mean something.** A window band is a deck, a funnel band is the line's colour, a red lamp is a
  high point. Do not add greebles.
- **Variety comes from real differences.** A ship's design follows from its name (`rigFor`): where the house
  stands, the funnel, the accent colour. A quay crane's generation follows from its berth. A yard crane and a
  tractor change model when their speed upgrade reaches a new tier. Trucks come in three makes.
- **State is shown by the model.** A quay crane lifts its boom while its berth is empty. A berthed ship is made
  fast with a head and a stern line. Funnels smoke only while a ship manoeuvres. One tug lies at the service
  quay for every tug the port owns. Better crane drives put a switch house, then two and an amber beacon, on a
  quay crane's portal beam. A berth with rules of its own flies a signal mast at its east end: a pennant in
  the hull colour of each line kept for it, and a gold burgee for first call on tractors. The dredger's hopper
  fills with sand as it works along the channel.
- **Keep the skyline low at the back.** The strip is short: anything taller than about 0.3 on the back row is
  hidden by the status chips. Tall landmarks go at the front (the lighthouse on the mole, the Oriental Pearl in
  the town hall's place). A tower on the terrace may lose its tip behind the chips, never the part it is known by.
- The town is a waterfront street round a market square, an upper row on a terrace, a jetty of small boats and a
  mole. Every look shares the layout; the palette, the roofs, the trees and the landmarks change.
- **A famous harbour is told by its skyline** (`src/models/landmarks.ts`): two or three things nobody could take
  for anywhere else, built as toys from the same blocks, and one of them moving if it can (the big wheel, the
  mills). Shanghai is stone banks under glass towers and the Pearl, with junks and red lanterns; Yokohama is
  tiled town houses, a shrine behind its gate, cherry trees and brick warehouses; Rotterdam is brick gables,
  mills on the dike and stripes of bulbs; Los Angeles is pastel blocks, palms, the sign on the hill and the old
  liner. Write no words on anything but that sign.
- **Far land is paper too** (`src/horizon.ts`): a mountain, a skyline or a bridge behind a famous harbour is a
  flat cut-out in two tones of the sky above it, with white only for snow. It fades in mist and under cloud.

## Material

- Roughness comes from `FINISH`: `matte` for most props, `ground` for land, `paint` for containers, `hull` for boats, `wet` for fish.
- Metalness is always 0.
- Many repeated objects use one instanced mesh with per-instance colour.
- The sea is the one glossy, see-through material: `waterSurface` tint, `waterBody` absorption, a thin white line on its cut edge. Keep it shallow and secondary to the land.

## Light and rendering

- One warm sun plus a soft sky and bounce fill, all taken from the mood of the hour. The sun comes up over the
  town, passes behind the viewer and goes down over the sea, so shadows swing through the day; at night the
  moon lights the port, cooler and dimmer but still easy to read.
- Weather is gentle and stays in the background: cut-paper clouds that drift along the top of the strip, a
  greyer sky and softer shadows under cloud, thin rain that rings the water, low mist that thins with height.
  Clouds, moon and stars are flat cut-outs pinned to the backdrop. Nothing flashes.
- At dusk the lamps come up and windows light in two lots (`pane()` in `src/kit.ts`); coloured signal lamps
  always burn. Gulls fly off for the night and the jellies glow brighter.
- Shadows are soft and filtered. No hard shadow edges.
- Contact shading darkens the crevices where surfaces meet (`LIGHT.contactRadius`, `LIGHT.contactStrength`).
  It only dims the sky's light, never the sun, so it stays soft. Keep it subtle: it should be missed when off,
  not noticed when on.
- Render at the screen's full device pixel ratio with 4x anti-aliasing.
- Neutral tone mapping, so the candy colours are not washed out.
- Camera: near-orthographic (12° field of view), looking from the front about 24° above horizontal. The close view shows about
  13 units of the quay and is the scale everything is designed for; the whole-port view is for finding your way.

## Lettering

- Text painted on objects (ship names): heavy sans-serif capitals with wide letter spacing, in `C.white`, on a flat side.
- Title wordmark: serif italic, with a small wide-spaced line above it. The serif is used nowhere else.

## Interface

The interface is part of the toy: enamel pieces and painted tokens, not app chrome. Light theme only.

- **Typeface.** M PLUS Rounded 1c (bundled). 500 for running text, 700 for captions, 800 for names and buttons,
  900 for numbers. Sentence case everywhere; capitals only on a ship's side plate.
- **Plates** (status chips, tray, cards, event card) are opaque `enamel` or `tile` with a 1.5 px ink outline at
  13% and a soft shadow, corners 10 to 16 px. No frosted glass.
- **Buttons are the only pieces with a lip**: a 3 px darker edge under the face, and they sink when pressed.
  Gold (`signalYellow` on `coinEdge`) spends money or commits. Red destroys. A flat grey well cannot be pressed yet.
- **Money** is always written `$1,234`, with the coin token beside it on the cash counter and on price buttons.
  A price the player cannot afford fills like a gauge as they save up.
- **Earning and spending are shown, not just counted.** The amount floats up where it was earned and coins fly to
  the cash counter, which rolls to the new balance. Spending sends coins from the counter to the button pressed.
- **A big bonus is celebrated.** From `WINDFALL` up the amount is written in gold with a dark gold outline, runs
  up from nothing, and sends a shower of fat coins to the counter, which swells as they land. Nothing else is
  ever written in gold.
- **Switches on a thing's tray** (`.pick`) are flat pills: tile when off, ink with white lettering when on. A
  line's pill carries a dot in its hull colour.
- **Permits and crews** each have one token, used wherever they appear: a red council seal and a yellow hard
  hat. On a price button they follow the cash; one the player lacks turns red. In the world a waiting crew is a
  docker in a hard hat outside the terminal office.
- **Chain colours.** Berth `signalBlue`, Cranes `signalRed`, Yard `amber`, Gate `green`: on section spines, level
  pips and the tag in the advice line.
- **The advice lamp** says how things are, never which link: green for fine, amber for room to improve, red for
  trouble. The link is named by its coloured tag beside the lamp.
- **Blueprint blue** (`blueprint` outline, `blueprintFill` body) means "not built yet": the outline of the card
  under the pointer and the same thing drawn in the world. Use it for nothing else.
- **Icons** are small pictures built from the same blocks and colour tokens as the world. No line icons.
- **The picture is the card.** A card shows what it is as a picture about 50 px across, its name in one line and
  its price as the button. Its level runs up the left edge as pips, and what it takes besides cash sits on the
  picture as tokens. No sentence is ever printed on a card: what it does is said in the line above the tray
  while the pointer is on it, and the small round info button pins that line for someone who is not hovering.
- **People are hard hats.** A worker is a hat in the colour of their grade (yellow hand, orange skilled hand,
  blue leading hand, white foreman) over three pips for their skill at the post they hold. A dashed tile is
  someone asking for work or a post with nobody on it; a gold arrow means ready for promotion.
- **A ship is her side plate**, as long as her class, with what she carries as a small picture beside it.
- **Motion** only answers an action or a real event (a payment, a ship leaving, a purchase). The one standing
  exception is the pulsing spine of the slowest link.
- **Pointing at the world.** Whatever can be clicked shows its name beside the pointer and gets the blueprint
  outline (a machine) or a blueprint pad on the ground (a place not built yet). Its tray opens under the click
  and holds only its own cards; a card that is waiting on something else says what, in red, with a "Not yet" button.
- While the tray is open the camera pulls back to the whole block, so the tray never hides what is being built.
- Changing port is a sheet of paper sliding across the view; the diorama is swapped while it is covered.

## Prompt for generating new content in this style

Paste this before describing a new object or scene:

> Match the Harbor Jelly style. Soft toy-like diorama on a warm paper background. Every solid has rounded or bevelled
> edges and smooth shading; no sharp corners, no textures, no metal. Flat matte paint in saturated candy colours for
> the important objects, warm neutrals for land and structures, warm whites and blue-grey darks instead of pure white
> or black. Chunky, slightly exaggerated proportions. One warm sun from the upper front-left with soft filtered
> shadows. Build it in TypeScript with Three.js using the helpers in `src/kit.ts` (`rbox`, `cyl`, `ball`, `hull`,
> `mat`) and only the colour tokens in `src/style.ts`. Size it relative to a container of 0.18 × 0.08 × 0.08.
