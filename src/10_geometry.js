/* ============================================================
   Procedural geometry
   ============================================================ */
class MeshBuilder {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.col = [];
    this.uvs = [];
    this.mats = [];
    this.objs = [];
    this.idx = [];
  }
  get count() { return this.pos.length / 3; }
  vert(p, n, c, uv, mat, obj) {
    this.pos.push(p[0], p[1], p[2]);
    this.nrm.push(n[0], n[1], n[2]);
    this.col.push(c[0], c[1], c[2]);
    this.uvs.push(uv[0], uv[1]);
    this.mats.push(mat);
    this.objs.push(obj || 0);
    return this.count - 1;
  }
  tri(a, b, c) {
    this.idx.push(a, b, c);
  }
  quad(p0, p1, p2, p3, n, c, uv0, uv1, uv2, uv3, mat, obj) {
    const base = this.count;
    const u0 = uv0 || [0, 0], u1 = uv1 || [1, 0], u2 = uv2 || [1, 1], u3 = uv3 || [0, 1];
    this.vert(p0, n, c, u0, mat, obj);
    this.vert(p1, n, c, u1, mat, obj);
    this.vert(p2, n, c, u2, mat, obj);
    this.vert(p3, n, c, u3, mat, obj);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    return base;
  }
  face(points, normal, color, mat, obj, uvScale = 1) {
    const n = normal;
    if (points.length === 3) {
      const base = this.count;
      this.vert(points[0], n, color, [0, 0], mat, obj);
      this.vert(points[1], n, color, [uvScale, 0], mat, obj);
      this.vert(points[2], n, color, [uvScale, uvScale], mat, obj);
      this.idx.push(base, base + 1, base + 2);
      return base;
    }
    const uvs = points.map((p, i) => {
      if (i === 0) return [0, 0];
      if (i === 1) return [uvScale, 0];
      if (i === 2) return [uvScale, uvScale];
      return [0, uvScale];
    });
    return this.quad(points[0], points[1], points[2], points[3], n, color, uvs[0], uvs[1], uvs[2], uvs[3], mat, obj);
  }
  box(cx, cy, cz, sx, sy, sz, color, mat, obj, rotY = 0) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2;
    const y0 = cy - sy / 2, y1 = cy + sy / 2;
    const z0 = cz - sz / 2, z1 = cz + sz / 2;
    const cyr = Math.cos(rotY), syr = Math.sin(rotY);
    const tr = (x, z) => {
      const lx = x - cx, lz = z - cz;
      return [cx + lx * cyr + lz * syr, cz - lx * syr + lz * cyr];
    };
    const faces = [
      { pts: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], n: [1, 0, 0], uv: [sz, sy] },
      { pts: [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], n: [-1, 0, 0], uv: [sz, sy] },
      { pts: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], n: [0, 1, 0], uv: [sx, sz] },
      { pts: [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]], n: [0, -1, 0], uv: [sx, sz] },
      { pts: [[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]], n: [0, 0, 1], uv: [sx, sy] },
      { pts: [[x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z0]], n: [0, 0, -1], uv: [sx, sy] }
    ];
    for (const f of faces) {
      const pts = f.pts.map(p => {
        const [tx, tz] = tr(p[0], p[2]);
        return [tx, p[1], tz];
      });
      let n = f.n;
      if (rotY) {
        const nx = n[0] * cyr + n[2] * syr;
        const nz = -n[0] * syr + n[2] * cyr;
        n = [nx, n[1], nz];
      }
      this.face(pts, n, color, mat, obj, Math.max(0.3, Math.max(f.uv[0], f.uv[1]) * 5));
    }
  }
  tube(a, b, r, color, mat, obj, segments = 8, rTop = null) {
    const dir = V3.norm(V3.sub(b, a));
    const helper = Math.abs(dir[1]) > .88 ? [1, 0, 0] : [0, 1, 0];
    const side = V3.norm(V3.cross(helper, dir));
    const up = V3.norm(V3.cross(dir, side));
    const rt = rTop === null ? r : rTop;
    const base = this.count;
    for (let i = 0; i <= segments; i++) {
      const th = i / segments * TAU;
      const cs = Math.cos(th), sn = Math.sin(th);
      const rad = [side[0] * cs + up[0] * sn, side[1] * cs + up[1] * sn, side[2] * cs + up[2] * sn];
      const na = V3.norm(rad);
      this.vert([a[0] + rad[0] * r, a[1] + rad[1] * r, a[2] + rad[2] * r], na, color, [i / segments, 0], mat, obj);
      this.vert([b[0] + rad[0] * rt, b[1] + rad[1] * rt, b[2] + rad[2] * rt], na, color, [i / segments, 1], mat, obj);
    }
    for (let i = 0; i < segments; i++) {
      const a0 = base + i * 2, a1 = a0 + 1, b0 = a0 + 2, b1 = a0 + 3;
      this.idx.push(a0, b0, a1, a1, b0, b1);
    }
    const capBase = this.count;
    const ca = this.vert(a, V3.mul(dir, -1), color, [0, 0], mat, obj);
    const cb = this.vert(b, dir, color, [0, 0], mat, obj);
    for (let i = 0; i < segments; i++) {
      const th0 = i / segments * TAU, th1 = (i + 1) / segments * TAU;
      const p0 = [a[0] + (side[0] * Math.cos(th0) + up[0] * Math.sin(th0)) * r, a[1] + (side[1] * Math.cos(th0) + up[1] * Math.sin(th0)) * r, a[2] + (side[2] * Math.cos(th0) + up[2] * Math.sin(th0)) * r];
      const p1 = [a[0] + (side[0] * Math.cos(th1) + up[0] * Math.sin(th1)) * r, a[1] + (side[1] * Math.cos(th1) + up[1] * Math.sin(th1)) * r, a[2] + (side[2] * Math.cos(th1) + up[2] * Math.sin(th1)) * r];
      const i0 = this.vert(p0, V3.mul(dir, -1), color, [0, 0], mat, obj);
      const i1 = this.vert(p1, V3.mul(dir, -1), color, [0, 0], mat, obj);
      this.idx.push(ca, i1, i0);
    }
    if (rt > 0) {
      for (let i = 0; i < segments; i++) {
        const th0 = i / segments * TAU, th1 = (i + 1) / segments * TAU;
        const p0 = [b[0] + (side[0] * Math.cos(th0) + up[0] * Math.sin(th0)) * rt, b[1] + (side[1] * Math.cos(th0) + up[1] * Math.sin(th0)) * rt, b[2] + (side[2] * Math.cos(th0) + up[2] * Math.sin(th0)) * rt];
        const p1 = [b[0] + (side[0] * Math.cos(th1) + up[0] * Math.sin(th1)) * rt, b[1] + (side[1] * Math.cos(th1) + up[1] * Math.sin(th1)) * rt, b[2] + (side[2] * Math.cos(th1) + up[2] * Math.sin(th1)) * rt];
        const i0 = this.vert(p0, dir, color, [0, 0], mat, obj);
        const i1 = this.vert(p1, dir, color, [0, 0], mat, obj);
        this.idx.push(cb, i0, i1);
      }
    }
  }
  beam(a, b, w, h, color, mat, obj) {
    const dir = V3.norm(V3.sub(b, a));
    const helper = Math.abs(dir[1]) > .9 ? [1, 0, 0] : [0, 1, 0];
    const side = V3.norm(V3.cross(helper, dir));
    const up = V3.norm(V3.cross(dir, side));
    const corners = [
      [-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]
    ];
    const ring = (p) => corners.map(([x, y]) => [
      p[0] + side[0] * x + up[0] * y,
      p[1] + side[1] * x + up[1] * y,
      p[2] + side[2] * x + up[2] * y
    ]);
    const A = ring(a), B = ring(b);
    const faces = [
      [A[0], A[1], B[1], B[0], V3.mul(side, -1)],
      [A[1], A[2], B[2], B[1], up],
      [A[2], A[3], B[3], B[2], side],
      [A[3], A[0], B[0], B[3], V3.mul(up, -1)],
      [A[0], A[3], A[2], A[1], V3.mul(dir, -1)],
      [B[0], B[1], B[2], B[3], dir]
    ];
    for (const f of faces) this.face([f[0], f[1], f[2], f[3]], f[4], color, mat, obj);
  }
  cylinder(cx, cy, cz, r, h, color, mat, obj, segments = 12, rTop = null) {
    this.tube([cx, cy - h / 2, cz], [cx, cy + h / 2, cz], r, color, mat, obj, segments, rTop);
  }
  sphere(cx, cy, cz, rx, ry, rz, color, mat, obj, segments = 12, rings = 8, jitter = 0, seed = 1) {
    const base = this.count;
    const rng = mulberry32(seed);
    for (let j = 0; j <= rings; j++) {
      const phi = j / rings * PI;
      const sp = Math.sin(phi), cp = Math.cos(phi);
      for (let i = 0; i <= segments; i++) {
        const th = i / segments * TAU;
        const jitterV = jitter ? 1 + (rng() * 2 - 1) * jitter : 1;
        const nx = sp * Math.cos(th), ny = cp, nz = sp * Math.sin(th);
        this.vert([cx + nx * rx * jitterV, cy + ny * ry * jitterV, cz + nz * rz * jitterV], V3.norm([nx / rx, ny / ry, nz / rz]), color, [i / segments, j / rings], mat, obj);
      }
    }
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < segments; i++) {
        const a = base + j * (segments + 1) + i;
        const b = a + 1, c = a + segments + 1, d = c + 1;
        this.idx.push(a, c, b, b, c, d);
      }
    }
  }
  cone(cx, cy, cz, r, h, color, mat, obj, segments = 12) {
    const base = this.count;
    const tip = this.vert([cx, cy + h, cz], [0, 1, 0], color, [0, 1], mat, obj);
    for (let i = 0; i <= segments; i++) {
      const th = i / segments * TAU;
      const p = [cx + Math.cos(th) * r, cy, cz + Math.sin(th) * r];
      const n = V3.norm([Math.cos(th), r / Math.max(h, .001), Math.sin(th)]);
      this.vert(p, n, color, [i / segments, 0], mat, obj);
    }
    for (let i = 0; i < segments; i++) {
      const a = base + 1 + i, b = base + 2 + i;
      this.idx.push(tip, a, b);
    }
    const bot = this.vert([cx, cy, cz], [0, -1, 0], color, [0, 0], mat, obj);
    for (let i = 0; i < segments; i++) {
      const th0 = i / segments * TAU, th1 = (i + 1) / segments * TAU;
      const p0 = [cx + Math.cos(th0) * r, cy, cz + Math.sin(th0) * r];
      const p1 = [cx + Math.cos(th1) * r, cy, cz + Math.sin(th1) * r];
      const a = this.vert(p0, [0, -1, 0], color, [0, 0], mat, obj);
      const b = this.vert(p1, [0, -1, 0], color, [0, 0], mat, obj);
      this.idx.push(bot, b, a);
    }
  }
  torus(cx, cy, cz, R, r, color, mat, obj, segments = 20, tubeSeg = 6, rot = Q.identity()) {
    const base = this.count;
    for (let i = 0; i <= segments; i++) {
      const u = i / segments * TAU;
      const cu = Math.cos(u), su = Math.sin(u);
      for (let j = 0; j <= tubeSeg; j++) {
        const v = j / tubeSeg * TAU;
        const cv = Math.cos(v), sv = Math.sin(v);
        const local = [(R + r * cv) * cu, r * sv, (R + r * cv) * su];
        const p = Q.rotate(rot, local);
        const nl = [cv * cu, sv, cv * su];
        const n = Q.rotate(rot, nl);
        this.vert([cx + p[0], cy + p[1], cz + p[2]], V3.norm(n), color, [i / segments, j / tubeSeg], mat, obj);
      }
    }
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < tubeSeg; j++) {
        const a = base + i * (tubeSeg + 1) + j;
        const b = a + tubeSeg + 1, c = a + 1, d = b + 1;
        this.idx.push(a, b, c, c, b, d);
      }
    }
  }
  roofGable(cx, cy, cz, w, d, h, color, mat, obj, ridgeZ = true, over = 0.03) {
    const x0 = cx - w / 2 - over, x1 = cx + w / 2 + over;
    const z0 = cz - d / 2 - over, z1 = cz + d / 2 + over;
    if (ridgeZ) {
      const ridge0 = [cx, cy + h, z0], ridge1 = [cx, cy + h, z1];
      const slope = Math.hypot(w / 2 + over, h);
      const nL = V3.norm([-h, (w / 2 + over), 0]);
      const nR = V3.norm([h, (w / 2 + over), 0]);
      this.face([ridge0, ridge1, [x1, cy, z1], [x1, cy, z0]], nR, color, mat, obj, 4);
      this.face([[x0, cy, z0], [x0, cy, z1], ridge1, ridge0], nL, color, mat, obj, 4);
      // gable end triangles in wall colour are left to the caller.
    } else {
      const ridge0 = [x0, cy + h, cz], ridge1 = [x1, cy + h, cz];
      const nF = V3.norm([0, d / 2 + over, h]);
      const nB = V3.norm([0, -(d / 2 + over), h]);
      this.face([ridge0, ridge1, [x1, cy, z1], [x0, cy, z1]], nF, color, mat, obj, 4);
      this.face([[x0, cy, z0], [x1, cy, z0], ridge1, ridge0], nB, color, mat, obj, 4);
    }
  }
  gableEnds(cx, cy, cz, w, d, h, color, mat, obj, ridgeZ = true) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    if (ridgeZ) {
      this.face([[x0, cy, z1], [cx, cy + h, z1], [x1, cy, z1]], [0, 0, 1], color, mat, obj, 2);
      this.face([[x1, cy, z0], [cx, cy + h, z0], [x0, cy, z0]], [0, 0, -1], color, mat, obj, 2);
    } else {
      this.face([[x1, cy, z1], [x1, cy + h, cz], [x1, cy, z0]], [1, 0, 0], color, mat, obj, 2);
      this.face([[x0, cy, z0], [x0, cy + h, cz], [x0, cy, z1]], [-1, 0, 0], color, mat, obj, 2);
    }
  }
  star(cx, cy, cz, r, thickness, color, mat, obj, points = 5) {
    const top = this.vert([cx, cy + thickness / 2, cz], [0, 1, 0], color, [0, 0], mat, obj);
    const bot = this.vert([cx, cy - thickness / 2, cz], [0, -1, 0], color, [0, 0], mat, obj);
    const pts = [];
    for (let i = 0; i < points * 2; i++) {
      const a = i / (points * 2) * TAU - PI / 2;
      const rad = i % 2 === 0 ? r : r * 0.42;
      pts.push([cx + Math.cos(a) * rad, cy, cz + Math.sin(a) * rad]);
    }
    const topRing = pts.map(p => this.vert([p[0], p[1] + thickness / 2, p[2]], [0, 1, 0], color, [0, 0], mat, obj));
    const botRing = pts.map(p => this.vert([p[0], p[1] - thickness / 2, p[2]], [0, -1, 0], color, [0, 0], mat, obj));
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      this.idx.push(top, topRing[i], topRing[j]);
      this.idx.push(bot, botRing[j], botRing[i]);
      this.quad([pts[i][0], cy + thickness / 2, pts[i][2]], [pts[j][0], cy + thickness / 2, pts[j][2]], [pts[j][0], cy - thickness / 2, pts[j][2]], [pts[i][0], cy - thickness / 2, pts[i][2]], V3.norm([pts[j][2] - pts[i][2], 0, -(pts[j][0] - pts[i][0])]), color, [0, 0], [1, 0], [1, 1], [0, 1], mat, obj);
    }
  }
}

