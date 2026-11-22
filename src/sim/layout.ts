import { BLOCK, BOX, QUAY_TOP } from '../kit'

// Berths in the order they open, from the town end westwards.
export const BERTH_X = [-1.0, -4.3, -7.6, -10.9]
export const LANE_Z = 0.79
// Ships come in from the west and leave to the east, out of sight past the ends of the block.
export const OFF_WEST = BLOCK.x0 - 1.6
export const OFF_EAST = BLOCK.x1 + 1.6

export type ClassId = 'feeder' | 'panamax' | 'neo'
export interface ShipClass {
  id: ClassId
  name: string
  length: number
  beam: number
  draft: number
  bays: number
  rows: number
  tiers: number
  dredge: number
}
// dredge: channel depth level a ship of this class needs before it can call.
export const CLASSES: Record<ClassId, ShipClass> = {
  feeder: { id: 'feeder', name: 'Feeder', length: 2.0, beam: 0.32, draft: 0.1, bays: 5, rows: 3, tiers: 2, dredge: 0 },
  panamax: { id: 'panamax', name: 'Panamax', length: 2.6, beam: 0.4, draft: 0.12, bays: 8, rows: 4, tiers: 3, dredge: 1 },
  neo: { id: 'neo', name: 'Neo-Panamax', length: 3.0, beam: 0.49, draft: 0.15, bays: 10, rows: 5, tiers: 4, dredge: 2 },
}
export const FREEBOARD = 0.2
export const DECK = 0.224
export const BAY_PITCH = 0.19
export const ROW_PITCH = 0.09

// Mooring bollards stand along the whole quay edge; a berthed ship makes fast to the nearest ones.
export const BOLLARDS = { x0: BLOCK.x0 + 0.5, pitch: 0.6, z: -0.03 }
export const bollardNear = (x: number) => BOLLARDS.x0 + Math.round((x - BOLLARDS.x0) / BOLLARDS.pitch) * BOLLARDS.pitch

// Traffic keeps to the right and goes round one way: west along the yard road, east along the apron under
// the quay cranes. Nothing stops in those two lanes. A vehicle pulls off to its right to be served: into a
// bay beside the stacks, or under a quay crane. Idle tractors wait in quay bays no crane is using.
export const BAY_Z = -0.63
export const LANE_WEST = -0.535
export const LANE_EAST = -0.375
export const APRON_Z = -0.26
export const TOWN_IN_Z = -0.352
export const TOWN_OUT_Z = -0.255
export const GATE_X = 4.15
export const GATE_STOP_X = 3.74
export const TRUCK_SPAWN_X = 9.3
// Where trucks leave the apron lane for the gate, and where they are on the town road again.
export const GATE_OUT = { from: 3.6, to: 4.45 }
// Tugs lie at the east end of the quay, past the last berth, and tow from ahead.
export const TUG_QUAY = { x: 1.45, z: 0.14, pitch: 0.5 }

export const GROUND_Y = QUAY_TOP + 0.006
export const DECK_LOCAL_Y = 0.04 + BOX.h / 2
export const VEHICLE_BOX_Y = GROUND_Y + DECK_LOCAL_Y
