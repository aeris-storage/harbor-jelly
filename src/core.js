/* ============================================================
   HARBOR JELLY — deterministic port choreography core
   Pure JS, no DOM. Embedded in index.html and extracted by tests.
   ============================================================ */
(function (root) {
  'use strict';

  const CUBE = 2.6;
  const SEA_FLOOR = -1.32;
  const WATER_Y = 0.012;
  const DECK_Y = 0.108;
  const CONTAINER = { w: 0.074, h: 0.062, l: 0.178 };
  const CRANE = {
    railX: -0.9,
    baseY: 0.24,
    hingeY: 1.3,
    boomLen: 2.3,
    legSpanZ: 0.46,
    minGap: 0.62
  };
  const SHIP = { length: 1.48, beam: 0.46, halfL: 0.74, halfB: 0.23 };
  const BERTH = { x: 0.02, z: -0.18, yaw: 0 };
  const TUG_STANDBY = { x: 1.95, z: 1.12, yaw: Math.PI * 0.5 };

  const LAYOUT = {
    cube: CUBE,
    waterY: WATER_Y,
    seaFloor: SEA_FLOOR,
    berth: BERTH,
    ship: SHIP,
    tugStandby: TUG_STANDBY,
    terminal: { x0: -2.55, x1: -0.44, z0: -1.56, z1: 0.76, top: 0.25 },
    town: { x0: -2.58, x1: 2.58, z0: -2.58, z1: -1.53, top: 0.92 },
    fishQuay: { x0: 1.58, x1: 2.58, z0: -1.56, z1: 0.88, top: 0.22 },
    jetty: { x0: 1.43, x1: 1.62, z0: 0.34, z1: 0.78, top: 0.31 },
    breakwaterFront: { x0: -0.6, x1: 2.58, z0: 2.3, z1: 2.58, top: 0.3 },
    breakwaterRight: { x0: 2.3, x1: 2.58, z0: 0.9, z1: 2.58, top: 0.3 },
    lighthouse: { x: 2.03, z: 2.38 },
    sailboats: [
      { x: -0.18, z: 1.85, yaw: 0.62, name: 'mimosa' },
      { x: 1.3, z: 1.88, yaw: -0.44, name: 'petrel' }
    ],
    buoys: [
      { x: -0.3, z: 1.35, color: 'yellow', r: 0.085 },
      { x: 1.5, z: 1.55, color: 'yellow', r: 0.085 },
      { x: 2.12, z: 1.35, color: 'green', r: 0.1 }
    ],
    fishingBoats: [
      { x: 1.49, z: -0.53, yaw: 0.54 },
      { x: 1.50, z: -1.15, yaw: -0.68 }
    ]
  };

  const OBSTACLES = [
    { id: 'terminal', ...LAYOUT.terminal },
    { id: 'town', ...LAYOUT.town },
    { id: 'fish-quay', ...LAYOUT.fishQuay },
    { id: 'jetty', ...LAYOUT.jetty },
    { id: 'breakwater-front', ...LAYOUT.breakwaterFront },
    { id: 'breakwater-right', ...LAYOUT.breakwaterRight }
  ];

  const ROUTE = [
    [0.24, 0.23],
    [0.3, 0.55],
    [0.48, 1.04],
    [0.72, 1.12],
    [0.96, 0.82],
    [0.97, 0.42],
    [0.85, -0.05],
    [0.62, -0.48],
    [0.3, -0.5],
    [0.06, -0.18],
    [0.1, 0.18]
  ];

  const PHASE = Object.freeze({
    WORK: 'work',
    BOOMSUP: 'boomsup',
    TUG_IN: 'tug_in',
    TUG_PULL: 'tug_pull',
    RELEASE: 'release',
    ATSEA: 'atsea',
    BERTHING: 'berthing',
    BOOMSDOWN: 'boomsdown',
    SETTLE: 'settle'
  });

  const DURATION = {
    boomsup: 3.6,
    tug_in: 4.8,
    tug_pull: 5.2,
    release: 2.2,
    atsea: 34,
    berthing: 7,
    boomsdown: 2.6,
    settle: 1.2
  };

  const clock = { t: 0 };
  let uid = 1;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function easeInOut(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function approach(a, b, d) { return a < b ? Math.min(a + d, b) : Math.max(a - d, b); }
  function wrapAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
  function lerpAngle(a, b, t) { return a + wrapAngle(b - a) * t; }

  function routeSample(t) {
    t = clamp(t, 0, 1);
    const n = ROUTE.length;
    const u = t * (n - 1);
    let i = Math.floor(u);
    if (i >= n - 1) i = n - 2;
    const f = u - i;
    const p0 = ROUTE[Math.max(0, i - 1)];
    const p1 = ROUTE[i];
    const p2 = ROUTE[i + 1];
    const p3 = ROUTE[Math.min(n - 1, i + 2)];
    const f2 = f * f, f3 = f2 * f;
    const cx = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * f + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * f2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * f3);
    const cz = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * f + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * f2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * f3);
    const e = 0.001;
    const a = routeSamplePos(clamp(t - e, 0, 1));
    const b = routeSamplePos(clamp(t + e, 0, 1));
    return { x: cx, z: cz, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
  }
  function routeSamplePos(t) {
    t = clamp(t, 0, 1);
    const n = ROUTE.length;
    const u = t * (n - 1);
    let i = Math.floor(u);
    if (i >= n - 1) i = n - 2;
    const f = u - i;
    const p0 = ROUTE[Math.max(0, i - 1)];
    const p1 = ROUTE[i];
    const p2 = ROUTE[i + 1];
    const p3 = ROUTE[Math.min(n - 1, i + 2)];
    const f2 = f * f, f3 = f2 * f;
    return {
      x: 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * f + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * f2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * f3),
      z: 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * f + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * f2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * f3)
    };
  }

  function makeCargo() {
    const colors = [
      ['#b64b3f', 'Falu red'], ['#3d6d8f', 'Harbor blue'], ['#d7a53f', 'Ochre'],
      ['#4b8069', 'Pine'], ['#d67345', 'Signal orange'], ['#7d5e8c', 'Plum'],
      ['#c8b9a5', 'Bone'], ['#2f4d62', 'Slate']
    ];
    const shipSlots = [
      { bay: 0, row: 1, tier: 1 }, { bay: 1, row: 2, tier: 1 },
      { bay: 4, row: 1, tier: 1 }, { bay: 5, row: 2, tier: 1 }
    ];
    const yard = [
      { x: -1.74, z: -0.65, y: 0.305 }, { x: -1.72, z: -0.28, y: 0.305 },
      { x: -1.74, z: 0.08, y: 0.305 }, { x: -1.72, z: 0.44, y: 0.305 }
    ];
    const items = [];
    for (let i = 0; i < 8; i++) {
      const c = colors[i % colors.length];
      const slot = shipSlots[i % 4];
      items.push({
        id: 'cargo-' + (++uid),
        color: c[0], name: c[1],
        shipSlot: { bay: slot.bay, row: slot.row, tier: slot.tier },
        yardSlot: yard[i % 4],
        state: i < 4 ? 'ship' : 'yard',
        crane: -1,
        startState: i < 4 ? 'ship' : 'yard'
      });
    }
    return items;
  }

  function create() {
    const cranes = [0, 1].map((i) => ({
      id: i,
      name: i === 0 ? 'red' : 'blue',
      gantryZ: i === 0 ? -0.66 : 0.2,
      targetZ: i === 0 ? -0.66 : 0.2,
      trolley: i === 0 ? -0.3 : 0.35,
      targetTrolley: i === 0 ? -0.3 : 0.35,
      spreaderY: 0.92,
      targetSpreaderY: 0.92,
      boomAngle: 0.018,
      targetBoomAngle: 0.018,
      task: null,
      queue: [],
      carrying: null,
      carryingItem: null,
      status: 'idle',
      motion: 0
    }));
    const sim = {
      time: 0,
      phase: PHASE.WORK,
      phaseTime: 0,
      workMode: 'unloading',
      workDone: 0,
      cycle: 0,
      cycleMoved: 0,
      stats: { moved: 0, trips: 0, feeds: 0 },
      cranes,
      cargo: makeCargo(),
      ship: {
        x: BERTH.x, z: BERTH.z, yaw: BERTH.yaw, heave: 0, pitch: 0, roll: 0,
        speed: 0, routeT: 0, docked: true, yawRate: 0
      },
      tug: {
        x: TUG_STANDBY.x, z: TUG_STANDBY.z, yaw: TUG_STANDBY.yaw,
        thrust: 0, lineAttached: false, speed: 0
      },
      events: [],
      eventId: 1,
      castOffRequested: false,
      castOffPending: false,
      callInRequested: false,
      urgent: false,
      hornCount: 0,
      gullSpook: 0,
      steam: 1,
      mood: 'calm',
      lastStatus: '',
      routeProgress: 0,
      collisions: [],
      _transitionCargo: false
    };
    assignQueue(sim, sim.cargo.filter((c) => c.startState === 'ship'));
    return sim;
  }

  function emit(sim, type, data) {
    sim.events.push({ id: sim.eventId++, type, time: sim.time, data: data || {} });
    if (sim.events.length > 80) sim.events.splice(0, sim.events.length - 80);
  }

  function reset(sim) {
    const fresh = create();
    for (const k of Object.keys(sim)) delete sim[k];
    Object.assign(sim, fresh);
  }

  function command(sim, name) {
    if (name === 'horn') {
      sim.hornCount++;
      sim.gullSpook = 1;
      emit(sim, 'horn', { source: 'user', ship: sim.ship.docked });
      emit(sim, 'steam', { source: 'horn' });
      return true;
    }
    if (name === 'feed') {
      sim.stats.feeds++;
      sim.gullSpook = Math.max(sim.gullSpook, 0.75);
      emit(sim, 'feed', { x: 1.36, y: WATER_Y + 0.06, z: 1.2 });
      return true;
    }
    if (name === 'castoff') {
      if (sim.phase !== PHASE.WORK) return false;
      sim.castOffRequested = true;
      sim.castOffPending = true;
      return true;
    }
    if (name === 'callin') {
      if (sim.phase !== PHASE.ATSEA) return false;
      sim.callInRequested = true;
      sim.urgent = true;
      emit(sim, 'callin', { progress: sim.routeProgress });
      return true;
    }
    return false;
  }

  function moveShipToBerth(ship, dt) {
    ship.x = BERTH.x; ship.z = BERTH.z; ship.yaw = BERTH.yaw;
    ship.docked = true;
  }

  function shipMooringBob(sim) {
    const t = sim.time;
    const wake = clamp((sim.tug.thrust || 0) * 0.4, 0, 0.4);
    sim.ship.heave = Math.sin(t * 0.9) * 0.012 + Math.sin(t * 1.77 + 0.6) * 0.006 + wake;
    sim.ship.pitch = Math.sin(t * 0.72 + 1.1) * 0.006;
    sim.ship.roll = Math.sin(t * 0.83 + 0.2) * 0.005;
    sim.ship.speed = 0;
    sim.ship.yawRate = 0;
  }

  function shipAtSea(sim, dt) {
    const step = (dt / DURATION.atsea) * (sim.urgent ? 2.15 : 1);
    sim.routeProgress = clamp(sim.routeProgress + step, 0, 1);
    const p = routeSample(sim.routeProgress);
    const prevX = sim.ship.x, prevZ = sim.ship.z, prevYaw = sim.ship.yaw;
    sim.ship.x = p.x;
    sim.ship.z = p.z;
    sim.ship.yaw = wrapAngle(p.yaw);
    sim.ship.speed = Math.hypot(p.x - prevX, p.z - prevZ) / Math.max(dt, 1e-4);
    sim.ship.yawRate = wrapAngle(sim.ship.yaw - prevYaw) / Math.max(dt, 1e-4);
    sim.ship.docked = false;
    const speedNorm = clamp(sim.ship.speed / 0.24, 0, 1);
    sim.ship.heave = Math.sin(sim.time * 1.45) * (0.012 + speedNorm * 0.014);
    sim.ship.pitch = Math.sin(sim.time * 1.35 + 0.2) * (0.004 + speedNorm * 0.018);
    sim.ship.roll = Math.sin(sim.time * 1.1 + 1.4) * (0.006 + speedNorm * 0.022);
    if (sim.routeProgress >= 0.78 && !sim._comingInAnnounced) {
      sim._comingInAnnounced = true;
      emit(sim, 'arrive-soon', {});
    }
  }

  function setBoomTargets(cranes, angle) {
    for (const c of cranes) c.targetBoomAngle = angle;
  }

  function craneWorldPositions(c) {
    const hingeX = CRANE.railX;
    const hingeY = CRANE.baseY + (CRANE.hingeY - CRANE.baseY);
    const ca = Math.cos(c.boomAngle), sa = Math.sin(c.boomAngle);
    const trolleyX = hingeX + c.trolley * ca;
    const trolleyY = hingeY + c.trolley * sa;
    return {
      hingeX, hingeY,
      trolleyX, trolleyY,
      spreaderX: trolleyX,
      spreaderY: c.spreaderY,
      spreaderZ: c.gantryZ
    };
  }

  // Compute the world position of a deck container on the ship.
  function shipSlotPos(ship, slot) {
    const localX = -0.111 + slot.row * 0.074;
    const localZ = -0.63 + slot.bay * 0.214;
    const localY = DECK_Y + CONTAINER.h * 0.5 + slot.tier * CONTAINER.h;
    const cy = Math.cos(ship.yaw), sy = Math.sin(ship.yaw);
    return {
      x: ship.x + localX * cy + localZ * sy,
      y: localY + ship.heave + WATER_Y,
      z: ship.z - localX * sy + localZ * cy,
      yaw: ship.yaw
    };
  }

  function yardSlotPos(item) {
    return { x: item.yardSlot.x, y: item.yardSlot.y + CONTAINER.h * 0.5, z: item.yardSlot.z, yaw: 0 };
  }

  function cargoPickPlace(sim, crane, item, kind) {
    const shipPos = shipSlotPos(sim.ship, item.shipSlot);
    const yardPos = yardSlotPos(item);
    const pick = kind === 'unload' ? shipPos : yardPos;
    const place = kind === 'unload' ? yardPos : shipPos;
    const pickD = clamp((pick.x - CRANE.railX) / Math.cos(crane.boomAngle), -0.95, 1.4);
    const placeD = clamp((place.x - CRANE.railX) / Math.cos(crane.boomAngle), -0.95, 1.4);
    return {
      pick, place, pickD, placeD,
      pickY: pick.y + 0.055,
      placeY: place.y + 0.055
    };
  }

  const TASK_T = {
    gantryEnd: 1.05,
    trolleyOut: 2.15,
    lowerEnd: 3.4,
    lockEnd: 3.85,
    liftEnd: 4.95,
    traverseEnd: 6.4,
    placeEnd: 7.65,
    releaseEnd: 8.1,
    end: 9.0
  };

  function startTask(sim, crane, item, kind) {
    const cp = cargoPickPlace(sim, crane, item, kind);
    crane.task = {
      item, kind, cp,
      time: 0,
      startZ: crane.gantryZ,
      startD: crane.trolley,
      startY: crane.spreaderY,
      locked: false,
      released: false,
      status: kind + '-to-pick'
    };
    crane.status = kind;
    crane.carryingItem = null;
    item.crane = crane.id;
  }

  function updateCraneTask(sim, crane, dt) {
    const task = crane.task;
    if (!task) return;
    task.time += dt;
    const t = task.time;
    const cp = task.cp;
    // gantry travel
    const gt = smooth(t / TASK_T.gantryEnd);
    crane.targetZ = lerp(task.startZ, cp.pick.z, 0); // keep target explicit below
    crane.gantryZ = lerp(task.startZ, (cp.pick.z + cp.place.z) * 0.5, gt);
    // Avoid cranes sharing rail space. Idle / yielding crane is nudged away.
    enforceCraneGap(sim, crane);
    // trolley
    let d;
    if (t < 0.65) d = task.startD;
    else if (t < TASK_T.trolleyOut) d = lerp(task.startD, cp.pickD, smooth((t - 0.65) / (TASK_T.trolleyOut - 0.65)));
    else if (t < TASK_T.traverseEnd - 1.45) d = cp.pickD;
    else if (t < TASK_T.traverseEnd) d = lerp(cp.pickD, cp.placeD, smooth((t - (TASK_T.traverseEnd - 1.45)) / 1.45));
    else d = cp.placeD;
    crane.trolley = d;
    crane.targetTrolley = d;
    // spreader vertical
    let sy = crane.spreaderY;
    if (t < 1.9) sy = task.startY;
    else if (t < TASK_T.lowerEnd) sy = lerp(task.startY, cp.pickY, smooth((t - 1.9) / (TASK_T.lowerEnd - 1.9)));
    else if (t < TASK_T.liftEnd) sy = lerp(cp.pickY, 0.91, smooth((t - TASK_T.lockEnd) / (TASK_T.liftEnd - TASK_T.lockEnd)));
    else if (t < TASK_T.placeEnd - 1.15) sy = 0.91;
    else if (t < TASK_T.placeEnd) sy = lerp(0.91, cp.placeY, smooth((t - (TASK_T.placeEnd - 1.15)) / 1.15));
    else if (t < TASK_T.releaseEnd) sy = cp.placeY;
    else sy = lerp(cp.placeY, 0.9, smooth((t - TASK_T.releaseEnd) / (TASK_T.end - TASK_T.releaseEnd)));
    crane.spreaderY = sy;
    crane.targetSpreaderY = sy;

    if (!task.locked && t >= TASK_T.lockEnd - 0.25) {
      // Track the heaving ship while the spreader settles over the top tier.
      if (task.kind === 'unload') {
        const adjust = (sim.ship.heave - 0) * 0.55;
        if (t < TASK_T.lockEnd) crane.spreaderY = sy + adjust;
      }
    }
    if (!task.locked && t >= TASK_T.lockEnd) {
      task.locked = true;
      task.item.state = 'carrying';
      task.item.crane = crane.id;
      crane.carrying = task.item;
      crane.carryingItem = task.item;
      crane.status = 'lifting';
      if (task.kind === 'unload') {
        emit(sim, 'lock', { crane: crane.id, cargo: task.item.id });
      }
    }
    if (task.locked && !task.released) {
      const carried = task.item;
      const pose = carriedPose(sim, crane);
      carried.world = pose;
      if (t >= TASK_T.releaseEnd && task.kind === 'unload') {
        // stay carried until the place position; release is below
      }
      if (t >= TASK_T.releaseEnd) {
        task.released = true;
        crane.carrying = null;
        crane.status = 'returning';
        if (task.kind === 'unload') {
          task.item.state = 'yard';
          task.item.yardPos = { ...cp.place };
          // Slight nested appearance on a low transfer stack.
          task.item.yardPos.y = cp.place.y;
          emit(sim, 'unlock', { crane: crane.id, cargo: task.item.id });
        } else {
          task.item.state = 'ship';
          task.item.shipPos = { ...cp.place };
          emit(sim, 'unlock', { crane: crane.id, cargo: task.item.id });
        }
        task.item.crane = -1;
        sim.cycleMoved++;
        sim.stats.moved++;
        emit(sim, 'move-complete', { crane: crane.id, moved: sim.cycleMoved, kind: task.kind });
      }
    }
    if (t >= TASK_T.end) {
      crane.task = null;
      crane.status = 'idle';
      crane.targetZ = crane.gantryZ;
    }
  }

  function carriedPose(sim, crane) {
    const w = craneWorldPositions(crane);
    return {
      x: w.spreaderX,
      y: w.spreaderY - 0.055,
      z: w.spreaderZ,
      yaw: sim.ship.docked ? 0 : sim.ship.yaw
    };
  }

  function enforcedGapAmount(crane, other) {
    return Math.abs(crane.gantryZ - other.gantryZ);
  }
  function enforceCraneGap(sim, crane) {
    const other = sim.cranes[1 - crane.id];
    const gap = enforcedGapAmount(crane, other);
    if (gap < CRANE.minGap) {
      const dir = Math.sign(crane.gantryZ - other.gantryZ) || (crane.id === 0 ? -1 : 1);
      crane.gantryZ = other.gantryZ + dir * CRANE.minGap;
    }
    crane.gantryZ = clamp(crane.gantryZ, -1.48, 0.62);
  }

  function workQueue(sim) {
    const unload = sim.cargo.filter((c) => c.startState === 'ship');
    const load = sim.cargo.filter((c) => c.startState === 'yard');
    return { unload, load };
  }

  function beginWorkPhase(sim) {
    const q = workQueue(sim);
    if (sim.workMode === 'unloading') {
      assignQueue(sim, q.unload);
    } else {
      assignQueue(sim, q.load);
    }
  }
  function assignQueue(sim, items) {
    // keep each crane on its own half of the ship: red aft, blue forward.
    for (const c of sim.cranes) { c.queue = []; c.task = null; c.status = 'idle'; }
    items.forEach((item, i) => {
      sim.cranes[i < 2 ? 0 : 1].queue.push(item);
    });
  }

  function updateWork(sim, dt) {
    if (sim.castOffRequested) {
      for (const c of sim.cranes) c.queue.length = 0;
    }
    const anyTask = sim.cranes.some((c) => c.task);
    // Start tasks if the current queue has work and the request hasn't stopped new lifts yet.
    for (const c of sim.cranes) {
      if (!c.task && c.queue.length > 0 && !(sim.castOffRequested && sim.castOffPending)) {
        const item = c.queue.shift();
        // Do not start a task until the two gantries have safe separation.
        const other = sim.cranes[1 - c.id];
        if (!other.task || Math.abs(c.gantryZ - other.gantryZ) > CRANE.minGap * 0.8) {
          startTask(sim, c, item, sim.workMode === 'unloading' ? 'unload' : 'load');
        } else {
          c.queue.unshift(item);
        }
      }
      updateCraneTask(sim, c, dt);
    }
    // crane spacing + smooth boom
    for (const c of sim.cranes) {
      c.boomAngle = lerp(c.boomAngle, c.targetBoomAngle, 1 - Math.exp(-dt * 4));
    }
    // ship bobbing while alongside
    shipMooringBob(sim);
    // tug idles at standby
    updateTug(sim, dt);
    const allIdle = sim.cranes.every((c) => !c.task && c.queue.length === 0);
    if (sim.workMode === 'unloading' && allIdle) {
      const nextLoadItems = sim.cargo.filter((c) => c.startState === 'yard');
      if (sim.castOffRequested) {
        transition(sim, PHASE.BOOMSUP);
        return;
      }
      sim.workMode = 'loading';
      sim.workDone = 0;
      sim.phaseTime = 0;
      emit(sim, 'loading', {});
      assignQueue(sim, nextLoadItems);
      return;
    }
    if (sim.workMode === 'loading' && allIdle) {
      if (!sim._workSettled) sim._workSettled = true;
      sim.phaseTime += dt;
      if (sim.phaseTime > 1.25 || sim.castOffRequested) {
        transition(sim, PHASE.BOOMSUP);
      }
    }
    if (sim.castOffRequested && sim.castOffPending && allIdle) {
      sim.castOffPending = false;
      transition(sim, PHASE.BOOMSUP);
    }
  }

  function transition(sim, next) {
    sim.phase = next;
    sim.phaseTime = 0;
    sim._workSettled = false;
    if (next === PHASE.BOOMSUP) {
      setBoomTargets(sim.cranes, 0.52);
      for (const c of sim.cranes) {
        c.queue = [];
        c.targetTrolley = 0.25;
        c.status = 'stowed';
      }
      emit(sim, 'booms-up', {});
    }
    if (next === PHASE.TUG_IN) {
      emit(sim, 'tug-in', {});
    }
    if (next === PHASE.RELEASE) {
      emit(sim, 'horn', { source: 'departure' });
      emit(sim, 'steam', { source: 'departure' });
      sim.hornCount++;
      sim.gullSpook = 1;
      sim.tug.lineAttached = false;
      sim.ship.docked = false;
      emit(sim, 'castoff', {});
    }
    if (next === PHASE.ATSEA) {
      sim.routeProgress = 0;
      sim._comingInAnnounced = false;
      sim.ship.docked = false;
      emit(sim, 'atsea', {});
    }
    if (next === PHASE.BERTHING) {
      emit(sim, 'berthing', {});
    }
    if (next === PHASE.BOOMSDOWN) {
      setBoomTargets(sim.cranes, 0.018);
      emit(sim, 'booms-down', {});
    }
    if (next === PHASE.SETTLE) {
      sim.phaseTime = 0;
    }
  }

  function pathPoint(points, k) {
    k = clamp(k, 0, 1);
    const u = k * (points.length - 1);
    let i = Math.floor(u);
    if (i >= points.length - 1) i = points.length - 2;
    const f = smooth(u - i);
    return {
      x: lerp(points[i][0], points[i + 1][0], f),
      z: lerp(points[i][1], points[i + 1][1], f)
    };
  }

  function updateTug(sim, dt) {
    const tug = sim.tug;
    const t = sim.phaseTime;
    let tx = TUG_STANDBY.x, tz = TUG_STANDBY.z, yaw = TUG_STANDBY.yaw, thrust = 0;
    const phase = sim.phase;
    let spd = 0;
    if (phase === PHASE.WORK || phase === PHASE.BOOMSUP) {
      tx = TUG_STANDBY.x + Math.sin(sim.time * 0.5) * 0.02;
      tz = TUG_STANDBY.z + Math.cos(sim.time * 0.42) * 0.02;
      yaw = TUG_STANDBY.yaw;
    } else if (phase === PHASE.TUG_IN) {
      const k = smooth(t / DURATION.tug_in);
      tx = lerp(TUG_STANDBY.x + Math.sin(sim.phaseTime) * 0.0, 0.52, k);
      tz = lerp(TUG_STANDBY.z, 1.02, k);
      yaw = lerp(TUG_STANDBY.yaw, Math.PI, smooth(k * 1.1));
      thrust = k > 0.8 ? 0.15 : 0.6;
      if (k > 0.98) tug.lineAttached = true;
    } else if (phase === PHASE.TUG_PULL) {
      const k = smooth(t / DURATION.tug_pull);
      tx = lerp(0.52, 1.23, k);
      tz = lerp(1.02, 1.56, k);
      yaw = Math.PI + 0.25 + k * 0.18;
      thrust = 0.85;
      // ship pulls her bow away from the quay
      const s = smooth(clamp(t / DURATION.tug_pull, 0, 1));
      sim.ship.x = lerp(0.04, 0.23, s);
      sim.ship.z = lerp(-0.05, 0.22, s);
      sim.ship.yaw = lerp(0.02, 0.46, s);
      sim.ship.docked = false;
      sim.ship.heave = Math.sin(sim.time * 1.2) * 0.014;
      sim.ship.pitch = -0.01 + s * 0.012;
      sim.ship.roll = Math.sin(sim.time * 0.9) * 0.008;
    } else if (phase === PHASE.RELEASE) {
      const k = smooth(t / DURATION.release);
      tx = lerp(1.23, 1.56, k);
      tz = lerp(1.56, 1.42, k);
      yaw = lerp(Math.PI + 0.43, Math.PI * 1.62, k);
      thrust = 0.3;
      tug.lineAttached = false;
    } else if (phase === PHASE.ATSEA) {
      const k = smooth(clamp(t / 3.2, 0, 1));
      tx = lerp(1.56, TUG_STANDBY.x, k);
      tz = lerp(1.42, TUG_STANDBY.z, k);
      yaw = lerp(Math.PI * 1.62, TUG_STANDBY.yaw, k);
      thrust = k < 0.7 ? 0.4 : 0.08;
    } else if (phase === PHASE.BERTHING) {
      // Tug waits off the starboard quarter, rounds the jetty, then nuzzles in and pushes.
      const k = smooth(t / DURATION.berthing);
      const toSide = smooth(clamp(t / 3.5, 0, 1));
      const push = smooth(clamp((t - 3.8) / 2.6, 0, 1));
      const path = [[TUG_STANDBY.x, TUG_STANDBY.z], [1.62, 1.12], [1.28, 1.08], [.94, .55], [.64, .06]];
      const p = pathPoint(path, toSide);
      tx = p.x + push * 0.11;
      tz = p.z;
      yaw = lerp(TUG_STANDBY.yaw, Math.PI * 1.5, smooth(toSide));
      thrust = 0.2 + push * 0.8;
      // push the ship's starboard side toward the quay, then settle at berth
      const bp = easeInOut(clamp(t / DURATION.berthing, 0, 1));
      const end = routeSample(1);
      sim.ship.x = lerp(end.x, BERTH.x, bp) - push * 0.01;
      sim.ship.z = lerp(end.z, BERTH.z, bp);
      sim.ship.yaw = lerp(end.yaw, BERTH.yaw, bp);
      sim.ship.docked = bp > 0.96;
      sim.ship.heave = Math.sin(sim.time * 1.0) * 0.013;
      sim.ship.pitch = Math.sin(sim.time * 0.8) * 0.006;
      sim.ship.roll = Math.sin(sim.time * 0.9 + 1) * 0.006;
      if (k > 0.96) thrust = 0.05;
    } else if (phase === PHASE.BOOMSDOWN) {
      const k = smooth(clamp(t / DURATION.boomsdown, 0, 1));
      const path = [[.64, .06], [.94, .55], [1.28, 1.08], [1.62, 1.12], [TUG_STANDBY.x, TUG_STANDBY.z]];
      const p = pathPoint(path, k);
      tx = p.x; tz = p.z;
      yaw = lerp(Math.PI * 1.5, TUG_STANDBY.yaw, k);
      thrust = k < 0.6 ? 0.25 : 0.03;
      sim.ship.x = lerp(BERTH.x, BERTH.x, k);
      sim.ship.z = lerp(BERTH.z, BERTH.z, k);
      sim.ship.yaw = BERTH.yaw;
      sim.ship.docked = true;
      shipMooringBob(sim);
    } else if (phase === PHASE.SETTLE) {
      tx = TUG_STANDBY.x; tz = TUG_STANDBY.z; yaw = TUG_STANDBY.yaw;
      shipMooringBob(sim);
    }
    // Smooth all channels (except phases that directly drive the ship).
    const blend = 1 - Math.exp(-dt * 3.3);
    const px = tug.x, pz = tug.z;
    tug.x = tx; tug.z = tz;
    tug.yaw = lerpAngle(tug.yaw, yaw, 1 - Math.exp(-dt * 2.6));
    tug.thrust = lerp(tug.thrust, thrust, 1 - Math.exp(-dt * 2.5));
    tug.speed = Math.hypot(tug.x - px, tug.z - pz) / Math.max(dt, 0.0001);
  }

  function updateCranesIdle(sim, dt) {
    for (const c of sim.cranes) {
      c.boomAngle = lerp(c.boomAngle, c.targetBoomAngle, 1 - Math.exp(-dt * 2.2));
      c.motion = Math.abs(c.boomAngle - c.targetBoomAngle) * 2;
      if (!c.task) {
        c.targetTrolley = c.targetTrolley === undefined ? 0.25 : c.targetTrolley;
        c.trolley = lerp(c.trolley, c.targetTrolley, 1 - Math.exp(-dt * 2.5));
        c.spreaderY = lerp(c.spreaderY, 0.9, 1 - Math.exp(-dt * 1.5));
        c.motion += Math.abs(c.trolley - c.targetTrolley);
      }
    }
  }

  function phaseStatus(sim) {
    const cranesBusy = sim.cranes.some((c) => c.carrying || c.task);
    switch (sim.phase) {
      case PHASE.WORK:
        if (sim.workMode === 'unloading') return 'Unloading ' + clamp(sim.cycleMoved, 0, 8) + ' / 8';
        return 'Loading ' + clamp(sim.cycleMoved, 0, 8) + ' / 8';
      case PHASE.BOOMSUP: return 'Booms up';
      case PHASE.TUG_IN: return 'Tug coming';
      case PHASE.TUG_PULL: return 'Casting off';
      case PHASE.RELEASE: return 'Casting off';
      case PHASE.ATSEA:
        if (sim.urgent || sim.callInRequested || sim.routeProgress > .86) return 'Coming in';
        return 'At sea ' + Math.round(sim.routeProgress * 100) + '%';
      case PHASE.BERTHING: return 'Berthing';
      case PHASE.BOOMSDOWN: return 'Booms down';
      case PHASE.SETTLE: return 'Alongside';
      default: return 'Alongside';
    }
  }

  function buttonState(sim) {
    if (sim.phase === PHASE.ATSEA) {
      return { label: 'Call her in', disabled: sim.urgent, mode: 'callin' };
    }
    if (sim.phase === PHASE.WORK) {
      return { label: 'Cast off', disabled: false, mode: 'castoff' };
    }
    return { label: 'Cast off', disabled: true, mode: 'castoff' };
  }

  function activity(sim) {
    let a = 0.18;
    for (const c of sim.cranes) {
      if (c.task) a = Math.max(a, 0.55);
      if (c.carrying) a = Math.max(a, 0.85);
    }
    if (sim.phase === PHASE.ATSEA) a = Math.max(a, 0.45 + Math.sin(sim.time * 0.7) * 0.12);
    if (sim.phase === PHASE.TUG_PULL || sim.phase === PHASE.BERTHING) a = Math.max(a, 0.9);
    if (sim.tug.thrust > 0.5) a = Math.max(a, 0.75);
    return clamp(a, 0, 1);
  }

  function step(sim, dt) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.05);
    sim.time += dt;
    sim.phaseTime += dt;
    sim.gullSpook = Math.max(0, sim.gullSpook - dt * 0.22);
    // Cargo events travel around; keep world transforms fresh.
    updateCargoWorld(sim);

    switch (sim.phase) {
      case PHASE.WORK:
        updateWork(sim, dt);
        updateCranesIdle(sim, dt);
        break;
      case PHASE.BOOMSUP:
        updateCranesIdle(sim, dt);
        updateTug(sim, dt);
        shipMooringBob(sim);
        if (sim.phaseTime >= DURATION.boomsup) transition(sim, PHASE.TUG_IN);
        break;
      case PHASE.TUG_IN:
        updateCranesIdle(sim, dt);
        updateTug(sim, dt);
        shipMooringBob(sim);
        if (sim.phaseTime >= DURATION.tug_in) transition(sim, PHASE.TUG_PULL);
        break;
      case PHASE.TUG_PULL:
        updateTug(sim, dt);
        updateCranesIdle(sim, dt);
        if (sim.phaseTime >= DURATION.tug_pull) transition(sim, PHASE.RELEASE);
        break;
      case PHASE.RELEASE:
        updateTug(sim, dt);
        updateCranesIdle(sim, dt);
        if (sim.phaseTime >= DURATION.release) transition(sim, PHASE.ATSEA);
        break;
      case PHASE.ATSEA:
        updateTug(sim, dt);
        updateCranesIdle(sim, dt);
        shipAtSea(sim, dt);
        if (sim.routeProgress >= 1) transition(sim, PHASE.BERTHING);
        break;
      case PHASE.BERTHING:
        updateTug(sim, dt);
        updateCranesIdle(sim, dt);
        if (sim.phaseTime >= DURATION.berthing) {
          sim.ship.x = BERTH.x; sim.ship.z = BERTH.z; sim.ship.yaw = BERTH.yaw;
          sim.ship.docked = true;
          transition(sim, PHASE.BOOMSDOWN);
          emit(sim, 'berthed', {});
        }
        break;
      case PHASE.BOOMSDOWN:
        updateCranesIdle(sim, dt);
        updateTug(sim, dt);
        if (sim.phaseTime >= DURATION.boomsdown) transition(sim, PHASE.SETTLE);
        break;
      case PHASE.SETTLE:
        updateCranesIdle(sim, dt);
        updateTug(sim, dt);
        if (sim.phaseTime >= DURATION.settle) {
          sim.phase = PHASE.WORK;
          sim.phaseTime = 0;
          sim.workMode = 'unloading';
          sim.workDone = 0;
          sim.cycleMoved = 0;
          sim.cycle++;
          sim.stats.trips++;
          sim.castOffRequested = false;
          sim.castOffPending = false;
          sim.callInRequested = false;
          sim.urgent = false;
          resetCargo(sim);
          sim.cranes.forEach((c) => { c.queue = []; c.task = null; c.status = 'idle'; c.targetBoomAngle = 0.018; });
          assignQueue(sim, sim.cargo.filter((c) => c.startState === 'ship'));
          emit(sim, 'cycle', { cycle: sim.cycle });
        }
        break;
    }
    updateCargoWorld(sim);
    sim.lastStatus = phaseStatus(sim);
  }

  function resetCargo(sim) {
    sim.cargo = makeCargo();
  }

  function updateCargoWorld(sim) {
    for (const item of sim.cargo) {
      if (item.state === 'ship') {
        const p = shipSlotPos(sim.ship, item.shipSlot);
        item.world = p;
      } else if (item.state === 'yard') {
        const p = item.yardPos || yardSlotPos(item);
        item.world = { x: p.x, y: p.y, z: p.z, yaw: 0 };
      }
      // carrying world is refreshed by updateCraneTask / carriedPose
    }
  }

  function consumeEvents(sim) {
    const ev = sim.events.slice();
    sim.events.length = 0;
    return ev;
  }

  // Collision diagnostics shared by the headless tests.
  function pointInExpandedBox(x, z, box, pad) {
    return x > box.x0 - pad && x < box.x1 + pad && z > box.z0 - pad && z < box.z1 + pad;
  }
  function shipOutline(ship, pad) {
    const cy = Math.cos(ship.yaw), sy = Math.sin(ship.yaw);
    const pts = [];
    const hb = SHIP.halfB + (pad || 0);
    const hl = SHIP.halfL + (pad || 0);
    // Tapered hull plan: broad stern, fine entry at the bow.
    const local = [
      [-hb, -hl * 0.92], [hb, -hl * 0.92],
      [hb, hl * 0.48], [hb * 0.55, hl * 0.8], [0, hl], [-hb * 0.55, hl * 0.8], [-hb, hl * 0.48],
      [-hb * 0.5, -hl * 0.92], [hb * 0.5, -hl * 0.92],
      [-hb, -hl * 0.2], [hb, -hl * 0.2],
      [-hb, hl * 0.2], [hb, hl * 0.2],
      [-hb * 0.55, hl * 0.8], [0, hl], [hb * 0.55, hl * 0.8]
    ];
    for (const [lx, lz] of local) {
      pts.push({ x: ship.x + lx * cy + lz * sy, z: ship.z - lx * sy + lz * cy });
    }
    return pts;
  }
  function circleHitsShip(px, pz, r, ship) {
    const dx = px - ship.x, dz = pz - ship.z;
    const cy = Math.cos(ship.yaw), sy = Math.sin(ship.yaw);
    // world -> local (rotate by -yaw, careful with mapping used everywhere)
    const lx = dx * cy - dz * sy;
    const lz = dx * sy + dz * cy;
    const bx = Math.max(-SHIP.halfB, Math.min(SHIP.halfB, lx));
    const bz = Math.max(-SHIP.halfL, Math.min(SHIP.halfL, lz));
    return Math.hypot(lx - bx, lz - bz) < r;
  }
  function diagnose(sim) {
    const out = [];
    const ship = sim.ship;
    for (const pt of shipOutline(ship, 0.018)) {
      for (const box of OBSTACLES) {
        if (pointInExpandedBox(pt.x, pt.z, box, 0)) out.push({ type: 'ship-land', obstacle: box.id, x: pt.x, z: pt.z });
      }
    }
    // other vessels: sailboats as circles, tug as circle
    const others = [
      ...LAYOUT.sailboats.map((b, i) => ({ id: 'sailboat-' + i, x: b.x, z: b.z, r: 0.14 })),
      ...LAYOUT.fishingBoats.map((b, i) => ({ id: 'fishing-' + i, x: b.x, z: b.z, r: 0.13 })),
      ...LAYOUT.buoys.map((b, i) => ({ id: 'buoy-' + i, x: b.x, z: b.z, r: b.r + 0.05 }))
    ];
    if (ship.docked) {
      // while alongside the tug stays clear of the hull
      if (circleHitsShip(sim.tug.x, sim.tug.z, 0.18, ship) && sim.phase === PHASE.WORK) out.push({ type: 'tug-ship', phase: sim.phase });
    }
    for (const o of others) {
      if (circleHitsShip(o.x, o.z, o.r, ship)) out.push({ type: 'ship-' + o.id });
    }
    if (Math.abs(sim.tug.x - ship.x) < 0.7 && Math.abs(sim.tug.z - ship.z) < 0.6) {
      if (circleHitsShip(sim.tug.x, sim.tug.z, 0.16, ship)) out.push({ type: 'tug-ship' });
    }
    for (const b of [...LAYOUT.sailboats, ...LAYOUT.fishingBoats]) {
      if (Math.hypot(b.x - sim.tug.x, b.z - sim.tug.z) < 0.3) out.push({ type: 'tug-other' });
    }
    // tug must also stay clear of every landmass
    for (const box of OBSTACLES) {
      if (pointInExpandedBox(sim.tug.x, sim.tug.z, box, 0.16)) out.push({ type: 'tug-land', obstacle: box.id, x: sim.tug.x, z: sim.tug.z });
    }
    // static floating things should not overlap each other either
    for (let i = 0; i < others.length; i++) for (let j = i + 1; j < others.length; j++) {
      const a = others[i], b = others[j];
      if (Math.hypot(a.x - b.x, a.z - b.z) < a.r + b.r) out.push({ type: 'vessel-pair', a: a.id, b: b.id });
    }
    // cranes
    if (Math.abs(sim.cranes[0].gantryZ - sim.cranes[1].gantryZ) < CRANE.minGap - 0.02) {
      out.push({ type: 'crane-gap', gap: Math.abs(sim.cranes[0].gantryZ - sim.cranes[1].gantryZ) });
    }
    // bounds
    for (const p of shipOutline(ship, 0.01)) {
      if (p.x < -CUBE || p.x > CUBE || p.z < -CUBE || p.z > CUBE) out.push({ type: 'ship-bounds', x: p.x, z: p.z });
    }
    // nan
    for (const key of ['x', 'z', 'yaw']) if (!Number.isFinite(ship[key])) out.push({ type: 'nan-ship-' + key });
    for (const c of sim.cranes) if (!Number.isFinite(c.gantryZ) || !Number.isFinite(c.trolley)) out.push({ type: 'nan-crane' });
    return out;
  }

  root.HarborCore = {
    PHASE, LAYOUT, ROUTE, DURATION, CRANE, SHIP, BERTH, TUG_STANDBY, OBSTACLES,
    CONTAINER, WATER_Y, SEA_FLOOR,
    create, step, command, reset, phaseStatus, buttonState, activity,
    consumeEvents, diagnose, shipOutline, shipSlotPos, yardSlotPos, routeSample,
    craneWorldPositions, carriedPose
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);