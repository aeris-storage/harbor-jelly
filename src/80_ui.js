/* ============================================================
   Controls, pointer choreography and the ship's horn
   ============================================================ */
class HarborAudio {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.master = null;
    this.unlocked = false;
  }
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = .5;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.unlocked = this.ctx.state === 'running';
      return this.unlocked;
    } catch (e) { return false; }
  }
  setEnabled(v) {
    this.enabled = v;
    if (v) this.unlock();
  }
  horn() {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(.34, now + .09);
    out.gain.setValueAtTime(.3, now + .85);
    out.gain.exponentialRampToValueAtTime(.0001, now + 2.35);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(310, now);
    filter.frequency.linearRampToValueAtTime(520, now + .45);
    filter.frequency.linearRampToValueAtTime(300, now + 2.3);
    filter.Q.value = .7;
    out.connect(filter);
    filter.connect(this.master);
    const reeds = [
      { f: 92.5, detune: -5, gain: .45, type: 'sawtooth' },
      { f: 138.7, detune: 4, gain: .34, type: 'sawtooth' },
      { f: 92.5, detune: 7, gain: .26, type: 'sawtooth' },
      { f: 46.2, detune: 0, gain: .16, type: 'triangle' }
    ];
    for (const reed of reeds) {
      const osc = ctx.createOscillator();
      osc.type = reed.type;
      osc.frequency.value = reed.f;
      osc.detune.value = reed.detune;
      const g = ctx.createGain();
      g.gain.value = reed.gain;
      // a little reed vibrato
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 4.7 + Math.random() * .3;
      const lg = ctx.createGain();
      lg.gain.value = 2.4;
      lfo.connect(lg); lg.connect(osc.detune);
      lfo.start(now); lfo.stop(now + 2.5);
      osc.connect(g); g.connect(out);
      osc.start(now); osc.stop(now + 2.5);
    }
    // breath / steam noise
    const noise = ctx.createBuffer(1, ctx.sampleRate * 1.1, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * .2;
    const ns = ctx.createBufferSource();
    ns.buffer = noise;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 620;
    nf.Q.value = .35;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, now);
    ng.gain.exponentialRampToValueAtTime(.055, now + .12);
    ng.gain.exponentialRampToValueAtTime(.0001, now + 1.6);
    ns.connect(nf); nf.connect(ng); ng.connect(this.master);
    ns.start(now); ns.stop(now + 1.7);
  }
}

function isSeaXZ(x, z) {
  if (x < -2.58 || x > 2.58 || z < -2.58 || z > 2.58) return false;
  for (const b of HarborCore.OBSTACLES) {
    if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return false;
  }
  return true;
}

