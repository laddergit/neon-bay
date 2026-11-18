// Neon Bay — the city itself: a road grid, blocks of buildings, parks, a
// beach and a dockyard, all laid out from a seed. It also answers the
// spatial questions the rest of the game asks: what is solid, what blocks
// a line of sight, and where the road network runs.

import { WORLD, ROADS_V, ROADS_H, ROAD_W, BEACH_Y, SEA_Y, PALETTE } from './config.js';

const HALF = ROAD_W / 2;
const MARGIN = 14; // gap between a road's edge and the block's contents

function blockRanges(roads, size) {
  const ranges = [];
  for (let i = 0; i <= roads.length; i++) {
    const lo = i === 0 ? 0 : roads[i - 1] + HALF + MARGIN;
    const hi = i === roads.length ? size : roads[i] - HALF - MARGIN;
    if (hi - lo > 60) ranges.push([lo, hi]);
  }
  return ranges;
}

export function buildWorld(rng) {
  const buildings = [];
  const parks = [];
  const lots = [];
  const colRanges = blockRanges(ROADS_V, WORLD.w);
  const rowRanges = blockRanges(ROADS_H, BEACH_Y); // blocks stop at the beach
  let fixedPark = null; // Marina Park, the gang-war park: missions point here

  // Fixed landmarks, by block position. The park is where the gang war
  // happens, the dockyard is where stolen cars get delivered, and the
  // safehouse is where getaways end.
  const parkBlock = { col: 2, row: 2 };
  const dockBlock = { col: 4, row: 0 };
  const safeBlock = { col: 0, row: 3 };

  for (let row = 0; row < rowRanges.length; row++) {
    for (let col = 0; col < colRanges.length; col++) {
      const [x0, x1] = colRanges[col];
      const [y0, y1] = rowRanges[row];
      const w = x1 - x0;
      const h = y1 - y0;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;

      if (col === parkBlock.col && row === parkBlock.row) {
        fixedPark = { x: x0, y: y0, w, h, cx, cy };
        parks.push(fixedPark);
        continue;
      }
      if (col === dockBlock.col && row === dockBlock.row) {
        const containers = [];
        for (let i = 0; i < 6; i++) {
          containers.push({
            x: x0 + 20 + (i % 3) * 150,
            y: y0 + 30 + Math.floor(i / 3) * 110,
            w: 120,
            h: 80,
            color: rng.pick(PALETTE.building),
          });
        }
        lots.push({ x: x0, y: y0, w, h, kind: 'dock', containers });
        continue;
      }
      if (col === safeBlock.col && row === safeBlock.row) {
        buildings.push({ x: cx - 90, y: cy - 70, w: 180, h: 140, color: '#e8d27a', safehouse: true });
        continue;
      }

      const roll = rng.next();
      if (roll < 0.14) {
        parks.push({ x: x0, y: y0, w, h, cx, cy });
      } else if (roll < 0.3) {
        lots.push({ x: x0, y: y0, w, h, kind: 'lot' });
      } else {
        // Split the block into one or two buildings.
        const vertical = w > h;
        const n = w > 320 && h > 240 && rng.chance(0.5) ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const bx = n === 1 ? x0 : x0 + (vertical ? i * (w / 2) : 0);
          const by = n === 1 ? y0 : y0 + (vertical ? 0 : i * (h / 2));
          const bw = n === 1 ? w : vertical ? w / 2 - 10 : w;
          const bh = n === 1 ? h : vertical ? h : h / 2 - 10;
          const b = {
            x: bx + 8,
            y: by + 8,
            w: Math.max(60, bw - 16),
            h: Math.max(60, bh - 16),
            color: rng.pick(PALETTE.building),
            neon: rng.chance(0.3) ? rng.pick(PALETTE.neon) : null,
          };
          buildings.push(b);
        }
      }
    }
  }

  const park = fixedPark;
  const intersections = ROADS_V.map((x) => ROADS_H.map((y) => ({ x, y })));

  return {
    roadsV: ROADS_V,
    roadsH: ROADS_H,
    buildings,
    parks,
    lots,
    beachY: BEACH_Y,
    seaY: SEA_Y,
    parkCenter: { x: park.cx, y: park.cy },
    dockyard: { x: colRanges[4][0], y: rowRanges[0][0], w: colRanges[4][1] - colRanges[4][0], h: rowRanges[0][1] - rowRanges[0][0] },
    // The safehouse marker sits just south of the safehouse building (the
    // building itself is solid, so the marker must be reachable on foot).
    safehouse: { x: (colRanges[0][0] + colRanges[0][1]) / 2, y: (rowRanges[3][0] + rowRanges[3][1]) / 2 + 120 },
    spawn: { x: ROADS_V[1], y: ROADS_H[1] + 40 },
    intersections,
  };
}

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function circleHitsRect(cx, cy, rad, r) {
  const nx = Math.max(r.x, Math.min(cx, r.x + r.w));
  const ny = Math.max(r.y, Math.min(cy, r.y + r.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < rad * rad;
}

// The first solid thing a circle touches, or null. Buildings are solid;
// the sea is solid too, so nobody drives into the water.
export function collidesSolid(world, x, y, rad) {
  if (x < rad || y < rad || x > WORLD.w - rad || y > WORLD.h - rad) return { edge: true };
  if (y > world.seaY - 6) return { sea: true };
  for (const b of world.buildings) {
    if (circleHitsRect(x, y, rad, b)) return b;
  }
  return null;
}

// True when nothing solid stands between two points. Gang members and
// cops only shoot when they can actually see the player.
export function hasLineOfSight(world, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(len / 16));
  for (let i = 1; i < steps; i++) {
    const x = x1 + (dx * i) / steps;
    const y = y1 + (dy * i) / steps;
    for (const b of world.buildings) {
      if (pointInRect(x, y, b)) return false;
    }
  }
  return true;
}

export function randomRoadPoint(world, rng) {
  if (rng.chance(0.5)) {
    const x = rng.pick(world.roadsV);
    return { x: x + rng.float(-30, 30), y: rng.float(80, world.beachY - 80) };
  }
  const y = rng.pick(world.roadsH);
  return { x: rng.float(80, WORLD.w - 80), y: y + rng.float(-30, 30) };
}

// Nearest intersection grid cell to a point, for traffic routing.
export function nearestIntersection(world, x, y) {
  let bi = 0;
  let bj = 0;
  let best = Infinity;
  for (let i = 0; i < world.roadsV.length; i++) {
    for (let j = 0; j < world.roadsH.length; j++) {
      const d = (world.roadsV[i] - x) ** 2 + (world.roadsH[j] - y) ** 2;
      if (d < best) {
        best = d;
        bi = i;
        bj = j;
      }
    }
  }
  return { i: bi, j: bj };
}
