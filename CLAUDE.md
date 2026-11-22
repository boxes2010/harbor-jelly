# Harbor Jelly

Desktop idle game about managing a container port. It runs as a strip along the bottom of the screen, and the strip shows the live port. TypeScript, Three.js (WebGPU renderer), Vite, Electron.

- `npm start` builds and opens the strip window. `npm run dev` runs it in a browser.
- `npm test` runs the simulation without a window (`test/`): on-time service, no seizing up, box conservation,
  save and load, and a player who follows the port's advice for three hours. Run it after any change to `src/sim/`.
- `npm run dist` packages the desktop app into `release/` (unsigned; no app icon yet).
- `npm run shot` builds and saves a screenshot to `shot.png` after 7 seconds, using a throwaway save.
- Dev switches go in the URL query, or in `HARBOR_QUERY` for Electron (for example `HARBOR_QUERY="fresh=1&ff=600" npm run shot`):
  `fresh` ignores and never writes the save, `ff=<seconds>` fast-forwards and logs a `STATS` line, `speed=<n>`,
  `money=<n>`, `levels=max`, `events` (an event every 40 s), `panel=build|crew|ships|port`,
  `hover=<upgrade id>` (pins a build card and its blueprint), `press=<css selector>` (clicks it after 5 s;
  several selectors parted by `;` are clicked in turn, half a second apart),
  `demo` (replays the money effects on a loop), `ports=2` (own every port), `port=1` or `port=shanghai` (own
  that port and start on it), `typhoon=<seconds>` (brings the next typhoon that near),
  `wide` (start on the whole-port view), `x=<n>` (start the close view at that point along the quay),
  `fps` (log the work per frame), `permits=<n>`, `pick=<kind>:<n>` (opens a clicked thing's tray: `berth:0`,
  `site:1`, `block:9`, `plot:3`, `tractors`, `gate`, `channel`). `hover` also takes a place: `hover=crane@0`.
  `god` starts in god mode. `zoom=<n>` brings the close view n times nearer, for looking at models (use it with
  `HARBOR_HEIGHT=800`). `flat` draws without contact shading. `hour=<0 to 24>` and
  `weather=<clear|fair|overcast|rain|mist|storm>` hold the sky still. `homes=asiaeu@1,transpac@2` keeps those
  lines' ships for those berths, `first=1` gives a berth first call on tractors and `cranes=3,2,1` sets the
  cranes at each berth. `yards=shipyard,repair,navy` opens the next stretches of quay as those yards (not with
  `levels=max`, which opens them all as container berths) and `gangs=3` gives each that many gangs.
  `fleet=2` gives the port on screen that many ships of its own, due in from sea one after another.
- `HARBOR_SHOT_AT=<ms>` moves the screenshot time, `HARBOR_WIDTH=<px>` narrows the window, `HARBOR_HEIGHT=<px>`
  makes it taller.
- `HARBOR_POINT="x,y"` moves a real pointer there after 5 s, `HARBOR_CLICK="x,y"` clicks there and
  `HARBOR_DRAG="x1,y1,x2,y2"` drags, to test hover, buttons and panning through actual mouse events.
- Always pass `fresh=1` when testing, so the player's real save is untouched.

## Design rules

- What is on screen is the real simulation state: every box, ship, crane, tractor and truck. Never fake activity.
- The port is a chain: berth, quay cranes, yard, gate. Throughput is set by the slowest link, and the player's job is to find and fix it.
- The advice line must name the link that is really slow. A player who only follows it has to be able to grow
  the port; the four-hour test checks that.
- Three things pay for building (`Price` in `game.ts`). Cash buys everything. Permits, shared across ports, are
  earned as stamps from ships that leave on time and are needed for anything that changes the footprint: berths,
  dredging, the outer yard blocks, a new port. Someone to work it is needed for anything with people on it:
  quay cranes, tractors, yard blocks, gate lanes, yard gangs.
- Every machine is a post held by a named worker (`src/sim/crew.ts`, `Port.workers`). A worker has a skill of one
  to three stars in each trade, a grade the player raises once they have put in the time, and a pay level;
  `pace()` turns those into how fast their machine goes, and `wage()` into what they cost a minute. A machine with
  nobody on it finishes what it has in hand and takes no more. Someone new comes asking for work every few
  minutes (`Port.applicants`); buying a machine takes on the applicant best at its trade, so a player who never
  opens the Crew tab still grows, and one who does can hire for skill, promote, set pay and move people.
