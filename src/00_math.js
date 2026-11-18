/* ============================================================
   Math — column-major mat4, quaternions, ray helpers
   ============================================================ */
const PI = Math.PI;
const TAU = Math.PI * 2;
const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const invLerp = (a, b, v) => clamp01((v - a) / (b - a || 1));
const smoothstep = (a, b, v) => { const t = invLerp(a, b, v); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
const easeInOut = (t) => { t = clamp01(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const TAU2 = Math.PI * 2;
const DEG = Math.PI / 180;

function hash(x, y, z) {
  let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return h - Math.floor(h);
}
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const V3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
};

const Q = {
  identity: () => [0, 0, 0, 1],
  axisAngle: (axis, angle) => {
    const half = angle * .5, s = Math.sin(half);
    return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)];
  },
  mul: (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
  ],
  rotate: (q, v) => {
    const [qx, qy, qz, qw] = q;
    const ix = qw * v[0] + qy * v[2] - qz * v[1];
    const iy = qw * v[1] + qz * v[0] - qx * v[2];
    const iz = qw * v[2] + qx * v[1] - qy * v[0];
    const iw = -qx * v[0] - qy * v[1] - qz * v[2];
    return [
      ix * qw + iw * -qx + iy * -qz - iz * -qy,
      iy * qw + iw * -qy + iz * -qx - ix * -qz,
      iz * qw + iw * -qz + ix * -qy - iy * -qx
    ];
  },
  fromEuler: (x, y, z) => {
    const cx = Math.cos(x * .5), sx = Math.sin(x * .5);
    const cy = Math.cos(y * .5), sy = Math.sin(y * .5);
    const cz = Math.cos(z * .5), sz = Math.sin(z * .5);
    return [
      sx * cy * cz + cx * sy * sz,
      cx * sy * cz - sx * cy * sz,
      cx * cy * sz - sx * sy * cz,
      cx * cy * cz + sx * sy * sz
    ];
  },
  slerp: (a, b, t) => {
    let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    let bb = b;
    if (dot < 0) { dot = -dot; bb = [-b[0], -b[1], -b[2], -b[3]]; }
    if (dot > .9995) {
      const q = [lerp(a[0], bb[0], t), lerp(a[1], bb[1], t), lerp(a[2], bb[2], t), lerp(a[3], bb[3], t)];
      const l = Math.hypot(...q) || 1; return q.map(v => v / l);
    }
    const theta = Math.acos(dot), sin = Math.sin(theta);
    const wa = Math.sin((1 - t) * theta) / sin, wb = Math.sin(t * theta) / sin;
    return [a[0] * wa + bb[0] * wb, a[1] * wa + bb[1] * wb, a[2] * wa + bb[2] * wb, a[3] * wa + bb[3] * wb];
  }
};

