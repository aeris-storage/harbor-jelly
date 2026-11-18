import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const match = html.match(/<script id="harbor-core">([\s\S]*?)<\/script>/);
assert.ok(match, 'embedded harbor core exists');
const context = {};
vm.createContext(context);
vm.runInContext(match[1], context);
const C = context.HarborCore;

function run(seconds, options = {}) {
  const sim = C.create();
  const dt = 1 / 60;
  const frames = Math.round(seconds / dt);
  const collisions = new Map();
  const phases = [];
  let previousPhase = sim.phase;
  let cycleTime = null;
  let castTime = null;
  const events = [];
  for (let i = 0; i < frames; i++) {
    if (options.at && options.at[i]) options.at[i](sim, i * dt);
    C.step(sim, dt);
    for (const e of C.consumeEvents(sim)) {
      events.push({ t: sim.time, type: e.type, data: e.data });
      if (e.type === 'castoff' && castTime === null) castTime = sim.time;
      if (e.type === 'cycle' && cycleTime === null) cycleTime = sim.time;
    }
    const ds = C.diagnose(sim);
    for (const d of ds) {
      const key = JSON.stringify(d);
      collisions.set(key, (collisions.get(key) || 0) + 1);
    }
    if (sim.phase !== previousPhase) {
      phases.push({ t: +sim.time.toFixed(2), phase: sim.phase, status: C.phaseStatus(sim) });
      previousPhase = sim.phase;
    }
    for (const key of ['x', 'z', 'yaw']) assert.ok(Number.isFinite(sim.ship[key]), 'ship transform finite');
    for (const crane of sim.cranes) {
      assert.ok(Number.isFinite(crane.gantryZ) && Number.isFinite(crane.trolley) && Number.isFinite(crane.spreaderY), 'crane transform finite');
    }
  }
  return { sim, collisions, phases, events, cycleTime, castTime };
}

test('a full shift runs without collisions and completes near 100 seconds', () => {
  const result = run(115, {
    at: {
      360: (sim) => { C.command(sim, 'feed'); },
      420: (sim) => { C.command(sim, 'horn'); }
    }
  });
  const collisionList = [...result.collisions.keys()];
  assert.deepEqual(collisionList, [], 'no vessel/land/crane collisions');
  assert.ok(result.sim.stats.feeds >= 1, 'feeding was counted');
  assert.ok(result.sim.stats.moved >= 8, 'eight containers transferred');
  assert.ok(result.sim.stats.trips >= 1, 'at least one trip completed');
  assert.ok(result.cycleTime !== null, 'a new shift started');
  assert.ok(result.cycleTime > 90 && result.cycleTime < 112, 'cycle length is about 100 seconds, got ' + result.cycleTime);
  assert.equal(result.sim.cargo.every((c) => c.state === 'ship' || c.state === 'yard'), true);
  const horn = result.events.filter((e) => e.type === 'horn');
  assert.ok(horn.length >= 2, 'departure and user horn events exist');
  assert.ok(result.sim.events.length <= 80, 'event queue is bounded');
});

test('cast off lets the cranes finish their cargo and skips the rest of the shift', () => {
  let requested = false;
  const result = run(80, {
    at: {
      260: (sim) => { requested = C.command(sim, 'castoff'); }
    }
  });
  assert.equal(requested, true);
  assert.ok(result.events.some((e) => e.type === 'castoff'), 'cast-off transition happened');
  assert.ok(result.sim.stats.trips >= 1, 'trip completed after early departure');
  assert.ok(result.sim.stats.moved < 8, 'remaining yard lifts were skipped, moved=' + result.sim.stats.moved);
});

test('call her in accelerates the return but keeps the berthing safe', () => {
  const sim = C.create();
  let called = false;
  let atSea = false;
  let seaStart = 0;
  let berthed = 0;
  for (let i = 0; i < 60 * 125; i++) {
    C.step(sim, 1 / 60);
    if (!atSea && sim.phase === C.PHASE.ATSEA) { atSea = true; seaStart = sim.time; }
    if (atSea && !called && sim.time > seaStart + 2) {
      called = C.command(sim, 'callin');
      assert.equal(called, true);
    }
    if (called && berthed === 0 && sim.phase === C.PHASE.BERTHING) { berthed = sim.time; break; }
  }
  assert.ok(atSea && called && berthed > 0, 'returned to berth after call-in');
  assert.ok(berthed - seaStart < 30, 'urgent return was faster than the normal loop');
  assert.equal(C.diagnose(sim).length, 0, 'call-in path is clean');
});

test('every static floating object is separated', () => {
  const sim = C.create();
  const staticCollisions = C.diagnose(sim).filter((d) => d.type === 'vessel-pair');
  assert.equal(staticCollisions.length, 0);
  assert.equal(C.LAYOUT.fishingBoats.length, 2);
});