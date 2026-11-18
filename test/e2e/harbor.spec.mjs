import { test, expect } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PAGE_URL = pathToFileURL(path.resolve('index.html')).href;

async function openHarbor(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const requests = [];
  page.on('request', (req) => requests.push(req.url()));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  await page.goto(PAGE_URL);
  await page.waitForFunction(() => window.__harbor && window.__harbor.ready === true, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__harbor.sim && window.__harbor.sim.time > 0.15, null, { timeout: 30000 });
  return { consoleErrors, pageErrors, requests };
}

test('harbor renders live WebGPU without console errors', async ({ page }) => {
  const errors = await openHarbor(page);
  await expect(page.locator('#status-text')).toHaveText('WebGPU · Live');
  await expect(page.locator('#vessel-state')).toContainText(/Unloading|Loading|Booms|Tug|Casting|At sea|Berthing/);
  const state = await page.evaluate(() => ({
    webgpu: !!navigator.gpu,
    fallback: !document.getElementById('fallback').hidden,
    canvas: [document.getElementById('gpu').width, document.getElementById('gpu').height],
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
    stats: window.__harbor.sim.stats,
    simMs: window.__harbor.simMs,
    counts: {
      containers: window.__harbor.renderer.containerCount,
      fish: window.__harbor.renderer.fishCount,
      gulls: window.__harbor.renderer.gullCount,
      jelly: window.__harbor.renderer.jellyCount,
      lines: window.__harbor.renderer.lineVertexCount
    }
  }));
  expect(state.webgpu).toBe(true);
  expect(state.fallback).toBe(false);
  expect(state.canvas[0]).toBeGreaterThan(1000);
  expect(state.canvas[1]).toBeGreaterThan(600);
  expect(state.scrollHeight).toBeLessThanOrEqual(state.innerHeight + 1);
  expect(state.counts.containers).toBeGreaterThan(180);
  expect(state.counts.fish).toBeGreaterThan(40);
  expect(state.counts.gulls).toBeGreaterThan(8);
  expect(state.counts.jelly).toBeGreaterThan(4);
  expect(state.simMs).toBeLessThan(5);
  expect(errors.consoleErrors).toEqual([]);
  expect(errors.pageErrors).toEqual([]);
  expect(errors.requests.every((u) => u.startsWith('file:') || u.startsWith('data:'))).toBe(true);
  await page.screenshot({ path: 'test-results/harbor-default.png' });
});

test('later voyage stages render cleanly', async ({ page }) => {
  test.setTimeout(240000);
  const errors = await openHarbor(page);
  const state = await page.evaluate(() => { const r = window.__harbor.advance(58); window.__harbor.app.paused = true; return r; });
  expect(['release', 'atsea', 'berthing']).toContain(state.phase);
  expect(state.stats.moved).toBe(8);
  await page.waitForTimeout(300);
  const counts = await page.evaluate(() => ({ containers: window.__harbor.renderer.containerCount, particles: window.__harbor.renderer.particleCount, fish: window.__harbor.renderer.fishCount }));
  expect(counts.containers).toBeGreaterThan(100);
  expect(counts.fish).toBeGreaterThan(40);
  await page.screenshot({ path: 'test-results/harbor-at-sea.png' });
  await page.locator('#castoff').click();
  await page.waitForFunction(() => window.__harbor.sim.urgent === true);
  await page.evaluate(() => { window.__harbor.advance(2); window.__harbor.app.paused = true; });
  await expect(page.locator('#vessel-state')).toContainText('Coming in');
  expect(errors.consoleErrors).toEqual([]);
  expect(errors.pageErrors).toEqual([]);
});

