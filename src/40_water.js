/* ============================================================
   Jelly ocean — staggered linear shallow-water simulation
   Heights at cell centres, velocities at cell faces.
   ============================================================ */
class WaterSim {
  constructor(n = 72) {
    this.n = n;
    this.dx = 5.2 / n;
    this.h = new Float32Array(n * n);
    this.u = new Float32Array((n + 1) * n);
    this.v = new Float32Array(n * (n + 1));
    this.tmp = new Float32Array(n * n);
    this.time = 0;
    this.maxHeight = 0;
    this.reset();
  }
  reset(seedWaves = true) {
    const n = this.n;
    this.time = 0;
    this.maxHeight = 0;
    this.h.fill(0); this.u.fill(0); this.v.fill(0);
    if (seedWaves) {
      for (let z = 0; z < n; z++) {
        for (let x = 0; x < n; x++) {
          const gx = -2.6 + (x + .5) * this.dx;
          const gz = -2.6 + (z + .5) * this.dx;
          this.h[z * n + x] = Math.sin(gx * 2.1 + gz * 1.4) * .0035 + Math.sin(gz * 3.7 + 1.2) * .0018;
        }
      }
    }
  }
  addImpulse(x, z, strength, radius = .18) {
    const n = this.n, dx = this.dx;
    const cx = (x + 2.6) / dx - .5, cz = (z + 2.6) / dx - .5;
    const r = Math.max(1, radius / dx);
    const r2 = r * r;
    for (let iz = Math.floor(cz - r); iz <= Math.ceil(cz + r); iz++) {
      if (iz < 0 || iz >= n) continue;
      for (let ix = Math.floor(cx - r); ix <= Math.ceil(cx + r); ix++) {
        if (ix < 0 || ix >= n) continue;
        const ddx = ix - cx, ddz = iz - cz;
        const d2 = ddx * ddx + ddz * ddz;
        if (d2 > r2) continue;
        const fall = Math.exp(-d2 / (r2 * .34));
        const ring = Math.exp(-Math.pow(Math.sqrt(d2) - r * .6, 2) / (r2 * .08));
        const idx = iz * n + ix;
        this.h[idx] += -strength * fall + strength * .32 * ring;
      }
    }
  }
  addSplash(x, z, strength = .028, radius = .12) {
    this.addImpulse(x, z, strength, radius);
    const n = this.n, dx = this.dx;
    const cx = (x + 2.6) / dx - .5, cz = (z + 2.6) / dx - .5;
    const ix = Math.round(cx), iz = Math.round(cz);
    if (ix > 0 && ix < n && iz >= 0 && iz < n) {
      const ang = Math.random() * TAU;
      const fx = Math.cos(ang), fz = Math.sin(ang);
      const ui = iz * (n + 1) + ix;
      const vi = iz * n + ix;
      this.u[ui] += fx * strength * 1.8;
      this.u[ui + 1] -= fx * strength * 1.8;
      this.v[vi] += fz * strength * 1.8;
      this.v[vi + n] -= fz * strength * 1.8;
    }
  }
  addWake(x, z, vx, vz, speed, radius = .22, strength = .22) {
    if (speed < .002) return;
    const n = this.n, dx = this.dx;
    const heading = Math.atan2(vx, vz);
    const bx = x + Math.sin(heading) * radius * 1.4;
    const bz = z + Math.cos(heading) * radius * 1.4;
    const cx = (bx + 2.6) / dx - .5, cz = (bz + 2.6) / dx - .5;
    const r = Math.max(1.2, radius / dx);
    const r2 = r * r;
    for (let iz = Math.floor(cz - r); iz <= Math.ceil(cz + r); iz++) {
      if (iz < 0 || iz >= n) continue;
      for (let ix = Math.floor(cx - r); ix <= Math.ceil(cx + r); ix++) {
        if (ix < 0 || ix >= n) continue;
        const ddx = ix - cx, ddz = iz - cz;
        const d2 = ddx * ddx + ddz * ddz;
        if (d2 > r2) continue;
        const idx = iz * n + ix;
        const fall = Math.exp(-d2 / (r2 * .4));
        this.h[idx] += speed * strength * .018 * fall;
        const ui = iz * (n + 1) + ix;
        this.u[ui] += vx * strength * .025 * fall;
        const vi = iz * n + ix;
        this.v[vi] += vz * strength * .025 * fall;
      }
    }
  }
  step(dt, opts = {}) {
    const n = this.n;
    const firm = opts.firmness === undefined ? .8 : opts.firmness;
    const dampSlider = opts.damping === undefined ? .34 : opts.damping;
    const tiltX = opts.tiltX || 0, tiltZ = opts.tiltZ || 0;
    const H = .58;
    const g = 8.5 + firm * 10.5;
    const tension = .008 + firm * .055;
    const damping = .28 + dampSlider * 3.0;
    const relax = .04 + (1 - firm) * .035;
    const dx = this.dx;
    const slopeX = Math.sin(tiltZ) * g * 1.35;
    const slopeZ = -Math.sin(tiltX) * g * 1.35;
    this.time += dt;
    const steps = Math.max(2, Math.min(7, Math.ceil(dt / .007)));
    const h = this.h, u = this.u, v = this.v, tmp = this.tmp;
    for (let s = 0; s < steps; s++) {
      const d = Math.min(dt / steps, .0071);
      // Face velocities from surface gradient.
      for (let z = 0; z < n; z++) {
        const base = z * (n + 1);
        u[base] = 0;
        u[base + n] = 0;
        for (let x = 1; x < n; x++) {
          const idx = base + x;
          const hL = h[z * n + x - 1], hR = h[z * n + x];
          const acc = -g * (hR - hL) / dx - slopeX;
          u[idx] = (u[idx] + d * acc) / (1 + d * damping);
          if (u[idx] > 1.4) u[idx] = 1.4; else if (u[idx] < -1.4) u[idx] = -1.4;
        }
      }
      for (let z = 0; z < n; z++) {
        const base = z * n;
        for (let x = 0; x < n; x++) {
          if (z === 0 || z === n - 1) { v[base + x] = 0; continue; }
          const idx = z * n + x;
          const hD = h[(z - 1) * n + x], hU = h[z * n + x];
          const acc = -g * (hU - hD) / dx - slopeZ;
          v[idx] = (v[idx] + d * acc) / (1 + d * damping);
          if (v[idx] > 1.4) v[idx] = 1.4; else if (v[idx] < -1.4) v[idx] = -1.4;
        }
      }
      for (let z = n - 1; z >= 0; z--) {
        const base = z * n;
        for (let x = 0; x < n; x++) {
          const idx = base + x;
          const div = (u[z * (n + 1) + x + 1] - u[z * (n + 1) + x] + v[(z + 1) * n + x] - v[z * n + x]) / dx;
          let lap = 0;
          if (x > 0) lap += h[idx - 1];
          if (x < n - 1) lap += h[idx + 1];
          if (z > 0) lap += h[idx - n];
          if (z < n - 1) lap += h[idx + n];
          lap -= 4 * h[idx];
          let nh = h[idx] + d * (-H * div + tension * lap - h[idx] * relax);
          if (nh > .12) nh = .12; else if (nh < -.12) nh = -.12;
          tmp[idx] = nh;
        }
      }
      h.set(tmp);
    }
    let max = 0;
    for (let i = 0; i < h.length; i++) { const a = Math.abs(h[i]); if (a > max) max = a; }
    this.maxHeight = max;
  }
  heightAt(x, z) {
    const n = this.n, dx = this.dx;
    let gx = (x + 2.6) / dx - .5;
    let gz = (z + 2.6) / dx - .5;
    gx = clamp(gx, 0, n - 1.001);
    gz = clamp(gz, 0, n - 1.001);
    const ix = Math.floor(gx), iz = Math.floor(gz);
    const fx = gx - ix, fz = gz - iz;
    const h = this.h;
    const a = h[iz * n + ix], b = h[iz * n + ix + 1];
    const c = h[(iz + 1) * n + ix], d = h[(iz + 1) * n + ix + 1];
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
  }
  heightGrad(x, z) {
    const e = this.dx * .6;
    return {
      x: (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e),
      z: (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e)
    };
  }
  updateSurface(vertices, stride, waterY) {
    const n = this.n, dx = this.dx;
    for (let iz = 0; iz <= n; iz++) {
      const z = -2.6 + iz * dx;
      for (let ix = 0; ix <= n; ix++) {
        const x = -2.6 + ix * dx;
        const j = (iz * (n + 1) + ix) * stride;
        const h = this.heightAt(x, z);
        const g = this.heightGrad(x, z);
        const nlen = Math.hypot(-g.x, 1, -g.z);
        vertices[j] = x;
        vertices[j + 1] = waterY + h;
        vertices[j + 2] = z;
        vertices[j + 3] = -g.x / nlen;
        vertices[j + 4] = 1 / nlen;
        vertices[j + 5] = -g.z / nlen;
        vertices[j + 6] = ix / n;
        vertices[j + 7] = iz / n;
      }
    }
    return (n + 1) * (n + 1);
  }
}