- Ordinary hands on fair pay are the baseline every other number is balanced for. Better crews are worth their
  pay only in a port asked for more ships than ordinary hands can turn round; a test holds that.
- Running a port costs money: everyone on the payroll is paid each minute (`WAGE`), working or not.
- Each line carries a cargo (`CARGO`): dry goods, chilled food that trucks collect within minutes, or machinery
  that cranes handle slowly. A port has more lines on offer than it has room for, on purpose: which to sign, and
  how often each sails (`Port.sailings`), is the player's choice. Ships off the timetable also ask to call
  (`Terminal.requests`); they wait a couple of minutes for an answer.
- A stretch of quay is a yard, and a yard does one thing at a time (`Port.yards`): it is a container berth, or
  one of the `WORKS` in `game.ts`: a shipyard, a repair dock, a naval base or a ferry terminal. The first berth
  is always a container berth. Other yards have gangs (`Port.gangs`, the `fitter` trade) instead of cranes, and
  their ships bring work (`Call.work`, seconds of one gang's labour) instead of boxes. They share the channel,
  the queue offshore, the tugs, the on-time bonus and the stamps with everything else. A yard can be turned over
  to another use when it is empty; what stood on it is sold with it.
- The ports after the first two are famous harbours (`PORTS` in `game.ts`): Rotterdam, Yokohama, Los Angeles and
  Shanghai. Any of them can be bought in any order, for cash and permits. Each is known by its skyline and by
  one rule of its own (`Rules`, on the port's definition), taken from the real place, which the simulation
  keeps and something in the world shows:
  Rotterdam has a tide (`Terminal.tide`, the water really rises and falls, a tide pole shows it) that holds
  ships needing all the channel's depth until high water, and one more step of dredging that frees them.
  Yokohama has ground for seven yard blocks (`Port.plots`; the city's warehouses and park stand on the rest) and
  fines a late ship half her bonus. Los Angeles pays its hands a third more, its imports wait longer for
  trucks, and in the rush hours of the game's day few trucks come. Shanghai is deep enough for any ship from
  the first day and is crossed by typhoons, signalled two minutes ahead on a mast on the quay.
  A rule has to bite and has to leave the player a way through: measure both before adding one (the deeper
  dredge is worth about a quarter more income at Rotterdam; Yokohama turns round five big lines, not six).
- The player can build ships of their own (`Design`, `Vessel`, `Game.fleet` in `game.ts`). One is drawn up and
  ordered at a shipyard (`Game.order`, `Port.keels`): a size the slip can take (`HOLDS`: Feeder or Panamax, not
  the biggest), an engine (`ENGINES`: speed at sea against fuel), what her holds are fitted for (`FITS`), a
  livery and a name. She is paid for at once, built on the slip by the yard's gangs in place of a customer's
  hull, and joins the fleet as she is launched. She then trades from a home port to a timetable of her own:
  overseas and back, or to another of the player's ports (`Game.setTrade`), where she lands what she really took
  on at the other end. She comes into the queue like any ship (`Call.own`), earns freight on every box landed
  or taken on (`Game.freight`: the port's price level, the length of the haul, the cargo) and no bonus, and
  each time she sails the voyage is paid for (`Game.voyageCost`: crew by the day, fuel by the mile).
- The fleet is balanced against the lines by measurement: at Jelly Sound with room at the berths, a Feeder of
  the player's own cleared about $9,000 an hour and a Panamax about $20,000, each repaying her price in 35 to
  50 minutes, and four Panamaxes brought in more than the port's first three lines. The biggest ships stay the
  lines'. A test holds that a Feeder repays her price within the hour and not three times over. Reefer and
  heavy-lift holds earn about the same a voyage in fewer boxes, so they pay only where berth time is short. A
  port with no room to spare is worse off for an extra ship: measure again before changing `FREIGHT`, `HOLDS`,
  `ENGINES` or `FITS`.
- Never let a rule lock the player in. Late ships earn no stamps, so the advice offers dropping a line, and the
  Ships tab says how busy the berths would get before a line is signed.
- God mode (`Game.god`, a switch in the Port tab) makes every price free: nothing is short and nothing is
  deducted, so real balances are untouched. Prerequisites still apply. Keep it working when adding a resource:
  `Game.lacks` and `Game.pay` are the only two places that need to know.
- Environmental limits (an emissions cap) are planned but not built.
- Building is done on the thing itself. Clicking something in the port (`Terminal.pick` finds it, `offersFor` in
  `ui.ts` says what belongs to it) opens a small tray with only that thing's options. The Build tab is the
  overview and lets the port choose the place.
- Places are real: a quay crane belongs to the berth it was bought for (`Port.cranes`), and yard blocks are
  opened one by one (`Port.blocks`). `Port.levels` keeps the totals; `Port.settle()` reconciles the two.
- Nothing is offered before it makes sense. `Port.needs(offer)` holds every prerequisite; add new ones there:
  berths open in order and come with their first crane, cranes go only to open berths and a third needs
  dredging, a yard block opens only beside one already open, three tractors to a crane, a gate lane to a block.
  The advice never recommends something that is still waiting on a prerequisite.
- The player arranges the port as well as building it, from a berth's own tray: which lines' ships are kept
  for it (`Port.homes`), whether its cranes get idle tractors first (`Port.first`), and sending one of its
  cranes along the rails to the berth next door (`Game.moveCrane`). A berth run this way flies a signal mast.
  Left alone, ships take the first free berth and cranes are spread evenly, which works but wastes the big lines.
- Every such lever has to be able to pay. Before adding one, measure it in a stretched mid-game port: keeping the
  two biggest lines at berths of their own, with three cranes and first call for the biggest, raised earnings
  by over half. Keeping yard blocks for
  imports or exports was tried the same way and only ever cost throughput, so it was taken out.
- The advice never depends on those levers: a player who ignores them must still be able to grow the port.
- Routine trouble only costs money and reliability. Only rare decisions with real stakes (`src/sim/events.ts`) interrupt the player, each with a deadline and a safe fallback.

## Layout

- `src/sim/` is the game: `terminal.ts` runs one port, `game.ts` holds the shared money and a `Port` for each terminal (levels, contracts, reliability, record) plus the save, `events.ts` the rare decisions, plus `ship.ts` (three size classes from `layout.ts`), `crane.ts` (quay cranes), `gantry.ts` (yard cranes, one lift at a time per block), `vehicles.ts`, `yard.ts`.
- A port is one long block (`BLOCK` in `src/kit.ts`) with four berths (`BERTH_X`) and twelve yard blocks, more than
  the strip shows at once. There are two views: close up, dragged along the quay, and the whole port. The build
  tray always shows the whole port. Sizes and counts come from those constants; do not hard-code positions.
- Every owned port is simulated all the time; `src/main.ts` keeps one `World` per port and shows one of them.
  `PORTS` in `game.ts` lists the ports, their lines, their rules and their scenery look (`harbor.ts`).
  The hour of the day is the simulation's (`src/sim/clock.ts`): trucks keep to it.
- Chance in the simulation comes only from `src/sim/random.ts`, never `Math.random`, so a seeded run repeats exactly.
- Traffic goes one way round: west along the yard road (`LANE_WEST`), east along the apron under the quay cranes
  (`LANE_EAST`), turning across at the crossings (`AISLES` in `yard.ts`). Nothing stops in those two lanes: a
  vehicle pulls off to its right into a bay beside the stacks (`BAY_Z`) or under a crane (`APRON_Z`), and idle
  tractors wait in spare quay bays. `vehicles.ts` holds the rules: follow at a gap, start a move across lanes only
  when all the ground it needs is clear, give way to anything waiting to pull out, and drive on to the next
  crossing rather than block a lane. Vehicles must never overlap; a test counts overlaps and `Vehicle.knots`.
- Every bay is promised to one vehicle at a time (`Terminal.claims`), so nothing is sent where it cannot pull in.
  The yard picks stacks by the real drive there and back (`tour`), which is not symmetrical on a one-way loop.
- One ship moves in the channel at a time. Tugs (`tug.ts`) lie at the east end of the quay and always work
  ahead of a ship: they wait at the berth for an arrival and push her in, and tow a departure out. A ship
  manoeuvres faster only while tugs are actually in place beside her.
- A ship's on-time bonus grows with how early she leaves (`PACE`) and with the run of ships on time
  (`Port.streak`): `Port.reward` works it out. `Port.last` keeps how each line's last ship did.
- A line with a berth of its own waits offshore for it (`Terminal.allot`), and trucks bring its share of the
  exports to the stacks behind that berth (`Terminal.staging`).
- Dredging is done by a dredger (`dredger.ts`) that steams the length of the channel once, with the channel shut
  to ships until it has gone.
- How the other yards work, all in `Terminal`: `jobs()` brings their ships (a shipyard lays its own keels, a
  repair dock is sent a ship when free, the navy and the ferry keep their own times), `labour()` is the gangs'
  work, and `allot()` sends a ship only to a yard that does her kind of work. A hull on the slip is shown as far
  as she is built by a clipping plane and is paid for at each quarter; a ship in the repair dock is lifted clear
  of the water first (`Ship.raise`); the navy also pays a retainer each minute while reliability holds.
- `src/models/` is what things look like, kept apart from how they behave: `ships.ts` (hull, house and gear for
  each design of each class), `cranes.ts` (quay crane generations, yard crane tiers, trolley and spreader),
  `vehicles.ts` (tractors, trucks, gate booth, docker, tug), `vessels.ts` (the craft that come to the other
  yards, and what stands on each of those yards), `town.ts` (the town for each look), `landmarks.ts` (what the
  famous harbours are known by), `signals.ts` (the storm mast and the tide pole), `smoke.ts`.
  Each builder makes its model once, runs it through `fuse()` in `src/kit.ts` and hands out clones, so detail
  costs a few draw calls. Anything that moves on its own (boom, trolley, radar, windmill sails) is a separate part.
- Sizes the simulation depends on are exported next to the model (`QUAY_CRANE`, `YARD_CRANE`, `bayXs`). A ship's
  bays are not evenly spaced in every design, so always ask `Ship.colX`.
- A model may show state but never invent it: the boom lifts when the berth is empty, the tier of a tractor or
  yard crane follows its speed level (`tierOf` in `terminal.ts`), a quay crane's switch houses follow the crane
  drives, tugs at the service quay are `levels.tug`.
- Boxes on a ship's deck and in the yard are instanced meshes, redrawn when the load changes.
- `src/sim/ghost.ts` draws blueprints: `Terminal.preview(id)` shows what an upgrade would build.
- `src/fx.ts` is money feedback (flying coins, floating amounts; a bonus of `WINDFALL` or more is written in
  gold, counted up and showered with coins), `src/icons.ts` the card pictures.
- The interface builds its markup once and then patches text and classes in place. Never rebuild a live button:
  a click is lost if its element is replaced between press and release.
- The tray is pictures first. A card is its picture, its name and its price; everything else it has to say is in
  a `data-tip` attribute (or `describe()` for an upgrade) and is shown in the line above the tray when the
  pointer is on it, or kept there by the card's info button. Put no running text in a tray.
- `src/harbor.ts` is the static ground, quay and terminal buildings (it calls `models/town.ts`), `src/ui.ts` and `src/ui.css` the HUD, drawer and event card, `src/sound.ts` the event chime and system notification.
- `src/sky.ts` is the backdrop and the light: the hour (a day is 24 minutes of game time), the weather over each
  port (`forecast`, which follows from the time alone and is only scenery), clouds, moon, stars, rain and mist.
  A storm is the one kind of weather the game itself causes. The moods of the day are `MOODS` in `src/style.ts`.
  `src/horizon.ts` holds the far land behind each famous harbour, as outlines the sky cuts from paper.

## Visual style (mandatory)

Read `STYLE.md` before adding or changing anything visible. In short:

- Colours come only from the tokens in `src/style.ts`. Never write a hex value elsewhere; add a named token if one is missing.
- Build geometry with the helpers in `src/kit.ts` (`rbox`, `chip`, `cyl`, `ball`, `bar`, `prism`, `hull`, `mat`), then `fuse()` the model. Everything has rounded or bevelled edges.
- Matte paint only: no textures, no metalness.
- Interface rules (typeface, plates, buttons, money, blueprint blue) are in the Interface section of `STYLE.md`.
- After a visual change, take a screenshot with `npm run shot` and check it against the style guide.
