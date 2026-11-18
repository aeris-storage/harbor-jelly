/* ============================================================
   Life — fish schools, moon jellies, gulls, steam & the life ring
   ============================================================ */
class ToneMesh {
  constructor() { this.pos = []; this.nrm = []; this.uv = []; this.tone = []; this.idx = []; }
  get count() { return this.pos.length / 3; }
  v(p, n, uv, tone) {
    this.pos.push(p[0], p[1], p[2]);
    this.nrm.push(n[0], n[1], n[2]);
    this.uv.push(uv[0], uv[1]);
    this.tone.push(tone);
    return this.count - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  quad(p, n, uv, tone) {
    const a = this.v(p[0], n, uv[0], tone);
    const b = this.v(p[1], n, uv[1], tone);
    const c = this.v(p[2], n, uv[2], tone);
    const d = this.v(p[3], n, uv[3], tone);
    this.idx.push(a, b, c, a, c, d);
  }
  box(cx, cy, cz, sx, sy, sz, tone) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const faces = [
      { p: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], n: [1, 0, 0] },
      { p: [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], n: [-1, 0, 0] },
      { p: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], n: [0, 1, 0] },
      { p: [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]], n: [0, -1, 0] },
      { p: [[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]], n: [0, 0, 1] },
      { p: [[x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z0]], n: [0, 0, -1] }
    ];
    for (const f of faces) this.quad(f.p, f.n, uv, tone);
  }
  sphere(cx, cy, cz, rx, ry, rz, tone, seg = 10, rings = 6) {
    const base = this.count;
    for (let j = 0; j <= rings; j++) {
      const phi = j / rings * PI;
      const sp = Math.sin(phi), cp = Math.cos(phi);
      for (let i = 0; i <= seg; i++) {
        const th = i / seg * TAU;
        const nx = sp * Math.cos(th), ny = cp, nz = sp * Math.sin(th);
        this.v([cx + nx * rx, cy + ny * ry, cz + nz * rz], V3.norm([nx / rx, ny / ry, nz / rz]), [i / seg, j / rings], tone);
      }
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
      const a = base + j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
      this.idx.push(a, c, b, b, c, d);
    }
  }
  extract() {
    const n = this.count;
    const vertices = new Float32Array(n * 9);
    for (let i = 0; i < n; i++) {
      const o = i * 9;
      vertices[o] = this.pos[i * 3]; vertices[o + 1] = this.pos[i * 3 + 1]; vertices[o + 2] = this.pos[i * 3 + 2];
      vertices[o + 3] = this.nrm[i * 3]; vertices[o + 4] = this.nrm[i * 3 + 1]; vertices[o + 5] = this.nrm[i * 3 + 2];
      vertices[o + 6] = this.uv[i * 2]; vertices[o + 7] = this.uv[i * 2 + 1];
      vertices[o + 8] = this.tone[i];
    }
    return { vertices, indices: new Uint16Array(this.idx) };
  }
}

function buildFishMesh() {
  const m = new ToneMesh();
  m.sphere(0, 0, 0, .034, .042, .1, 0, 8, 5);
  // forked tail, caught by the vertex shader
  m.quad([[-.012, 0, -.095], [0, .062, -.185], [.012, 0, -.095], [0, -.062, -.185]], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]], 0);
  m.quad([[.012, 0, -.095], [0, .062, -.185], [-.012, 0, -.095], [0, -.062, -.185]], [0, 0, -1], [[0, 0], [1, 0], [1, 1], [0, 1]], 0);
  // dorsal and pectoral fins
  m.quad([[0, .038, -.02], [0, .072, -.07], [0, .036, -.10], [0, .03, -.04]], [1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], 0);
  m.quad([[-.01, .01, .01], [-.065, .03, -.035], [-.04, .012, -.01], [-.008, .005, -.005]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], 0);
  // tiny mouth tip
  m.sphere(0, -.006, .105, .016, .014, .014, 0, 6, 4);
  return m.extract();
}

function buildGullMesh() {
  const m = new ToneMesh();
  m.sphere(0, 0, 0, .033, .032, .092, 0, 8, 5);
  m.sphere(0, .03, .082, .028, .028, .032, 0, 8, 5);
  // wings are boxes so the vertex shader can hinge the tips upward
  for (const side of [-1, 1]) {
    m.box(side * .115, .004, -.005, .18, .009, .075, 1);
    m.box(side * .22, .004, -.04, .055, .009, .04, 2);
    m.box(side * .15, .006, .02, .07, .012, .025, 2);
  }
  // tail
  m.quad([[-.035, 0, -.075], [0, .008, -.17], [.04, 0, -.075], [0, -.004, -.08]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], 0);
  m.quad([[.04, 0, -.075], [0, .008, -.17], [-.035, 0, -.075], [0, -.004, -.08]], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], 0);
  // beak: a tiny yellow wedge with a red spot
  m.quad([[0, .032, .112], [-.013, .025, .152], [.013, .025, .152], [0, .018, .112]], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]], 3);
  m.quad([[0, .032, .112], [0, .018, .112], [.013, .025, .152], [-.013, .025, .152]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], 3);
  m.sphere(0, .025, .151, .007, .007, .006, 4, 5, 3);
  // little orange feet, folded
  for (const side of [-1, 1]) m.box(side * .014, -.03, -.01, .012, .008, .04, 3);
  return m.extract();
}