function createHarborUI(app) {
  const $ = (s) => document.querySelector(s);
  const canvas = app.canvas;
  const panel = $('#panel');
  const drawer = $('#drawer-toggle');
  const castButton = $('#castoff');
  const castLabel = $('#castoff-label');
  const hornButton = $('#horn');
  const feedButton = $('#feed');
  const pauseButton = $('#pause');
  const soundButton = $('#sound');
  const resetButton = $('#reset');
  const resetViewButton = $('#reset-view');
  const firmness = $('#firmness');
  const damping = $('#damping');
  const tide = $('#tide');
  const firmnessOut = $('#firmness-out');
  const dampingOut = $('#damping-out');
  const tideOut = $('#tide-out');
  const vesselState = $('#vessel-state');
  const phaseFlavor = $('#phase-flavor');
  const activityBar = $('#activity-bar');
  const statMoved = $('#stat-moved');
  const statTrips = $('#stat-trips');
  const statFeeds = $('#stat-feeds');
  const statusText = $('#status-text');
  const statusPill = $('#status-pill');
  const toastEl = $('#toast');
  const audio = new HarborAudio();
  app.audio = audio;
  let toastTimer = 0;
  let dragMode = null;
  let dragStart = null;
  let dragLast = null;
  let ringTarget = null;
  let lastImpulse = 0;
  let lastHover = 0;
  const pointers = new Map();
  let pinchStart = 0;
  let pinchZoom = 0;

  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1700);
  }
  function waterY() { return HarborCore.WATER_Y + app.tide; }
  function ndc(e) {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)];
  }
  function rayAt(e) {
    const [nx, ny] = ndc(e);
    return app.camera.ray(nx, ny);
  }
  function waterHit(ray) {
    const p = rayPlane(ray, waterY());
    if (!p) return null;
    if (!isSeaXZ(p[0], p[2])) return null;
    return p;
  }
  function sideHit(ray) {
    const t = rayAABB(ray, [-2.6, -2.06, -2.6], [2.6, .24, 2.6]);
    if (t === null) return null;
    const p = V3.add(ray.origin, V3.mul(ray.dir, t));
    if (Math.max(Math.abs(p[0]), Math.abs(p[2])) > 2.52 && p[1] < .23) return p;
    return null;
  }
  function hoverCursor(e) {
    if (dragMode) return;
    const now = performance.now();
    if (now - lastHover < 42) return;
    lastHover = now;
    const ray = rayAt(e);
    const ringC = app.life.getRingCenter(app.water, waterY());
    if (raySphere(ray, ringC, .17)) { canvas.style.cursor = 'grab'; return; }
    const wh = waterHit(ray);
    const sh = sideHit(ray);
    const d2 = (p) => (p[0] - ray.origin[0]) ** 2 + (p[1] - ray.origin[1]) ** 2 + (p[2] - ray.origin[2]) ** 2;
    if (sh && (!wh || d2(sh) < d2(wh))) { canvas.style.cursor = 'ns-resize'; return; }
    if (wh) { canvas.style.cursor = 'crosshair'; return; }
    canvas.style.cursor = '';
  }
  function startOrbit(e) {
    dragMode = 'orbit';
    app.dragging = true;
    canvas.style.cursor = 'grabbing';
    dragStart = { x: e.clientX, y: e.clientY };
    dragLast = { x: e.clientX, y: e.clientY };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  }
  function onPointerDown(e) {
    audio.unlock();
    if (e.pointerType === 'mouse' && e.button === 2) {
      e.preventDefault();
      startOrbit(e);
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size >= 2) {
      dragMode = 'pinch';
      app.dragging = true;
      const pts = [...pointers.values()];
      pinchStart = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchZoom = app.camera.distance;
      if (app.life.ring.state === 'held') app.life.ring.state = 'float';
      return;
    }
    e.preventDefault();
    dragStart = { x: e.clientX, y: e.clientY };
    dragLast = { ...dragStart };
    const ray = rayAt(e);
    const ringC = app.life.getRingCenter(app.water, waterY());
    if (raySphere(ray, ringC, .17)) {
      app.life.beginHold();
      dragMode = 'ring';
      app.dragging = true;
      ringTarget = waterHit(ray) || [app.life.ring.x + Math.sin(app.camera.yaw), waterY(), app.life.ring.z + Math.cos(app.camera.yaw)];
      app.life.moveHold(ringTarget[0], ringTarget[2], app.water, waterY());
      canvas.style.cursor = 'grabbing';
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      return;
    }
    const wh = waterHit(ray);
    const sh = sideHit(ray);
    const d2 = (p) => (p[0] - ray.origin[0]) ** 2 + (p[1] - ray.origin[1]) ** 2 + (p[2] - ray.origin[2]) ** 2;
    if (sh && (!wh || d2(sh) < d2(wh))) {
      dragMode = 'tilt';
      app.dragging = true;
      canvas.style.cursor = 'ns-resize';
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      return;
    }
    if (wh) {
      dragMode = 'water';
      app.dragging = true;
      lastImpulse = 0;
      app.water.addImpulse(wh[0], wh[2], .024, .16);
      app.water.addSplash(wh[0], wh[2], .014, .1);
      app.life.scare(wh[0], wh[2], .65);
      app.life.splash(wh[0], wh[2], .12);
      app.foamBursts.push({ x: wh[0], z: wh[2], age: 0, life: .9, size: .22 });
      canvas.style.cursor = 'crosshair';
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      return;
    }
    startOrbit(e);
  }
  function onPointerMove(e) {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dragMode === 'pinch') {
      if (pointers.size >= 2) {
        const pts = [...pointers.values()];
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (pinchStart > 0) app.camera.distance = clamp(pinchZoom * (pinchStart / Math.max(d, 1)), 6.7, 13.6);
      }
      return;
    }
    if (!dragMode) { hoverCursor(e); return; }
    const dx = e.clientX - dragLast.x;
    const dy = e.clientY - dragLast.y;
    dragLast = { x: e.clientX, y: e.clientY };
    if (dragMode === 'orbit') {
      app.camera.orbit(dx, dy);
    } else if (dragMode === 'tilt') {
      app.tiltVelX += dy * .0062;
      app.tiltVelZ -= dx * .0062;
      app.tiltVelX = clamp(app.tiltVelX, -2.4, 2.4);
      app.tiltVelZ = clamp(app.tiltVelZ, -2.4, 2.4);
    } else if (dragMode === 'water') {
      const now = performance.now();
      if (now - lastImpulse > 26) {
        lastImpulse = now;
        const ray = rayAt(e);
        const wh = waterHit(ray);
        if (wh) {
          app.water.addImpulse(wh[0], wh[2], .018, .14);
          app.water.addSplash(wh[0], wh[2], .01, .08);
          app.life.scare(wh[0], wh[2], .5);
          app.life.splash(wh[0], wh[2], .07);
          if (Math.random() < .35) app.foamBursts.push({ x: wh[0], z: wh[2], age: 0, life: .8, size: .16 });
        }
      }
    } else if (dragMode === 'ring') {
      const ray = rayAt(e);
      const wh = waterHit(ray);
      if (wh) {
        ringTarget = wh;
        app.life.moveHold(wh[0], wh[2], app.water, waterY());
      }
    }
  }
  function endPointer(e) {
    pointers.delete(e.pointerId);
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    if (dragMode === 'pinch') {
      if (pointers.size < 2) { dragMode = null; app.dragging = false; canvas.style.cursor = ''; }
      return;
    }
    if (dragMode === 'ring') {
      const target = ringTarget || [app.life.ring.x + 1, waterY(), app.life.ring.z];
      app.life.releaseThrow(target, app.water, waterY());
      app.water.addSplash(target[0], target[2], .025, .12);
      app.foamBursts.push({ x: target[0], z: target[2], age: 0, life: 1.1, size: .3 });
      toast('Life ring away');
    }
    dragMode = null;
    app.dragging = false;
    canvas.style.cursor = '';
    ringTarget = null;
  }
  function onWheel(e) {
    e.preventDefault();
    app.camera.zoom(e.deltaY);
  }
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerleave', () => { if (!dragMode) canvas.style.cursor = ''; });

  drawToggleInitial();
  function drawToggleInitial() {
    if (window.innerWidth <= 900) {
      panel.classList.remove('open');
      drawer.setAttribute('aria-expanded', 'false');
    }
  }
  drawer.addEventListener('click', () => {
    const open = panel.classList.toggle('open');
    drawer.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('pointerdown', (e) => {
    if (window.innerWidth <= 900 && panel.classList.contains('open') && !panel.contains(e.target) && e.target !== canvas) {
      panel.classList.remove('open');
      drawer.setAttribute('aria-expanded', 'false');
    }
  }, true);

  castButton.addEventListener('click', () => {
    const s = HarborCore.buttonState(app.sim);
    if (s.disabled) return;
    if (HarborCore.command(app.sim, s.mode)) {
      toast(s.mode === 'callin' ? 'Calling her in' : 'Casting off after this lift');
      if (app.paused) togglePause(false);
    }
  });
  hornButton.addEventListener('click', () => {
    audio.unlock();
    HarborCore.command(app.sim, 'horn');
    toast('Horn sounding');
    if (app.paused) togglePause(false);
  });
  feedButton.addEventListener('click', () => {
    audio.unlock();
    HarborCore.command(app.sim, 'feed');
    toast('Fish fed');
  });
  function togglePause(force) {
    app.paused = force === undefined ? !app.paused : force;
    pauseButton.setAttribute('aria-pressed', String(app.paused));
    pauseButton.textContent = app.paused ? 'Resume' : 'Pause';
  }
  pauseButton.addEventListener('click', () => togglePause());
  soundButton.addEventListener('click', () => {
    app.soundEnabled = !app.soundEnabled;
    audio.setEnabled(app.soundEnabled);
    soundButton.setAttribute('aria-pressed', String(app.soundEnabled));
    soundButton.textContent = app.soundEnabled ? 'Sound on' : 'Sound off';
  });
  resetButton.addEventListener('click', () => {
    app.resetAll();
    firmness.value = '78'; damping.value = '34'; tide.value = '0';
    app.firmness = .78; app.damping = .34; app.tide = 0;
    updateSliders();
    setPalette('sea');
    if (app.paused) togglePause(false);
    toast('Harbor reset');
  });
  resetViewButton.addEventListener('click', () => {
    app.camera.reset();
    toast('View reset');
  });
  const paletteButtons = [...document.querySelectorAll('[data-palette]')];
  function setPalette(key) {
    app.paletteKey = key;
    app.palette = PALETTES[key] || PALETTES.sea;
    paletteButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.palette === key)));
  }
  paletteButtons.forEach((b) => b.addEventListener('click', () => setPalette(b.dataset.palette)));
  function updateSliders() {
    firmnessOut.textContent = Math.round(app.firmness * 100) + '%';
    dampingOut.textContent = Math.round(app.damping * 100) + '%';
    const cm = app.tide * 100;
    tideOut.textContent = (cm >= 0 ? '+' : '') + cm.toFixed(1) + ' cm';
  }
  firmness.addEventListener('input', () => { app.firmness = Number(firmness.value) / 100; updateSliders(); });
  damping.addEventListener('input', () => { app.damping = Number(damping.value) / 100; updateSliders(); });
  tide.addEventListener('input', () => { app.tide = Number(tide.value) / 100; updateSliders(); });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      audio.unlock();
      HarborCore.command(app.sim, 'horn');
      toast('Horn sounding');
      if (app.paused) togglePause(false);
    } else if (e.code === 'KeyR') {
      e.preventDefault();
      app.camera.reset();
      toast('View reset');
    }
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) {
      panel.classList.remove('open');
      drawer.setAttribute('aria-expanded', 'false');
    }
  });

  const flavor = {
    unloading: 'Cranes working',
    loading: 'Outbound boxes',
    boomsup: 'Securing the gear',
    tug_in: 'Tug approaching',
    tug_pull: 'Lines slipping',
    release: 'Horn across the water',
    atsea: 'Open water',
    comingin: 'Homeward',
    berthing: 'Alongside',
    boomsdown: 'Gear down',
    settle: 'Mooring lines'
  };
  let lastUi = 0;
  const ui = {
    toast,
    setStatus(text, live) {
      statusText.textContent = text;
      statusPill.classList.toggle('offline', !live);
    },
    setPalette,
    togglePause,
    update(now, force) {
      if (!force && now - lastUi < 105) return;
      lastUi = now;
      const bs = HarborCore.buttonState(app.sim);
      castLabel.textContent = bs.label;
      castButton.disabled = bs.disabled;
      vesselState.textContent = HarborCore.phaseStatus(app.sim);
      const ph = app.sim.phase;
      phaseFlavor.textContent = flavor[ph] || 'Alongside';
      const active = app.paused ? 0 : HarborCore.activity(app.sim);
      activityBar.style.width = (16 + active * 84).toFixed(1) + '%';
      statMoved.textContent = String(app.sim.stats.moved);
      statTrips.textContent = String(app.sim.stats.trips);
      statFeeds.textContent = String(app.sim.stats.feeds);
      pauseButton.setAttribute('aria-pressed', String(app.paused));
      pauseButton.textContent = app.paused ? 'Resume' : 'Pause';
      soundButton.setAttribute('aria-pressed', String(app.soundEnabled));
      soundButton.textContent = app.soundEnabled ? 'Sound on' : 'Sound off';
    }
  };
  updateSliders();
  return ui;
}