test('controls, sliders, palettes, pause and reset are wired', async ({ page }) => {
  const errors = await openHarbor(page);
  await page.locator('#horn').click();
  await page.waitForFunction(() => window.__harbor.sim.hornCount >= 1);
  await page.locator('#feed').click();
  await page.waitForFunction(() => window.__harbor.sim.stats.feeds >= 1);
  await page.locator('#castoff').click();
  await page.waitForFunction(() => window.__harbor.sim.castOffRequested === true);

  await page.locator('[data-palette="blueberry"]').click();
  await expect(page.locator('[data-palette="blueberry"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__harbor.app.paletteKey)).toBe('blueberry');

  await page.locator('#firmness').evaluate((el) => {
    el.value = '42';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(await page.evaluate(() => window.__harbor.app.firmness)).toBeCloseTo(.42, 3);
  await expect(page.locator('#firmness-out')).toHaveText('42%');

  await page.locator('#tide').evaluate((el) => {
    el.value = '7';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#tide-out')).toHaveText('+7.0 cm');
  expect(await page.evaluate(() => window.__harbor.app.tide)).toBeCloseTo(.07, 4);

  await page.locator('#sound').click();
  await expect(page.locator('#sound')).toHaveText('Sound off');
  expect(await page.evaluate(() => window.__harbor.app.soundEnabled)).toBe(false);
  await page.locator('#sound').click();
  await expect(page.locator('#sound')).toHaveText('Sound on');

  await page.locator('#pause').click();
  expect(await page.evaluate(() => window.__harbor.app.paused)).toBe(true);
  await expect(page.locator('#pause')).toHaveText('Resume');
  await page.locator('#pause').click();
  expect(await page.evaluate(() => window.__harbor.app.paused)).toBe(false);

  await page.locator('#reset').click();
  await page.waitForFunction(() => window.__harbor.sim.stats.moved === 0 && window.__harbor.sim.stats.feeds === 0);
  expect(await page.evaluate(() => window.__harbor.app.tide)).toBe(0);
  await expect(page.locator('#tide-out')).toHaveText('+0.0 cm');

  await page.locator('#reset-view').click();
  expect(await page.evaluate(() => window.__harbor.renderer.camera.distance)).toBeCloseTo(10.25, 1);

  expect(errors.consoleErrors).toEqual([]);
  expect(errors.pageErrors).toEqual([]);
});

test('keyboard, orbit, zoom and water interaction work', async ({ page }) => {
  const errors = await openHarbor(page);
  const yaw0 = await page.evaluate(() => window.__harbor.renderer.camera.yaw);
  await page.mouse.move(160, 430);
  await page.mouse.down();
  await page.mouse.move(260, 450, { steps: 8 });
  await page.mouse.up();
  const yaw1 = await page.evaluate(() => window.__harbor.renderer.camera.yaw);
  expect(Math.abs(yaw1 - yaw0)).toBeGreaterThan(.05);

  const dist0 = await page.evaluate(() => window.__harbor.renderer.camera.distance);
  await page.mouse.wheel(0, 220);
  await page.waitForTimeout(120);
  const dist1 = await page.evaluate(() => window.__harbor.renderer.camera.distance);
  expect(dist1).toBeGreaterThan(dist0);

  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__harbor.sim.hornCount >= 1);
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__harbor.renderer.camera.distance)).toBeCloseTo(10.25, 1);

  // make a ripple in the open water, then confirm the height field has energy
  await page.evaluate(() => { window.__harbor.water.reset(true); window.__harbor.app.paused = true; });
  const point = await page.evaluate(() => {
    const h = window.__harbor;
    const p = [0.55, 0.03, 1.25];
    const m = h.renderer.camera.viewProj;
    const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    const x = (m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w;
    const y = (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w;
    return { x: (x * .5 + .5) * innerWidth, y: (-y * .5 + .5) * innerHeight };
  });
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 18, point.y + 4, { steps: 4 });
  await page.mouse.up();
  const energy = await page.evaluate(() => {
    const w = window.__harbor.water;
    let sum = 0;
    for (let i = 0; i < w.h.length; i++) sum += Math.abs(w.h[i]);
    return sum;
  });
  expect(energy).toBeGreaterThan(.02);
  expect(errors.consoleErrors).toEqual([]);
  expect(errors.pageErrors).toEqual([]);
});

test('side drag tilts the jelly block and the life ring can be thrown', async ({ page }) => {
  const errors = await openHarbor(page);
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(100);
  const side = await page.evaluate(() => {
    const h = window.__harbor;
    const p = [2.6, -.2, .25];
    const m = h.renderer.camera.viewProj;
    const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    const x = (m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w;
    const y = (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w;
    return { x: (x * .5 + .5) * innerWidth, y: (-y * .5 + .5) * innerHeight };
  });
  await page.mouse.move(side.x, side.y);
  await page.mouse.down();
  await page.mouse.move(side.x + 32, side.y + 70, { steps: 10 });
  await page.waitForTimeout(220);
  const tilt = await page.evaluate(() => ({ x: window.__harbor.app.tiltX, z: window.__harbor.app.tiltZ }));
  expect(Math.max(Math.abs(tilt.x), Math.abs(tilt.z))).toBeGreaterThan(.02);
  await page.mouse.up();
  await page.waitForTimeout(400);

  const ring = await page.evaluate(() => {
    const h = window.__harbor;
    const p = h.life.getRingCenter(h.water, h.app.tide + HarborCore.WATER_Y);
    const m = h.renderer.camera.viewProj;
    const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    const x = (m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w;
    const y = (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w;
    return { x: (x * .5 + .5) * innerWidth, y: (-y * .5 + .5) * innerHeight, startX: h.life.ring.x, startZ: h.life.ring.z };
  });
  await page.mouse.move(ring.x, ring.y);
  await page.mouse.down();
  await page.waitForFunction(() => window.__harbor.life.ring.state === 'held');
  await page.mouse.move(ring.x + 70, ring.y - 30, { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction(() => window.__harbor.life.ring.state !== 'held');
  const ringAfter = await page.evaluate(() => ({ x: window.__harbor.life.ring.x, z: window.__harbor.life.ring.z }));
  expect(Math.hypot(ringAfter.x - ring.startX, ringAfter.z - ring.startZ)).toBeGreaterThan(.2);
  expect(errors.consoleErrors).toEqual([]);
  expect(errors.pageErrors).toEqual([]);
});

test('mobile layout opens a bottom sheet and keeps the page still', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await openHarbor(page);
  await expect(page.locator('#drawer-toggle')).toBeVisible();
  const closed = await page.locator('#panel').evaluate((el) => el.classList.contains('open'));
  expect(closed).toBe(false);
  await page.screenshot({ path: 'test-results/harbor-mobile-closed.png' });
  await page.locator('#drawer-toggle').click();
  await expect(page.locator('#panel')).toHaveClass(/open/);
  await expect(page.locator('#castoff')).toBeVisible();
  await expect(page.locator('.howto')).toContainText('How to play');
  const state = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollHeight: document.documentElement.scrollHeight
  }));
  expect(state.scrollWidth).toBeLessThanOrEqual(state.innerWidth + 1);
  expect(state.scrollHeight).toBeLessThanOrEqual(state.innerHeight + 1);
  expect(errors.consoleErrors).toEqual([]);
  expect(errors.pageErrors).toEqual([]);
  await page.screenshot({ path: 'test-results/harbor-mobile.png' });
});

test('reduced motion stops ambient camera drift', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await openHarbor(page);
  expect(await page.evaluate(() => window.__harbor.app.reducedMotion)).toBe(true);
  await page.waitForTimeout(700);
  const target = await page.evaluate(() => window.__harbor.renderer.camera.target);
  expect(Math.abs(target[0])).toBeLessThan(.002);
  expect(errors.consoleErrors).toEqual([]);
  expect(errors.pageErrors).toEqual([]);
});

test('friendly fallback appears when WebGPU is missing', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      Object.defineProperty(navigator, 'gpu', { configurable: true, get: () => undefined });
    } catch (err) {}
  });
  await page.goto(PAGE_URL);
  await page.waitForFunction(() => window.__harbor && window.__harbor.ready === false && window.__harbor.error, null, { timeout: 30000 });
  await expect(page.locator('#fallback')).toBeVisible();
  await expect(page.locator('#status-text')).toHaveText('WebGPU · unavailable');
  await expect(page.locator('.fallback-card h2')).toContainText('WebGPU');
});