function buildJellyMesh() {
  const m = new ToneMesh();
  const seg = 12, rings = 5, R = .1, H = .08;
  const base = m.count;
  for (let j = 0; j <= rings; j++) {
    const phi = j / rings * PI * .5;
    const sp = Math.sin(phi), cp = Math.cos(phi);
    for (let i = 0; i <= seg; i++) {
      const th = i / seg * TAU;
      const nx = sp * Math.cos(th), ny = cp, nz = sp * Math.sin(th);
      m.v([nx * R, cp * H, nz * R], V3.norm([nx, ny * .7, nz]), [i / seg, j / rings], 0);
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
    const a = base + j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
    m.idx.push(a, c, b, b, c, d);
  }
  // rim
  for (let i = 0; i < seg; i++) {
    const th0 = i / seg * TAU, th1 = (i + 1) / seg * TAU;
    m.v([Math.cos(th0) * R, 0, Math.sin(th0) * R], [0, 0, 1], [i / seg, 1], 0);
  }
  // eight tentacles and four frilly oral arms
  for (let t = 0; t < 10; t++) {
    const th = t / 10 * TAU;
    const x = Math.cos(th) * R * .9, z = Math.sin(th) * R * .9;
    const len = t < 8 ? .16 : .11;
    const w = t < 8 ? .011 : .022;
    const ox = -Math.sin(th) * w * .5, oz = Math.cos(th) * w * .5;
    m.quad([[x - ox, 0, z - oz], [x + ox, 0, z + oz], [x + ox * .5, -len, z + oz * .5], [x - ox * .5, -len, z - oz * .5]], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]], 0);
    m.quad([[x + ox, 0, z + oz], [x - ox, 0, z - oz], [x - ox * .5, -len, z - oz * .5], [x + ox * .5, -len, z + oz * .5]], [0, 0, -1], [[0, 0], [1, 0], [1, 1], [0, 1]], 0);
  }
  return m.extract();
}

const FISH_BOUNDS = { x0: -1.75, x1: 1.55, z0: -1.25, z1: 1.62, y0: -1.22, y1: -.28 };
const GULL_COLORS = [C('#f0ece3'), C('#fdf9ef'), C('#e3ddd0')];

