export const WORLD = { w: 480, h: 720, cell: 24, cols: 18, rows: 24,
  room: { x: 24, y: 100, w: 432, h: 576 }, speed: 145, playerRadius: 8, ghostRadius: 7 };
export const LEVELS = { obstacles: [0, 1, 3, 7], traps: [0, 1, 3, 7], interval: [6, 3, 1.5, .75], cap: [4, 8, 16, 32] };
export const CHASE = { pause: 1, speedRatio: .8 };
export const CAPTIONS = ['小朋友，你最美好的时光才刚开始！', '叛逆的少年，人生是一场华丽的冒险！',
  '年轻人，享受你自由生活的每一刻！', '你开始追忆逝去的时光！', '岁月已逝，你活力还在！',
  '还不是终点，你依然热爱生活！', '生命不在于长度，而在于深度和广度！', '每一天都是现场直播，所以请你珍惜！',
  '人生就像一场旅行，你不要在乎目的地！', '人生圆满，你真的很强👍'];
export const caption = n => CAPTIONS[n <= 10 ? 0 : Math.min(9, Math.ceil(n / 10) - 1)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function seeded(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const choose = (a, rng) => a[Math.floor(rng() * a.length)];
const integer = (a, b, rng) => a + Math.floor(rng() * (b - a + 1));
export const center = (c, r) => ({ x: WORLD.room.x + (c + .5) * WORLD.cell, y: WORLD.room.y + (r + .5) * WORLD.cell });
export function cellAt(x, y) { return [clamp(Math.floor((x - WORLD.room.x) / WORLD.cell), 0, WORLD.cols - 1), clamp(Math.floor((y - WORLD.room.y) / WORLD.cell), 0, WORLD.rows - 1)]; }
export const ENTRY = { ...center(8, 22), c: 8, r: 22 };
export const newDifficulty = () => ({ obstacles: 0, traps: 0, interval: 0, cap: 0 });
export const parameters = d => Object.fromEntries(Object.keys(LEVELS).map(k => [k, LEVELS[k][d[k]]]));
export const difficultyIndex = p => (p.obstacles + 1) * (p.traps + 1) * (6 / p.interval) * (p.cap / 4);
export function upgrade(d, rng = Math.random) {
  const eligible = Object.keys(LEVELS).filter(k => d[k] < 3);
  if (!eligible.length) throw new Error('No upgrades left');
  // In each balanced round introduce/increase both map hazards first, then
  // improve clones. Randomize the order inside each pair, without skipping a type.
  const lowest = Math.min(...eligible.map(k => d[k]));
  const lagging = eligible.filter(k => d[k] === lowest);
  const mapHazards = lagging.filter(k => k === 'obstacles' || k === 'traps');
  const pool = mapHazards.length ? mapHazards : lagging;
  const key = choose(pool, rng); d[key]++; return key;
}
export function flowField(blocked, targets) {
  const { cols, rows } = WORLD, out = new Int16Array(cols * rows).fill(-1), queue = new Int16Array(cols * rows);
  let tail = 0;
  for (const [c, r] of targets) { const idx = r * cols + c; if (!blocked[idx] && out[idx] < 0) { out[idx] = 0; queue[tail++] = idx; } }
  for (let head = 0; head < tail; head++) {
    const idx = queue[head], c = idx % cols, r = Math.floor(idx / cols);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr, ni = nr * cols + nc;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || blocked[ni] || out[ni] >= 0) continue;
      out[ni] = out[idx] + 1; queue[tail++] = ni;
    }
  }
  return out;
}
function makeDoor(rng) {
  const side = choose(['top', 'right', 'bottom', 'left'], rng);
  const horizontal = side === 'top' || side === 'bottom';
  const a = integer(2, (horizontal ? WORLD.cols : WORLD.rows) - 4, rng);
  const cells = horizontal ? [[a, side === 'top' ? 0 : WORLD.rows - 1], [a + 1, side === 'top' ? 0 : WORLD.rows - 1]]
    : [[side === 'left' ? 0 : WORLD.cols - 1, a], [side === 'left' ? 0 : WORLD.cols - 1, a + 1]];
  const points = cells.map(([c, r]) => center(c, r)), { room: R, cell: C } = WORLD;
  return { side, a, cells, horizontal, x: horizontal ? R.x + (a + 1) * C : side === 'left' ? R.x : R.x + R.w,
    y: horizontal ? side === 'top' ? R.y : R.y + R.h : R.y + (a + 1) * C, open: false, points };
}
const shapes = [[1, 1], [2, 1], [1, 2], [2, 2], [3, 1], [1, 3]];
function attemptMap(p, roomIndex, rng) {
  const { cols, rows, cell: C, room: R } = WORLD;
  const blocked = new Uint8Array(cols * rows), forbidden = new Uint8Array(cols * rows), door = makeDoor(rng);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (distance(center(c, r), ENTRY) < 82) forbidden[r * cols + c] = 1;
  for (const [c, r] of door.cells) for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
    const nc = c + dc, nr = r + dr; if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) forbidden[nr * cols + nc] = 1;
  }
  const obstacles = [];
  for (let i = 0; i < p.obstacles; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 90 && !placed; attempt++) {
      const [w, h] = choose(shapes, rng), c = integer(1, cols - w - 1, rng), r = integer(1, rows - h - 1, rng);
      if (Math.hypot(ENTRY.x - clamp(ENTRY.x, R.x + c * C, R.x + (c + w) * C),
        ENTRY.y - clamp(ENTRY.y, R.y + r * C, R.y + (r + h) * C)) < 76) continue;
      let valid = true;
      for (let rr = r - 1; rr <= r + h; rr++) for (let cc = c - 1; cc <= c + w; cc++) {
        if (blocked[rr * cols + cc] || cc >= c && cc < c + w && rr >= r && rr < r + h && forbidden[rr * cols + cc]) valid = false;
      }
      if (!valid) continue;
      for (let rr = r; rr < r + h; rr++) for (let cc = c; cc < c + w; cc++) blocked[rr * cols + cc] = 1;
      obstacles.push({ c, r, cw: w, ch: h, x: R.x + c * C, y: R.y + r * C, w: w * C, h: h * C, art: integer(5, 7, rng) }); placed = true;
    }
    if (!placed) return null;
  }
  const pool = [];
  for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) if (!blocked[r * cols + c] && !forbidden[r * cols + c]) pool.push([c, r]);
  const safeBlocked = blocked.slice(), traps = [];
  for (let i = 0; i < p.traps; i++) {
    if (!pool.length) return null;
    const [c, r] = pool.splice(integer(0, pool.length - 1, rng), 1)[0]; safeBlocked[r * cols + c] = 1;
    traps.push({ c, r, x: R.x + c * C, y: R.y + r * C, state: 'hidden', triggeredAt: null, leftAt: null, wasOn: false });
  }
  const reachable = flowField(safeBlocked, [[ENTRY.c, ENTRY.r]]);
  for (let i = 0; i < blocked.length; i++) if (!safeBlocked[i] && reachable[i] < 0) return null;
  if (door.cells.some(([c, r]) => reachable[r * cols + c] < 0)) return null;
  const clockCells = [];
  for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) if (!safeBlocked[r * cols + c] && reachable[r * cols + c] >= 0) clockCells.push(center(c, r));
  if (clockCells.length < 70) return null;
  const props = [], art = roomIndex < 2 ? [8, 9] : roomIndex < 4 ? [10, 11] : roomIndex < 7 ? [11, 12, 15] : [11, 13, 12];
  for (let i = 0; i < 13; i++) { const point = choose(clockCells, rng); props.push({ ...point, art: choose(art, rng), angle: (rng() - .5) * .7, scale: .7 + rng() * .5 }); }
  return { obstacles, traps, blocked, safeBlocked, reachable, door, clockCells, props, seed: integer(1, 1e9, rng), index: roomIndex };
}
export function generateMap(p, roomIndex = 0, rng = Math.random) {
  for (let attempt = 0; attempt < 3000; attempt++) { const room = attemptMap(p, roomIndex, rng); if (room) return room; }
  throw new Error('Unable to generate a reachable room.');
}
export function hitsObstacle(room, x, y, radius) {
  return room.obstacles.some(o => { const cx = clamp(x, o.x, o.x + o.w), cy = clamp(y, o.y, o.y + o.h); return (x - cx) ** 2 + (y - cy) ** 2 < radius ** 2 - .001; });
}
export function moveActor(room, actor, dx, dy, radius) {
  const R = WORLD.room;
  const x = clamp(actor.x + dx, R.x + radius, R.x + R.w - radius);
  if (!hitsObstacle(room, x, actor.y, radius)) actor.x = x;
  const y = clamp(actor.y + dy, R.y + radius, R.y + R.h - radius);
  if (!hitsObstacle(room, actor.x, y, radius)) actor.y = y;
}
// Test the whole swept path, so free steering cannot cut through an obstacle.
function clearPath(room, from, to, radius) {
  return !room.obstacles.some(o => {
    let near = 0, far = 1;
    for (const [position, delta, low, high] of [[from.x, to.x - from.x, o.x - radius, o.x + o.w + radius],
      [from.y, to.y - from.y, o.y - radius, o.y + o.h + radius]]) {
      if (Math.abs(delta) < 1e-8) { if (position < low || position > high) return false; }
      else { const a = (low - position) / delta, b = (high - position) / delta;
        near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b)); if (near > far) return false; }
    }
    return true;
  });
}
export function touchesDoor(room, p) {
  const d = room.door, R = WORLD.room, tolerance = WORLD.playerRadius + 3;
  if (!d.open) return false;
  return d.horizontal ? Math.abs(p.y - d.y) <= tolerance && Math.abs(p.x - d.x) <= WORLD.cell - 3
    : Math.abs(p.x - d.x) <= tolerance && Math.abs(p.y - d.y) <= WORLD.cell - 3;
}
export function tickTrap(trap, player, now) {
  const on = player.x >= trap.x && player.x < trap.x + WORLD.cell && player.y >= trap.y && player.y < trap.y + WORLD.cell;
  if (trap.state === 'hidden' && on) { trap.state = 'cracking'; trap.triggeredAt = now; trap.leftAt = null; }
  if (trap.state !== 'hidden') {
    if (on) trap.leftAt = null;
    else if (trap.wasOn || trap.leftAt === null) trap.leftAt = now;
    if (now - trap.triggeredAt >= .9 - 1e-8) trap.state = 'open';
    if (!on && trap.leftAt !== null && now - trap.leftAt >= 3 - 1e-8) { trap.state = 'hidden'; trap.triggeredAt = null; trap.leftAt = null; }
  }
  trap.wasOn = on;
  return on && trap.state === 'open';
}
export class Game {
  constructor({ rng = Math.random, onEvent = () => {} } = {}) { this.rng = rng; this.onEvent = onEvent; this.state = 'menu'; this.ghostId = 0; }
  emit(type, detail = {}) { this.onEvent(type, detail); }
  start(character = 'boy') {
    this.character = character; this.difficulty = newDifficulty(); this.roomIndex = 0; this.total = 0; this.alive = 0;
    this.time = 0; this.result = null; this.newRoom(); this.emit('start');
  }
  newRoom() {
    this.params = parameters(this.difficulty); this.room = generateMap(this.params, this.roomIndex, this.rng);
    this.player = { x: ENTRY.x, y: ENTRY.y, face: 1, walk: 0 }; this.ghosts = []; this.trail = [];
    this.sampleTimer = 0; this.spawnTimer = 0; this.count = 0; this.mode = 'collect'; this.freeze = 0;
    this.flowTimer = 0; this.flow = null; this.state = 'playing'; this.roomTime = 0; this.clock = null; this.lastClock = null; this.bump = 0;
    this.spawnClock(); this.emit('room');
  }
  spawnClock() {
    const candidates = this.room.clockCells.filter(p => distance(p, this.player) >= 55 && (!this.lastClock || distance(p, this.lastClock) >= WORLD.cell)
      && !this.ghosts.some(g => distance(p, g) < 33));
    if (!candidates.length) throw new Error('No legal clock position.');
    this.clock = { ...choose(candidates, this.rng) }; this.lastClock = { ...this.clock };
  }
  pause() { if (this.state === 'playing' || this.state === 'transition') { this.previousState = this.state; this.state = 'paused'; this.emit('pause'); } }
  resume() { if (this.state === 'paused') { this.state = this.previousState; this.emit('resume'); } }
  finish(won, cause = 'ghost') {
    if (this.result) return;
    this.state = won ? 'won' : 'dead'; this.result = { won, count: this.total, seconds: this.alive, cause, at: Date.now() };
    this.clock = null; this.emit(won ? 'win' : 'death', this.result);
  }
  collect() {
    if (!this.clock || this.state !== 'playing') return;
    this.clock = null; this.count++; this.total++; this.bump = 1;
    if (this.total === 100) { this.finish(true); return; }
    if (this.count === 10) {
      this.mode = 'chase'; this.freeze = CHASE.pause; this.chaseStartedAt = this.roomTime; this.room.door.open = true;
      for (const g of this.ghosts) { g.face = this.player.x >= g.x ? 1 : -1; g.waypoint = null; g.routing = false; }
      this.emit('chase');
    } else { this.spawnClock(); this.emit('clock'); }
  }
  spawnGhost() {
    if (!this.trail.length) return;
    if (this.ghosts.length >= this.params.cap) this.ghosts.shift();
    const path = this.trail.map(p => ({ ...p })), first = path[0];
    this.ghosts.push({ id: ++this.ghostId, x: first.x, y: first.y, face: first.face, walk: 0, path, cursor: 0, grace: .8, waypoint: null });
    this.emit('ghost');
  }
  enterDoor() {
    this.state = 'transition'; this.transitionTime = 0; this.room.door.open = false;
    this.transitionStart = this.ghosts.map(g => ({ x: g.x, y: g.y })); this.emit('door');
  }
  update(dt, input = { x: 0, y: 0 }) {
    if (this.state !== 'playing' && this.state !== 'transition') return;
    dt = Math.min(Math.max(dt, 0), .06);
    let remaining = dt;
    while (remaining > 1e-8) { const step = Math.min(remaining, 1 / 120); this.step(step, input); remaining -= step; if (this.result || this.state === 'paused') break; }
  }
  step(dt, input) {
    if (this.state === 'transition') {
      this.transitionTime += dt;
      const d = this.room.door, k = Math.min(1, this.transitionTime / .62), ease = 1 - (1 - k) ** 3;
      this.ghosts.forEach((g, i) => { const start = this.transitionStart[i], target = { x: d.x + (d.horizontal ? (i % 7 - 3) * 4 : d.side === 'left' ? 11 : -11),
        y: d.y + (!d.horizontal ? (i % 7 - 3) * 4 : d.side === 'top' ? 11 : -11) }; g.x = start.x + (target.x - start.x) * ease; g.y = start.y + (target.y - start.y) * ease; });
      if (this.transitionTime >= 1.08) { this.roomIndex++; upgrade(this.difficulty, this.rng); this.newRoom(); }
      return;
    }
    if (this.state !== 'playing') return;
    this.alive += dt; this.time += dt; this.roomTime += dt; this.bump = Math.max(0, this.bump - dt * 4);
    const magnitude = Math.hypot(input.x, input.y), factor = magnitude > 1 ? 1 / magnitude : 1;
    if (magnitude > .01) {
      moveActor(this.room, this.player, input.x * factor * WORLD.speed * dt, input.y * factor * WORLD.speed * dt, WORLD.playerRadius);
      this.player.walk += dt * 12; if (Math.abs(input.x) > .1) this.player.face = input.x > 0 ? 1 : -1;
    }
    if (touchesDoor(this.room, this.player)) { this.enterDoor(); return; }
    this.sampleTimer += dt;
    while (this.sampleTimer >= .05 - 1e-8) { this.sampleTimer -= .05; this.trail.push({ x: this.player.x, y: this.player.y, face: this.player.face }); if (this.trail.length > 64) this.trail.shift(); }
    if (this.clock && distance(this.player, this.clock) < WORLD.playerRadius + 12) this.collect();
    if (this.result) return;
    if (this.mode === 'collect') {
      this.spawnTimer += dt;
      while (this.spawnTimer >= this.params.interval - 1e-8) { this.spawnTimer -= this.params.interval; this.spawnGhost(); }
      for (const g of this.ghosts) {
        g.grace = Math.max(0, g.grace - dt); g.cursor += dt / .05;
        if (g.cursor >= g.path.length) { g.cursor %= g.path.length; g.grace = .55; }
        const i = Math.floor(g.cursor), p = g.path[i], q = g.path[Math.min(i + 1, g.path.length - 1)], f = g.cursor - i;
        const x = p.x + (q.x - p.x) * f, y = p.y + (q.y - p.y) * f;
        if (Math.hypot(x - g.x, y - g.y) > .01) g.walk += dt * 12;
        g.x = x; g.y = y; g.face = p.face;
      }
    } else if (this.freeze > 0) {
      this.freeze = Math.max(0, CHASE.pause - (this.roomTime - this.chaseStartedAt));
      for (const g of this.ghosts) g.face = this.player.x >= g.x ? 1 : -1;
    } else {
      this.flowTimer -= dt;
      if (!this.flow || this.flowTimer <= 0) { this.flowTimer = .12; this.flow = flowField(this.room.blocked, [cellAt(this.player.x, this.player.y)]); }
      for (const g of this.ghosts) this.chaseGhost(g, dt);
    }
    // Clock collection and exiting have priority: the final pickup freezes danger immediately.
    if (!(this.mode === 'chase' && this.freeze > 0)) for (const g of this.ghosts) {
      if ((this.mode === 'chase' || g.grace <= 0) && distance(g, this.player) < WORLD.playerRadius + WORLD.ghostRadius) { this.finish(false, 'ghost'); return; }
    }
    for (const trap of this.room.traps) if (tickTrap(trap, this.player, this.roomTime)) { this.finish(false, 'floor'); return; }
  }
  chaseGhost(g, dt) {
    // Pursuit uses this ghost's position and the player's position, never player input
    // or the old replay cursor. Visible targets are followed freely in any direction.
    const targetCell = cellAt(this.player.x, this.player.y), ownCell = cellAt(g.x, g.y), idx = ownCell[1] * WORLD.cols + ownCell[0];
    let target;
    if (clearPath(this.room, g, this.player, WORLD.ghostRadius)) {
      target = this.player; g.waypoint = null; g.routing = false;
    } else {
      if (!g.routing || !g.waypoint || !clearPath(this.room, g, g.waypoint, WORLD.ghostRadius)) {
        g.waypoint = center(...ownCell); g.routing = true;
      }
      if (distance(g, g.waypoint) < .15) {
        const field = this.flow ?? flowField(this.room.blocked, [targetCell]);
        let best = field[idx], next = ownCell;
        const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]], offset = (g.id ?? 0) % 4;
        // Equal-length routes have individual preferences instead of a shared turn order.
        for (let i = 0; i < 4; i++) {
          const [dc, dr] = directions[(i + offset) % 4];
          const c = ownCell[0] + dc, r = ownCell[1] + dr;
          if (c < 0 || r < 0 || c >= WORLD.cols || r >= WORLD.rows) continue;
          const value = field[r * WORLD.cols + c]; if (value >= 0 && value < best) { best = value; next = [c, r]; }
        }
        g.waypoint = center(...next);
      }
      target = g.waypoint;
    }
    const dx = target.x - g.x, dy = target.y - g.y, len = Math.hypot(dx, dy);
    if (len > .001) {
      let sx = 0, sy = 0;
      for (const other of this.ghosts) if (other !== g) {
        let ox = g.x - other.x, oy = g.y - other.y, gap = Math.hypot(ox, oy);
        if (gap >= 26) continue;
        if (gap < .01) { const angle = (g.id ?? 1) * 2.399963; ox = Math.cos(angle); oy = Math.sin(angle); gap = 1; }
        const strength = (26 - gap) / 26; sx += ox / gap * strength; sy += oy / gap * strength;
      }
      const separation = Math.hypot(sx, sy), weight = Math.min(.65, separation * .35);
      let vx = dx / len + (separation ? sx / separation * weight : 0), vy = dy / len + (separation ? sy / separation * weight : 0);
      const length = Math.hypot(vx, vy), travel = Math.min(len, WORLD.speed * CHASE.speedRatio * dt), before = { x: g.x, y: g.y };
      vx /= length; vy /= length; moveActor(this.room, g, vx * travel, vy * travel, WORLD.ghostRadius);
      if (distance(before, g) < travel * .1) { g.x = before.x; g.y = before.y; moveActor(this.room, g, dx / len * travel, dy / len * travel, WORLD.ghostRadius); }
      g.walk += dt * 12; if (Math.abs(g.x - before.x) > .01) g.face = g.x > before.x ? 1 : -1;
    }
    g.grace = 0;
  }
}