const M4 = {
  identity: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  mul: (a, b) => {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
      o[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
      o[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
      o[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
      o[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
    return o;
  },
  fromQuatPosScale: (q, p, s) => {
    const [x, y, z, w] = q;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const sx = s[0], sy = s[1], sz = s[2];
    return new Float32Array([
      (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
      (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
      (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
      p[0], p[1], p[2], 1
    ]);
  },
  translation: (p) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, p[0], p[1], p[2], 1]),
  scale: (s) => new Float32Array([s[0], 0, 0, 0, 0, s[1], 0, 0, 0, 0, s[2], 0, 0, 0, 0, 1]),
  perspective: (fovy, aspect, near, far, shiftX = 0, shiftY = 0) => {
    const f = 1 / Math.tan(fovy * .5);
    const m = new Float32Array(16);
    m[0] = f / aspect; m[5] = f;
    m[8] = shiftX; m[9] = shiftY;
    m[10] = far / (near - far); m[11] = -1;
    m[14] = (near * far) / (near - far);
    return m;
  },
  ortho: (l, r, b, t, n, f) => new Float32Array([
    2 / (r - l), 0, 0, 0,
    0, 2 / (t - b), 0, 0,
    0, 0, 1 / (n - f), 0,
    (l + r) / (l - r), (t + b) / (b - t), n / (n - f), 1
  ]),
  lookAt: (eye, target, up) => {
    const z = V3.norm(V3.sub(eye, target));
    const x = V3.norm(V3.cross(up, z));
    const y = V3.cross(z, x);
    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -V3.dot(x, eye), -V3.dot(y, eye), -V3.dot(z, eye), 1
    ]);
  },
  invert: (m) => {
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
    const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
    const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return M4.identity();
    det = 1 / det;
    return new Float32Array([
      (a11 * b11 - a12 * b10 + a13 * b09) * det,
      (a02 * b10 - a01 * b11 - a03 * b09) * det,
      (a31 * b05 - a32 * b04 + a33 * b03) * det,
      (a22 * b04 - a21 * b05 - a23 * b03) * det,
      (a12 * b08 - a10 * b11 - a13 * b07) * det,
      (a00 * b11 - a02 * b08 + a03 * b07) * det,
      (a32 * b02 - a30 * b05 - a33 * b01) * det,
      (a20 * b05 - a22 * b02 + a23 * b01) * det,
      (a10 * b10 - a11 * b08 + a13 * b06) * det,
      (a01 * b08 - a00 * b10 - a03 * b06) * det,
      (a30 * b04 - a31 * b02 + a33 * b00) * det,
      (a21 * b02 - a20 * b04 - a23 * b00) * det,
      (a11 * b07 - a10 * b09 - a12 * b06) * det,
      (a00 * b09 - a01 * b07 + a02 * b06) * det,
      (a31 * b01 - a30 * b03 - a32 * b00) * det,
      (a20 * b03 - a21 * b01 + a22 * b00) * det
    ]);
  },
  transformPoint: (m, p) => {
    const x = p[0], y = p[1], z = p[2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    return [
      (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
      (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
      (m[2] * x + m[6] * y + m[10] * z + m[14]) / w
    ];
  }
};

function hexToLinear(hex) {
  const v = hex.replace('#', '');
  const n = parseInt(v.length === 3 ? v.split('').map(c => c + c).join('') : v, 16);
  const srgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v / 255);
  return srgb.map(c => c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4));
}
const COLOR_CACHE = new Map();
function C(hex) {
  let c = COLOR_CACHE.get(hex);
  if (!c) { c = hexToLinear(hex); COLOR_CACHE.set(hex, c); }
  return c;
}
function mixC(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
function scaleC(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }

function rayFromNdc(invViewProj, nx, ny) {
  const near = M4.transformPoint(invViewProj, [nx, ny, 0]);
  const far = M4.transformPoint(invViewProj, [nx, ny, 1]);
  return { origin: near, dir: V3.norm(V3.sub(far, near)) };
}
function rayPlane(ray, y) {
  if (Math.abs(ray.dir[1]) < 1e-6) return null;
  const t = (y - ray.origin[1]) / ray.dir[1];
  if (t < 0) return null;
  return [ray.origin[0] + ray.dir[0] * t, y, ray.origin[2] + ray.dir[2] * t];
}
function raySphere(ray, center, radius) {
  const oc = V3.sub(ray.origin, center);
  const b = V3.dot(oc, ray.dir);
  const c = V3.dot(oc, oc) - radius * radius;
  const h = b * b - c;
  if (h < 0) return null;
  const t = -b - Math.sqrt(h);
  if (t < 0) return null;
  return V3.add(ray.origin, V3.mul(ray.dir, t));
}
function rayAABB(ray, min, max) {
  let tmin = -Infinity, tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(ray.dir[i]) < 1e-8) {
      if (ray.origin[i] < min[i] || ray.origin[i] > max[i]) return null;
    } else {
      const t1 = (min[i] - ray.origin[i]) / ray.dir[i];
      const t2 = (max[i] - ray.origin[i]) / ray.dir[i];
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
      if (tmin > tmax) return null;
    }
  }
  return tmin > 0 ? tmin : (tmax > 0 ? tmax : null);
}