class LifeSystem {
  constructor() {
    this.time = 0;
    this.ring = { x: -.22, y: .03, z: 1.52, vx: 0, vy: 0, vz: 0, state: 'float', yaw: .3, phase: 1.3 };
    this.fish = [];
    this.gulls = [];
    this.jellies = [];
    this.particles = [];
    this.food = [];
    this.scares = [];
    this.perches = [];
    this.staticPerches = [];
    this.freePerchTries = 0;
    this.smokeAccum = 0;
    this.bubbleAccum = 0;
    this.steamBursts = [];
    this.ringSplashTimer = 0;
    this.isInitialised = false;
  }
  init(staticPerches) {
    const rng = mulberry32(7331);
    this.staticPerches = staticPerches.map((p) => ({ ...p, dynamic: false, occupant: null }));
    this.perches = this.staticPerches.slice();
    // fish
    const species = [
      { kind: 0, count: 24, color: C('#5f8b88'), center: [.15, -.7, .2] },
      { kind: 1, count: 18, color: C('#b6c3be'), center: [.85, -.82, .8] },
      { kind: 2, count: 12, color: C('#d08351'), center: [-.35, -.74, .85] }
    ];
    for (const sp of species) {
      for (let i = 0; i < sp.count; i++) {
        const ang = rng() * TAU;
        const radius = .25 + rng() * 1.0;
        this.fish.push({
          kind: sp.kind,
          color: sp.color,
          x: clamp(sp.center[0] + Math.cos(ang) * radius, FISH_BOUNDS.x0, FISH_BOUNDS.x1),
          y: -.42 - rng() * .6,
          z: clamp(sp.center[2] + Math.sin(ang) * radius, FISH_BOUNDS.z0, FISH_BOUNDS.z1),
          vx: (rng() - .5) * .12,
          vy: (rng() - .5) * .03,
          vz: (rng() - .5) * .12,
          phase: rng() * TAU,
          speed: .75 + rng() * .25,
          yaw: rng() * TAU
        });
      }
    }
    // jellies
    const jellyColors = [C('#f4dfe2'), C('#dce9e6'), C('#ead9e9'), C('#f0e9dd')];
    for (let i = 0; i < 7; i++) {
      this.jellies.push({
        x: -.8 + rng() * 2.2,
        y: -.45 - rng() * .5,
        z: -.2 + rng() * 1.7,
        phase: rng() * TAU,
        drift: rng() * TAU,
        scale: .6 + rng() * .55,
        color: jellyColors[i % jellyColors.length]
      });
    }
    // gulls, some perched from the first frame
    for (let i = 0; i < 12; i++) {
      const perched = i % 3 !== 0 && this.perches.length > i;
      const perch = perched ? this.perches[i % this.perches.length] : null;
      if (perch) perch.occupant = i;
      const startAngle = i / 12 * TAU + .4;
      this.gulls.push({
        pos: perched ? [...perch.pos] : [Math.cos(startAngle) * 1.4, 1.25 + (i % 4) * .26, Math.sin(startAngle) * 1.15],
        vel: [0, 0, 0],
        yaw: startAngle,
        pitch: 0,
        roll: 0,
        state: perched ? 'perched' : 'flying',
        perch,
        phase: rng() * TAU,
        homeAngle: startAngle,
        homeRadius: .85 + rng() * .7,
        height: .95 + rng() * .8,
        timer: 2 + rng() * 9,
        flap: perched ? .04 : .75,
        diveTarget: null,
        wingPhase: rng() * TAU
      });
    }
    this.isInitialised = true;
  }
  reset(staticPerches) {
    this.fish.length = 0; this.gulls.length = 0; this.jellies.length = 0;
    this.particles.length = 0; this.food.length = 0; this.scares.length = 0;
    this.ring = { x: -.22, y: .03, z: 1.52, vx: 0, vy: 0, vz: 0, state: 'float', yaw: .3, phase: 1.3 };
    this.time = 0;
    this.init(staticPerches);
  }
  scare(x, z, radius = .6) {
    this.scares.push({ x, z, radius, life: .55 });
    if (this.scares.length > 20) this.scares.shift();
  }
  splash(x, z, amount = .5) {
    this.scare(x, z, .8);
    const n = Math.round(8 + amount * 14);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = .4 + Math.random() * 1.2;
      this.addParticle(x, .035, z, Math.cos(a) * sp * .35, .6 + Math.random() * 1.0, Math.sin(a) * sp * .35, 2.0, .025 + Math.random() * .035, C('#f2f4e9'), 1);
    }
  }
  feed() {
    const fx = 1.31, fz = 1.22;
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * TAU, r = Math.random() * .17;
      this.food.push({ x: fx + Math.cos(a) * r, y: -.3 - Math.random() * .12, z: fz + Math.sin(a) * r, life: 22, phase: Math.random() * TAU });
    }
    this.scare(fx, fz, .45);
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * TAU, r = Math.random() * .18;
      this.addParticle(fx + Math.cos(a) * r, .03, fz + Math.sin(a) * r, Math.cos(a) * .12, .2 + Math.random() * .3, Math.sin(a) * .12, .9, .018 + Math.random() * .02, C('#d1a666'), 2);
    }
    // a few gulls take the bait
    let chosen = 0;
    for (const g of this.gulls) {
      if (chosen >= 4) break;
      if (g.state === 'flying' || g.state === 'perched') {
        if (g.perch && g.perch.occupant === this.gulls.indexOf(g)) g.perch.occupant = null;
        g.perch = null;
        g.state = 'diving';
        g.timer = 4.2;
        g.diveTarget = [1.33, -.02, 1.23];
        chosen++;
      }
    }
    for (const g of this.gulls) g.timer = Math.min(g.timer, 2.4 + Math.random() * 4);
  }
  spookGulls() {
    for (let i = 0; i < this.gulls.length; i++) {
      const g = this.gulls[i];
      if (g.perch && g.perch.occupant === i) g.perch.occupant = null;
      g.perch = null;
      g.state = i % 4 === 0 ? 'diving' : 'takingoff';
      g.timer = 5.5 + Math.random() * 5;
      const ang = Math.random() * TAU;
      g.vel = [Math.cos(ang) * (.4 + Math.random() * .5), .7 + Math.random() * .5, Math.sin(ang) * (.4 + Math.random() * .5)];
      g.flap = 1.0;
    }
    this.steamBursts.push({ type: 'ship', count: 18 });
    this.steamBursts.push({ type: 'tug', count: 10 });
  }
  addParticle(x, y, z, vx, vy, vz, life, size, color, mode) {
    if (this.particles.length > 560) this.particles.shift();
    this.particles.push({ x, y, z, vx, vy, vz, life, maxLife: life, size, color, mode, rot: Math.random() * TAU });
  }
  worldFromObject(objects, obj, local) {
    return M4.transformPoint(objects[obj], local);
  }
  updatePerches(objects) {
    // compute dynamic perches in the current frame
    for (const spec of DYNAMIC_PERCHES) {
      const p = this.worldFromObject(objects, spec.obj, spec.local);
      let yaw = spec.yaw;
      const m = objects[spec.obj];
      yaw = Math.atan2(m[8], m[10]);
      let found = this.perches.find((q) => q.dynamic && q.obj === spec.obj);
      if (!found) {
        found = { pos: p, yaw, dynamic: true, obj: spec.obj, occupant: null, name: spec.name };
        this.perches.push(found);
      }
      found.pos = p;
      found.yaw = yaw;
    }
    for (const p of this.staticPerches) {
      // static positions are in world already
    }
  }
  freePerch(g) {
    let best = null, bestD = 1e9;
    for (const p of this.perches) {
      if (p.occupant !== null && p.occupant !== undefined) continue;
      const d = Math.hypot(g.pos[0] - p.pos[0], g.pos[1] - p.pos[1], g.pos[2] - p.pos[2]);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }
  update(dt, time, state) {
    this.time = time;
    const { sim, objects, water, waterY, tide, camera } = state;
    this.updatePerches(objects);
    this.updateFish(dt, time, sim, objects);
    this.updateJellies(dt, time, water);
    this.updateGulls(dt, time, sim, objects);
    this.updateParticles(dt, time, sim, objects);
    this.updateFood(dt);
    this.updateRing(dt, time, sim, water, waterY, tide);
    this.handleSteamBursts(objects);
    // headlamps / camera light never wanted. Leave atmosphere to the shaders.
  }
  updateFish(dt, time, sim, objects) {
    const fish = this.fish;
    const ships = [
      { x: sim.ship.x, z: sim.ship.z, r: .52, yaw: sim.ship.yaw },
      { x: sim.tug.x, z: sim.tug.z, r: .3 },
      { x: HarborCore.LAYOUT.fishingBoats[0].x, z: HarborCore.LAYOUT.fishingBoats[0].z, r: .2 },
      { x: HarborCore.LAYOUT.fishingBoats[1].x, z: HarborCore.LAYOUT.fishingBoats[1].z, r: .2 }
    ];
    for (const f of fish) {
      let cx = 0, cy = 0, cz = 0, ax = 0, ay = 0, az = 0, count = 0;
      const sepX = { v: 0 }, sepY = { v: 0 }, sepZ = { v: 0 };
      for (const o of fish) {
        if (o === f) continue;
        const dx = f.x - o.x, dy = f.y - o.y, dz = f.z - o.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < .16) {
          const inv = 1 / (d2 + .002);
          sepX.v += dx * inv; sepY.v += dy * inv; sepZ.v += dz * inv;
        }
        if (d2 < .09) {
          cx += o.x; cy += o.y; cz += o.z;
          ax += o.vx; ay += o.vy; az += o.vz;
          count++;
        }
      }
      let ix = 0, iy = 0, iz = 0;
      const pace = f.kind === 2 ? .9 : f.kind === 1 ? 1.1 : 1.3;
      const target = this.food.length ? this.food[Math.abs((f.phase * 10 | 0) + f.kind) % this.food.length] : null;
      let tx = 0, ty = 0, tz = 0;
      if (count) {
        const inv = 1 / count;
        tx = (cx * inv - f.x) * 1.2 + (ax * inv - f.vx) * .22;
        ty = (cy * inv - f.y) * 1.2 + (ay * inv - f.vy) * .22;
        tz = (cz * inv - f.z) * 1.2 + (az * inv - f.vz) * .22;
      }
      ix = sepX.v * .8 * pace + tx;
      iy = sepY.v * .8 * pace + ty;
      iz = sepZ.v * .8 * pace + tz;
      // loose school memory
      const schoolX = Math.sin(time * .13 + f.kind * 2.1) * .8 + (f.kind === 2 ? .2 : 0);
      const schoolZ = Math.cos(time * .11 + f.kind * 1.7) * .65 - .1;
      ix += (schoolX - f.x) * .06;
      iz += (schoolZ - f.z) * .06;
      iy += (-.72 - f.y) * .03;
      if (target) {
        const dx = target.x - f.x, dy = target.y - f.y, dz = target.z - f.z;
        const d = Math.hypot(dx, dy, dz) + .001;
        ix += dx / d * (1.8 + d * 1.2);
        iy += dy / d * (1.2 + d * .8);
        iz += dz / d * (1.8 + d * 1.2);
      }
      // fear: finger splashes and feeding commotion
      for (const s of this.scares) {
        const dx = f.x - s.x, dz = f.z - s.z;
        const d = Math.hypot(dx, dz) + .001;
        if (d < s.radius + .2) {
          ix += dx / d * (2.2 / d) * s.life;
          iz += dz / d * (2.2 / d) * s.life;
          iy += .5 * s.life;
        }
      }
      for (const s of ships) {
        const dx = f.x - s.x, dz = f.z - s.z;
        const d = Math.hypot(dx, dz);
        if (d < s.r + .18 && f.y > -.66) {
          ix += dx / (d + .01) * 2.2;
          iz += dz / (d + .01) * 2.2;
          iy -= .4;
        }
      }
      // keep fish in the jelly, under the surface and below hulls
      const m = .09;
      if (f.x < FISH_BOUNDS.x0 + m) ix += .5; else if (f.x > FISH_BOUNDS.x1 - m) ix -= .5;
      if (f.z < FISH_BOUNDS.z0 + m) iz += .5; else if (f.z > FISH_BOUNDS.z1 - m) iz -= .5;
      if (f.y < FISH_BOUNDS.y0 + m) iy += .45; else if (f.y > FISH_BOUNDS.y1) iy -= .55;
      const dampFish = .82;
      f.vx = (f.vx + ix * dt) * dampFish;
      f.vy = (f.vy + iy * dt) * dampFish;
      f.vz = (f.vz + iz * dt) * dampFish;
      let sp = Math.hypot(f.vx, f.vy, f.vz);
      const maxSp = .23 * f.speed * (target ? 1.8 : 1);
      if (sp > maxSp) { const k = maxSp / sp; f.vx *= k; f.vy *= k; f.vz *= k; sp = maxSp; }
      if (sp < .025) { f.vx += (Math.random() - .5) * .02; f.vz += (Math.random() - .5) * .02; }
      f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
      f.x = clamp(f.x, FISH_BOUNDS.x0, FISH_BOUNDS.x1);
      f.y = clamp(f.y, FISH_BOUNDS.y0, FISH_BOUNDS.y1);
      f.z = clamp(f.z, FISH_BOUNDS.z0, FISH_BOUNDS.z1);
      if (sp > .04) {
        const targetYaw = Math.atan2(f.vx, f.vz);
        let d = targetYaw - f.yaw;
        while (d > PI) d -= TAU; while (d < -PI) d += TAU;
        f.yaw += d * Math.min(1, dt * 5);
      }
    }
    for (const s of this.scares) s.life -= dt;
    this.scares = this.scares.filter((s) => s.life > 0);
  }
  updateJellies(dt, time, water) {
    for (const j of this.jellies) {
      j.drift += dt * .13;
      j.x += Math.sin(time * .2 + j.phase) * .01 * dt * 2;
      j.z += Math.cos(time * .16 + j.phase * .7) * .011 * dt * 2;
      j.y += Math.sin(time * .36 + j.phase) * .012 * dt;
      const waterY = HarborCore.WATER_Y + water.heightAt(j.x, j.z);
      if (j.y > waterY - .22) j.y = waterY - .22;
      if (j.y < -1.15) j.y = -1.15;
      if (j.x < -1.7) j.x = 1.5; if (j.x > 1.65) j.x = -1.6;
      if (j.z < -1.1) j.z = 1.55; if (j.z > 1.8) j.z = -1.1;
    }
  }
  updateGulls(dt, time, sim, objects) {
    const feed = [1.34, 0, 1.22];
    for (let i = 0; i < this.gulls.length; i++) {
      const g = this.gulls[i];
      g.phase += dt;
      if (g.state === 'perched') {
        if (g.perch) {
          if (g.perch.occupant !== i) g.perch.occupant = i;
          const target = [g.perch.pos[0], g.perch.pos[1] + .035, g.perch.pos[2]];
          g.pos[0] = damp(g.pos[0], target[0], 8, dt);
          g.pos[1] = damp(g.pos[1], target[1], 8, dt);
          g.pos[2] = damp(g.pos[2], target[2], 8, dt);
          g.yaw = damp(g.yaw, g.perch.yaw, 3, dt);
          g.pitch = damp(g.pitch, 0, 5, dt);
          g.roll = damp(g.roll, 0, 5, dt);
          g.flap = .04;
          g.timer -= dt;
          if (g.timer < -2 && Math.random() < dt * .045) {
            if (g.perch) g.perch.occupant = null;
            g.perch = null;
            g.state = 'takingoff';
            g.vel = [Math.sin(g.yaw) * .3, .4, Math.cos(g.yaw) * .3];
            g.timer = 8;
          }
        } else {
          g.state = 'flying';
        }
      } else if (g.state === 'flying') {
        const angle = time * (.2 + (i % 4) * .025) + g.homeAngle;
        const target = [
          Math.cos(angle) * g.homeRadius + .15,
          g.height + Math.sin(time * .55 + g.phase) * .18,
          Math.sin(angle * .9) * g.homeRadius * .7 + .15
        ];
        const dx = target[0] - g.pos[0], dy = target[1] - g.pos[1], dz = target[2] - g.pos[2];
        const dl = Math.hypot(dx, dy, dz) + .001;
        g.vel[0] = damp(g.vel[0], dx / dl * .38, 1.2, dt);
        g.vel[1] = damp(g.vel[1], dy / dl * .24, 1.2, dt);
        g.vel[2] = damp(g.vel[2], dz / dl * .38, 1.2, dt);
        g.pos[0] += g.vel[0] * dt; g.pos[1] += g.vel[1] * dt; g.pos[2] += g.vel[2] * dt;
        g.yaw = Math.atan2(g.vel[0], g.vel[2]);
        g.pitch = clamp(-Math.atan2(g.vel[1], Math.hypot(g.vel[0], g.vel[2]) + .001), -.5, .5);
        g.roll = Math.sin(time * 1.3 + i) * .17;
        g.flap = .62 + Math.sin(time * 8 + i) * .18;
        g.timer -= dt;
        if (g.timer < -2 && Math.random() < dt * .2 && !g.noLanding) {
          const p = this.freePerch(g);
          if (p) {
            p.occupant = i;
            g.perch = p;
            g.state = 'landing';
            g.timer = 4;
          }
        }
      } else if (g.state === 'landing') {
        if (!g.perch) { g.state = 'flying'; continue; }
        const target = [g.perch.pos[0], g.perch.pos[1] + .035, g.perch.pos[2]];
        const dx = target[0] - g.pos[0], dy = target[1] - g.pos[1], dz = target[2] - g.pos[2];
        const d = Math.hypot(dx, dy, dz);
        g.pos[0] = damp(g.pos[0], target[0], 2.4, dt);
        g.pos[1] = damp(g.pos[1], target[1], 2.4, dt);
        g.pos[2] = damp(g.pos[2], target[2], 2.4, dt);
        g.yaw = damp(g.yaw, g.perch.yaw, 2.5, dt);
        g.flap = .2;
        g.pitch = damp(g.pitch, -.25, 3, dt);
        if (d < .045) { g.state = 'perched'; g.flap = .03; }
      } else if (g.state === 'takingoff') {
        g.pos[0] += g.vel[0] * dt;
        g.pos[1] += g.vel[1] * dt;
        g.pos[2] += g.vel[2] * dt;
        g.vel[1] += .08 * dt;
        g.vel[0] *= 1 - dt * .4; g.vel[2] *= 1 - dt * .4;
        g.flap = 1.0;
        g.yaw = Math.atan2(g.vel[0], g.vel[2]);
        g.timer -= dt;
        if (g.timer < 2.2) g.state = 'flying';
      } else if (g.state === 'diving') {
        const target = g.diveTarget || feed;
        const dx = target[0] - g.pos[0], dy = (target[1] + .03) - g.pos[1], dz = target[2] - g.pos[2];
        const d = Math.hypot(dx, dy, dz);
        const speed = .8;
        if (d > .06) {
          g.pos[0] += dx / d * speed * dt;
          g.pos[1] += dy / d * speed * dt;
          g.pos[2] += dz / d * speed * dt;
          g.pitch = clamp(Math.atan2(-dy, Math.hypot(dx, dz) + .001), -.9, .9);
        }
        g.yaw = Math.atan2(dx, dz);
        g.flap = .9;
        g.timer -= dt;
        if (d < .08 || g.timer < 0) {
          g.state = 'climbing';
          g.vel = [Math.sin(g.yaw) * .1, .7, Math.cos(g.yaw) * .1];
          g.timer = 1.7;
          if (this.food.length) this.splash(target[0], target[2], .2);
        }
      } else if (g.state === 'climbing') {
        g.pos[0] += g.vel[0] * dt;
        g.pos[1] += g.vel[1] * dt;
        g.pos[2] += g.vel[2] * dt;
        g.vel[1] += .05 * dt;
        g.flap = .9;
        g.yaw = Math.atan2(g.vel[0], g.vel[2]);
        g.pitch = -.15;
        g.timer -= dt;
        if (g.timer < 0) { g.state = 'flying'; g.timer = 3 + Math.random() * 8; g.perch = null; }
      }
      // stay above the water and inside the diorama
      const surface = HarborCore.WATER_Y + .55;
      if (g.pos[1] < surface && g.state !== 'diving') g.pos[1] = surface;
      g.pos[0] = clamp(g.pos[0], -2.35, 2.35);
      g.pos[2] = clamp(g.pos[2], -2.2, 2.35);
    }
  }
  updateFood(dt) {
    for (const f of this.food) f.life -= dt;
    this.food = this.food.filter((f) => f.life > 0);
  }
  handleSteamBursts(objects) {
    for (const b of this.steamBursts) {
      if (b.type === 'ship') {
        const base = M4.transformPoint(objects[OBJ.ship], [0, .53, -.62]);
        for (let i = 0; i < b.count; i++) {
          const a = Math.random() * TAU, r = Math.random() * .06;
          this.addParticle(base[0] + Math.cos(a) * r, base[1] + Math.random() * .05, base[2] + Math.sin(a) * r,
            (Math.random() - .5) * .3, .35 + Math.random() * .35, (Math.random() - .5) * .3,
            1.7 + Math.random() * 1.3, .04 + Math.random() * .05, C('#e9e7dd'), 0);
        }
      } else {
        const base = M4.transformPoint(objects[OBJ.tug], [0, .38, -.13]);
        for (let i = 0; i < b.count; i++) {
          const a = Math.random() * TAU, r = Math.random() * .04;
          this.addParticle(base[0] + Math.cos(a) * r, base[1], base[2] + Math.sin(a) * r,
            (Math.random() - .5) * .2, .25 + Math.random() * .25, (Math.random() - .5) * .2,
            1.4 + Math.random(), .035 + Math.random() * .035, C('#ddd9ce'), 0);
        }
      }
    }
    this.steamBursts.length = 0;
  }
  updateParticles(dt, time, sim, objects) {
    // tug exhaust, quiet at rest
    this.smokeAccum += dt;
    const tugMoving = sim.tug.thrust > .12 || sim.tug.speed > .03;
    const interval = tugMoving ? .12 : .28;
    if (this.smokeAccum > interval) {
      this.smokeAccum = 0;
      const base = M4.transformPoint(objects[OBJ.tug], [0, .39, -.13]);
      for (let i = 0; i < (tugMoving ? 2 : 1); i++) {
        this.addParticle(base[0] + (Math.random() - .5) * .025, base[1] + Math.random() * .02, base[2] + (Math.random() - .5) * .025,
          (Math.random() - .5) * .1 + sim.tug.thrust * .02, .12 + Math.random() * .12, (Math.random() - .5) * .1,
          1.7 + Math.random() * 1.1, .03 + Math.random() * .035, C('#bfb8aa'), 0);
      }
    }
    // ambient jelly bubbles
    this.bubbleAccum += dt;
    if (this.bubbleAccum > .25) {
      this.bubbleAccum = 0;
      const x = -.8 + Math.random() * 2.1, z = -1.0 + Math.random() * 2.2;
      this.addParticle(x, -.8 - Math.random() * .4, z, (Math.random() - .5) * .02, .05 + Math.random() * .04, (Math.random() - .5) * .02,
        5 + Math.random() * 4, .012 + Math.random() * .012, C('#d7f0e8'), 2);
    }
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.mode === 0) {
        p.vy += .07 * dt; p.vx *= 1 - dt * .7; p.vz *= 1 - dt * .7;
        p.size += dt * .015;
      } else if (p.mode === 1) {
        p.vy -= 1.6 * dt;
      } else {
        p.vy += .035 * dt;
        p.x += Math.sin(time * 2 + p.rot) * .004 * dt;
        if (p.y > HarborCore.WATER_Y + .02) p.life = 0;
      }
      if (p.y < .01 && p.mode === 1) p.life = 0;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }
  updateRing(dt, time, sim, water, waterY, tide) {
    const r = this.ring;
    const surface = waterY + water.heightAt(r.x, r.z);
    if (r.state === 'air') {
      r.vy -= 5.0 * dt;
      r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt;
      if (r.y <= surface + .035) {
        r.y = surface + .035;
        r.state = 'float';
        this.splash(r.x, r.z, .5);
        r.vx *= .3; r.vz *= .3; r.vy = 0;
      }
    } else if (r.state === 'held') {
      r.y = surface + .22;
    } else {
      r.y = damp(r.y, surface + .035, 7, dt);
      // tiny current
      r.vx += Math.sin(time * .7 + r.phase) * .008 * dt;
      r.vz += Math.cos(time * .51 + r.phase) * .007 * dt;
      r.x += r.vx * dt; r.z += r.vz * dt;
      r.vx *= 1 - dt * 1.5; r.vz *= 1 - dt * 1.5;
      // land collisions
      for (const box of HarborCore.OBSTACLES) {
        const pad = .13;
        if (r.x > box.x0 - pad && r.x < box.x1 + pad && r.z > box.z0 - pad && r.z < box.z1 + pad) {
          const dl = r.x - (box.x0 - pad), dr = (box.x1 + pad) - r.x;
          const db = r.z - (box.z0 - pad), df = (box.z1 + pad) - r.z;
          const m = Math.min(dl, dr, db, df);
          if (m === dl) { r.x = box.x0 - pad; r.vx = -Math.abs(r.vx) * .5 - .04; }
          else if (m === dr) { r.x = box.x1 + pad; r.vx = Math.abs(r.vx) * .5 + .04; }
          else if (m === db) { r.z = box.z0 - pad; r.vz = -Math.abs(r.vz) * .5 - .04; }
          else { r.z = box.z1 + pad; r.vz = Math.abs(r.vz) * .5 + .04; }
          this.splash(r.x, r.z, .08);
        }
      }
      // push from the working vessels
      const ships = [
        { x: sim.ship.x, z: sim.ship.z, yaw: sim.ship.yaw, hb: .34, hl: .88, push: .16 },
        { x: sim.tug.x, z: sim.tug.z, yaw: sim.tug.yaw, hb: .18, hl: .36, push: .1 }
      ];
      for (const s of ships) {
        const cy = Math.cos(s.yaw), sy = Math.sin(s.yaw);
        const dx = r.x - s.x, dz = r.z - s.z;
        const lx = dx * cy - dz * sy, lz = dx * sy + dz * cy;
        if (Math.abs(lx) < s.hb && Math.abs(lz) < s.hl) {
          const px = s.hb - Math.abs(lx), pz = s.hl - Math.abs(lz);
          if (px < pz) {
            const sign = Math.sign(lx) || 1;
            r.x += sign * (px + .01) * cy;
            r.z -= sign * (px + .01) * sy;
            r.vx = sign * .18 * cy; r.vz = -sign * .18 * sy;
          } else {
            const sign = Math.sign(lz) || 1;
            r.x += sign * (pz + .01) * sy;
            r.z += sign * (pz + .01) * cy;
            r.vx = sign * .18 * sy; r.vz = sign * .18 * cy;
          }
          if (Math.random() < .08) this.splash(r.x, r.z, .12);
        }
      }
      r.x = clamp(r.x, -2.5, 2.5); r.z = clamp(r.z, -2.5, 2.5);
    }
  }
  getRingCenter(water, waterY) {
    const r = this.ring;
    if (r.state === 'air' || r.state === 'held') return [r.x, r.y, r.z];
    return [r.x, waterY + water.heightAt(r.x, r.z) + .035, r.z];
  }
  pickRing(ray, water, waterY) {
    const c = this.getRingCenter(water, waterY);
    const hit = raySphere(ray, c, .17);
    return !!hit;
  }
  beginHold() {
    this.ring.state = 'held';
    this.ring.vx = this.ring.vy = this.ring.vz = 0;
  }
  moveHold(x, z, water, waterY) {
    this.ring.x = x; this.ring.z = z;
    this.ring.y = waterY + water.heightAt(x, z) + .22;
  }
  releaseThrow(target, water, waterY) {
    const r = this.ring;
    const dx = target[0] - r.x, dz = target[2] - r.z;
    const d = Math.hypot(dx, dz) + .001;
    const power = clamp(.9 + d * 1.15, 1.0, 3.3);
    r.state = 'air';
    r.vx = dx / d * power;
    r.vz = dz / d * power;
    r.vy = 1.1 + Math.min(1.2, d * .5);
    this.splash(r.x, r.z, .16);
  }
  writeFish(out) {
    let count = 0;
    for (const f of this.fish) {
      const speed = Math.hypot(f.vx, f.vy, f.vz) + .001;
      const pitch = clamp(-Math.asin(clamp(f.vy / speed, -1, 1)), -.6, .6);
      const roll = clamp((f.vx * Math.cos(f.yaw) - f.vz * Math.sin(f.yaw)), -.2, .2);
      const q = Q.fromEuler(pitch, f.yaw, roll * .5);
      const scale = .78 + (f.kind === 2 ? .28 : 0) + (f.phase % 1) * .16;
      const m = M4.fromQuatPosScale(q, [f.x, f.y, f.z], [scale, scale, scale]);
      lifeInstanceWrite(out, count * 24, m, [f.color[0], f.color[1], f.color[2], 1], [f.phase, 1, 1, f.kind]);
      count++;
      if (count >= 96) break;
    }
    return count;
  }
  writeJellies(out) {
    let count = 0;
    for (const j of this.jellies) {
      const s = j.scale;
      const q = Q.fromEuler(Math.sin(this.time * .2 + j.phase) * .12, this.time * .1 + j.phase, Math.sin(this.time * .17 + j.phase) * .1);
      const m = M4.fromQuatPosScale(q, [j.x, j.y, j.z], [s, s, s]);
      lifeInstanceWrite(out, count * 24, m, [j.color[0], j.color[1], j.color[2], 1], [j.phase, 0, 0, 0]);
      count++;
      if (count >= 14) break;
    }
    return count;
  }
  writeGulls(out) {
    let count = 0;
    for (const g of this.gulls) {
      const q = Q.fromEuler(g.pitch, g.yaw, g.roll);
      const scale = .9;
      const m = M4.fromQuatPosScale(q, g.pos, [scale, scale, scale]);
      const flap = g.state === 'perched' ? .03 : g.flap;
      lifeInstanceWrite(out, count * 24, m, [1, 1, 1, 1], [g.wingPhase, flap, 0, 0]);
      count++;
      if (count >= 24) break;
    }
    return count;
  }
  writeParticles(out) {
    let count = 0;
    for (const p of this.particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      const alpha = p.mode === 2 ? .45 : .28 + (1 - a) * .22;
      const size = p.mode === 2 ? p.size : p.size * (1 + (1 - a) * 1.2);
      const o = count * 12;
      out[o] = p.x; out[o + 1] = p.y; out[o + 2] = p.z; out[o + 3] = 1;
      out[o + 4] = size; out[o + 5] = p.rot + this.time * .06; out[o + 6] = a; out[o + 7] = p.mode;
      out[o + 8] = p.color[0]; out[o + 9] = p.color[1]; out[o + 10] = p.color[2]; out[o + 11] = alpha * a;
      count++;
      if (count >= 600) break;
    }
    return count;
  }
  fishCount() { return this.fish.length; }
}