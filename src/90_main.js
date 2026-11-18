/* ============================================================
   Boot the harbor
   ============================================================ */
const app = {
  paused: false,
  soundEnabled: true,
  paletteKey: 'sea',
  palette: PALETTES.sea,
  firmness: .78,
  damping: .34,
  tide: 0,
  tiltX: 0,
  tiltZ: 0,
  tiltVelX: 0,
  tiltVelZ: 0,
  time: 0,
  acc: 0,
  fps: 60,
  simMs: 0,
  dragging: false,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  foamBursts: [],
  foamSources: [],
  objects: null,
  prevShip: { x: 0, z: 0 },
  prevTug: { x: 0, z: 0 }
};

const runtime = {
  ready: false,
  error: null,
  app,
  renderer: null,
  sim: null,
  water: null,
  life: null,
  fps: 0,
  simMs: 0
};
window.__harbor = runtime;

function showFallback(message) {
  const loading = document.getElementById('loading');
  const fallback = document.getElementById('fallback');
  if (loading) loading.hidden = true;
  if (fallback) fallback.hidden = false;
  const pill = document.getElementById('status-pill');
  const label = document.getElementById('status-text');
  if (pill) pill.classList.add('offline');
  if (label) label.textContent = 'WebGPU · unavailable';
  runtime.ready = false;
  runtime.error = message || 'WebGPU unavailable';
  const controls = document.querySelectorAll('.panel button, .panel input');
  controls.forEach((el) => { el.disabled = true; });
}

function processEvents() {
  const events = HarborCore.consumeEvents(app.sim);
  for (const ev of events) {
    if (ev.type === 'horn') {
      if (app.soundEnabled && app.audio) app.audio.horn();
      app.life.spookGulls();
      app.foamBursts.push({ x: app.sim.ship.x, z: app.sim.ship.z, age: 0, life: 1.2, size: .3 });
    } else if (ev.type === 'feed') {
      app.life.feed();
      app.water.addSplash(1.33, 1.22, .022, .13);
      app.foamBursts.push({ x: 1.33, z: 1.22, age: 0, life: 1.4, size: .34 });
    } else if (ev.type === 'castoff') {
      if (app.ui) app.ui.toast('Lines away');
    } else if (ev.type === 'berthed') {
      if (app.ui) app.ui.toast('Alongside');
    } else if (ev.type === 'cycle') {
      if (app.ui) app.ui.toast('New shift');
    }
  }
}

function updateTiltSpring(dt) {
  const k = 15.5, c = 3.1;
  app.tiltVelX += (-app.tiltX * k - app.tiltVelX * c) * dt;
  app.tiltVelZ += (-app.tiltZ * k - app.tiltVelZ * c) * dt;
  app.tiltX = clamp(app.tiltX + app.tiltVelX * dt, -.14, .14);
  app.tiltZ = clamp(app.tiltZ + app.tiltVelZ * dt, -.14, .14);
}

function tiltQuaternion() {
  return Q.mul(Q.axisAngle([1, 0, 0], app.tiltX), Q.axisAngle([0, 0, 1], app.tiltZ));
}

function waterLevel() { return HarborCore.WATER_Y + app.tide; }

function addVesselWakes(dt) {
  const sim = app.sim;
  const sx = sim.ship.x, sz = sim.ship.z;
  const dx = sx - app.prevShip.x, dz = sz - app.prevShip.z;
  const shipSpeed = Math.hypot(dx, dz) / Math.max(dt, .001);
  app.prevShip.x = sx; app.prevShip.z = sz;
  if (shipSpeed > .01) {
    const nx = dx / Math.max(Math.hypot(dx, dz), .001), nz = dz / Math.max(Math.hypot(dx, dz), .001);
    app.water.addWake(sx, sz, nx, nz, Math.min(shipSpeed, .45), .32, .65);
  }
  const tx = sim.tug.x, tz = sim.tug.z;
  const tdx = tx - app.prevTug.x, tdz = tz - app.prevTug.z;
  const tugSpeed = Math.hypot(tdx, tdz) / Math.max(dt, .001);
  app.prevTug.x = tx; app.prevTug.z = tz;
  if (tugSpeed > .01 || sim.tug.thrust > .3) {
    const inv = 1 / Math.max(Math.hypot(tdx, tdz), .001);
    app.water.addWake(tx, tz, tdx * inv, tdz * inv, Math.max(.04, Math.min(tugSpeed, .25)), .2, .5 + sim.tug.thrust * .5);
  }
}