// A lofted small-ship hull. Stations run along z, forward is +z.
function loftHull(b, obj, sections, hullColor, deckColor, deckMat = 4) {
  for (let s = 0; s < sections.length - 1; s++) {
    const a = sections[s], c = sections[s + 1];
    const aw = a.w, cw = c.w;
    const at = a.y, ct = c.y, ab = a.b, cb = c.b;
    // sides
    b.face([[ -aw, ab, a.z], [-cw, cb, c.z], [-cw, ct, c.z], [-aw, at, a.z]], V3.norm([-1, 0, 0]), hullColor, 11, obj, 3);
    b.face([[cw, cb, c.z], [aw, ab, a.z], [aw, at, a.z], [cw, ct, c.z]], V3.norm([1, 0, 0]), hullColor, 11, obj, 3);
    // bottom
    b.face([[-aw, ab, a.z], [aw, ab, a.z], [cw, cb, c.z], [-cw, cb, c.z]], V3.norm([0, -1, 0]), hullColor, 11, obj, 3);
    // deck
    b.face([[-aw, at, a.z], [-cw, ct, c.z], [cw, ct, c.z], [aw, at, a.z]], V3.norm([0, 1, 0]), deckColor, deckMat, obj, 2);
  }
  const first = sections[0], last = sections[sections.length - 1];
  b.face([[-first.w, first.b, first.z], [-first.w, first.y, first.z], [first.w, first.y, first.z], [first.w, first.b, first.z]], V3.norm([0, 0, -1]), hullColor, 11, obj, 2);
  b.face([[last.w, last.b, last.z], [last.w, last.y, last.z], [-last.w, last.y, last.z], [-last.w, last.b, last.z]], V3.norm([0, 0, 1]), hullColor, 11, obj, 2);
}

function containerUnitMesh() {
  const positions = [], normals = [], uvs = [], indices = [];
  const face = (pts, n) => {
    const base = positions.length / 3;
    for (const p of pts) { positions.push(...p); normals.push(...n); }
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  face([[-.5, -.5, -.5], [.5, -.5, -.5], [.5, .5, -.5], [-.5, .5, -.5]], [0, 0, -1]);
  face([[.5, -.5, .5], [-.5, -.5, .5], [-.5, .5, .5], [.5, .5, .5]], [0, 0, 1]);
  face([[-.5, -.5, .5], [-.5, -.5, -.5], [-.5, .5, -.5], [-.5, .5, .5]], [-1, 0, 0]);
  face([[.5, -.5, -.5], [.5, -.5, .5], [.5, .5, .5], [.5, .5, -.5]], [1, 0, 0]);
  face([[-.5, .5, -.5], [.5, .5, -.5], [.5, .5, .5], [-.5, .5, .5]], [0, 1, 0]);
  face([[-.5, -.5, .5], [.5, -.5, .5], [.5, -.5, -.5], [-.5, -.5, -.5]], [0, -1, 0]);
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices)
  };
}

function quadMesh(positions, normals, uvs, indices) {
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs), indices: new Uint16Array(indices) };
}