function makeFoamSources() {
  const sim = app.sim;
  const sources = [];
  const dirFromYaw = (yaw) => [Math.sin(yaw), Math.cos(yaw)];
  const speed = Math.min(1, Math.hypot(sim.ship.x - app.prevShip.x, sim.ship.z - app.prevShip.z) * 32 + sim.ship.speed * 2.5);
  const shipDir = speed > .04 ? [Math.sin(sim.ship.yaw), Math.cos(sim.ship.yaw)] : dirFromYaw(sim.ship.yaw);
  sources.push({ x: sim.ship.x, z: sim.ship.z, radius: .28, strength: .42 + speed * .5, dx: shipDir[0], dz: shipDir[1], speed, type: 0 });
  sources.push({ x: sim.ship.x, z: sim.ship.z, radius: .16, strength: .3, dx: shipDir[0], dz: shipDir[1], speed: speed * .6, type: 1 });
  const tugSpeed = Math.min(1, sim.tug.thrust * .8 + sim.tug.speed * 2);
  sources.push({ x: sim.tug.x, z: sim.tug.z, radius: .18, strength: .32 + tugSpeed * .4, dx: Math.sin(sim.tug.yaw), dz: Math.cos(sim.tug.yaw), speed: tugSpeed, type: 0 });
  for (const b of HarborCore.LAYOUT.sailboats) sources.push({ x: b.x, z: b.z, radius: .14, strength: .16, dx: 0, dz: 0, speed: 0, type: 2 });
  for (const b of HarborCore.LAYOUT.fishingBoats) sources.push({ x: b.x, z: b.z, radius: .13, strength: .18, dx: 0, dz: 0, speed: 0, type: 2 });
  for (const b of HarborCore.LAYOUT.buoys) sources.push({ x: b.x, z: b.z, radius: .075, strength: .12, dx: 0, dz: 0, speed: 0, type: 2 });
  for (const f of app.foamBursts) {
    if (sources.length >= 15) break;
    sources.push({ x: f.x, z: f.z, radius: f.size, strength: .55 * (f.age < f.life ? 1 - f.age / f.life : 0), dx: 0, dz: 0, speed: 0, type: 2 });
  }
  return sources;
}


// A deterministic way for the end-to-end suite to inspect later stages of the day.
app.advance = function (seconds) {
  const wasPaused = app.paused;
  app.paused = true;
  const step = 1 / 60;
  const count = Math.max(1, Math.round(seconds / step));
  for (let i = 0; i < count; i++) {
    HarborCore.step(app.sim, step);
    processEvents();
    app.time += step;
    app.foamBursts = app.foamBursts.filter((f) => { f.age += step; return f.age < f.life; });
    addVesselWakes(step);
    app.water.step(step, { firmness: app.firmness, damping: app.damping, tiltX: app.tiltX, tiltZ: app.tiltZ });
    app.objects = updateObjectTransforms(app.sim, app.water, app.tide, app.time, app.life.ring);
    app.life.update(step, app.time, {
      sim: app.sim, objects: app.objects, water: app.water,
      waterY: waterLevel(), tide: app.tide, camera: app.camera
    });
    app.foamSources = makeFoamSources();
  }
  const state = {
    sim: app.sim, objects: app.objects, waterY: waterLevel(), tide: app.tide,
    time: app.time, palette: app.palette, tiltQuat: tiltQuaternion(),
    wobble: app.reducedMotion ? .14 : .18 + (1 - app.firmness) * .8,
    life: app.life, foamSources: app.foamSources, exposure: 1.06
  };
  app.renderer.render(state);
  if (app.ui) app.ui.update(performance.now(), true);
  app.paused = wasPaused;
  return { phase: app.sim.phase, status: HarborCore.phaseStatus(app.sim), stats: { ...app.sim.stats }, time: app.sim.time };
};

function resetHarbor() {
  HarborCore.reset(app.sim);
  app.water.reset(true);
  app.life.reset(app.sceneStatic.perches);
  app.time = 0;
  app.acc = 0;
  app.tiltX = 0; app.tiltZ = 0; app.tiltVelX = 0; app.tiltVelZ = 0;
  app.foamBursts = [];
  app.prevShip = { x: app.sim.ship.x, z: app.sim.ship.z };
  app.prevTug = { x: app.sim.tug.x, z: app.sim.tug.z };
}

app.resetAll = resetHarbor;

async function boot() {
  const canvas = document.getElementById('gpu');
  app.canvas = canvas;
  app.sim = HarborCore.create();
  app.water = new WaterSim(72);
  app.sceneStatic = buildStaticScene();
  app.life = new LifeSystem();
  app.life.init(app.sceneStatic.perches);
  app.plan = buildContainerPlan();
  const dynamic = buildDynamicGeometry();
  const mesh = mergeBuilders([app.sceneStatic.builder, dynamic]);
  app.renderer = new HarborRenderer(canvas);
  const renderer = app.renderer;
  try {
    await renderer.init(mesh, app.plan, app.sceneStatic.perches, app.water);
  } catch (err) {
    showFallback(err && err.message ? err.message : String(err));
    return;
  }
  app.camera = renderer.camera;
  app.objects = updateObjectTransforms(app.sim, app.water, app.tide, app.time, app.life.ring);
  app.prevShip = { x: app.sim.ship.x, z: app.sim.ship.z };
  app.prevTug = { x: app.sim.tug.x, z: app.sim.tug.z };
  app.foamSources = makeFoamSources();
  app.ui = createHarborUI(app);
  app.ui.setPalette('sea');
  renderer.onDeviceLost = () => showFallback('The GPU device was lost.');
  runtime.ready = true;
  runtime.renderer = renderer;
  runtime.sim = app.sim;
  runtime.water = app.water;
  runtime.life = app.life;
  runtime.webgpu = true;
  runtime.initError = null;
  runtime.advance = app.advance;
  app.ui.setStatus('WebGPU · Live', true);
  const loading = document.getElementById('loading');
  loading.classList.add('done');
  setTimeout(() => { loading.hidden = true; }, 720);
  let last = performance.now();
  let lastUi = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const raw = (now - last) / 1000;
    last = now;
    const dt = Math.max(0, Math.min(raw, .05));
    app.fps = app.fps * .94 + (1 / Math.max(dt, .001)) * .06;
    updateTiltSpring(dt);
    const t0 = performance.now();
    if (!app.paused) {
      app.time += dt;
      app.acc += dt;
      let steps = 0;
      while (app.acc >= 1 / 60 && steps < 3) {
        HarborCore.step(app.sim, 1 / 60);
        processEvents();
        app.acc -= 1 / 60;
        steps++;
      }
      if (steps === 3) app.acc = 0;
      app.foamBursts = app.foamBursts.filter((f) => { f.age += dt; return f.age < f.life; });
      addVesselWakes(dt);
      app.water.step(dt, {
        firmness: app.firmness,
        damping: app.damping,
        tiltX: app.tiltX,
        tiltZ: app.tiltZ
      });
      app.objects = updateObjectTransforms(app.sim, app.water, app.tide, app.time, app.life.ring);
      app.life.update(dt, app.time, {
        sim: app.sim,
        objects: app.objects,
        water: app.water,
        waterY: waterLevel(),
        tide: app.tide,
        camera: app.camera
      });
      app.foamSources = makeFoamSources();
      if (!app.reducedMotion && !app.dragging) {
        app.camera.target[0] = Math.sin(app.time * .15) * .018;
        app.camera.target[1] = -.30 + Math.sin(app.time * .21) * .008;
        app.camera.target[2] = .03 + Math.cos(app.time * .12) * .012;
      }
    } else {
      app.objects = updateObjectTransforms(app.sim, app.water, app.tide, app.time, app.life.ring);
      app.foamSources = makeFoamSources();
    }
    app.simMs = app.simMs * .9 + (performance.now() - t0) * .1;
    runtime.fps = app.fps;
    runtime.simMs = app.simMs;
    const state = {
      sim: app.sim,
      objects: app.objects,
      waterY: waterLevel(),
      tide: app.tide,
      time: app.time,
      palette: app.palette,
      tiltQuat: tiltQuaternion(),
      wobble: app.reducedMotion ? .14 : .18 + (1 - app.firmness) * .8,
      life: app.life,
      foamSources: app.foamSources,
      exposure: 1.06
    };
    renderer.render(state);
    if (now - lastUi > 100) {
      lastUi = now;
      app.ui.update(now, true);
    }
  }
  requestAnimationFrame(frame);
}

if (!navigator.gpu) {
  showFallback('This browser does not expose WebGPU.');
} else {
  boot().catch((err) => showFallback(err && err.message ? err.message : String(err)));
}