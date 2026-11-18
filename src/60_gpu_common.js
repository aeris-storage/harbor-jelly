/* ============================================================
   GPU helpers, camera and per-frame object transforms
   ============================================================ */
const PALETTES = {
  sea: {
    shallow: C('#79cabb'), deep: C('#1f7176'), absorb: .95,
    strataTint: C('#91d7c4')
  },
  blueberry: {
    shallow: C('#7e9dd6'), deep: C('#244371'), absorb: 1.2,
    strataTint: C('#a5b5d8')
  },
  lime: {
    shallow: C('#bfd98d'), deep: C('#4c7b51'), absorb: .82,
    strataTint: C('#dbe4a1')
  }
};

class OrbitCamera {
  constructor() {
    this.target = [0.0, -0.30, 0.03];
    this.yaw = .62;
    this.pitch = .56;
    this.distance = 10.25;
    this.fov = 34 * DEG;
    this.near = .25;
    this.far = 45;
    this.view = M4.identity();
    this.proj = M4.identity();
    this.viewProj = M4.identity();
    this.invViewProj = M4.identity();
    this.eye = [0, 0, 0];
    this.right = [1, 0, 0];
    this.up = [0, 1, 0];
    this.aspect = 1;
    this.shiftX = .075;
  }
  reset() {
    this.target = [0.0, -0.30, 0.03];
    this.yaw = .62;
    this.pitch = .56;
    this.distance = 10.25;
  }
  update(aspect, shiftX) {
    this.aspect = aspect;
    this.shiftX = shiftX;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this.eye = [
      this.target[0] + Math.sin(this.yaw) * cp * this.distance,
      this.target[1] + sp * this.distance,
      this.target[2] + Math.cos(this.yaw) * cp * this.distance
    ];
    this.view = M4.lookAt(this.eye, this.target, [0, 1, 0]);
    this.proj = M4.perspective(this.fov, aspect, this.near, this.far, shiftX, .015);
    this.viewProj = M4.mul(this.proj, this.view);
    this.invViewProj = M4.invert(this.viewProj);
    this.right = [this.view[0], this.view[4], this.view[8]];
    this.up = [this.view[1], this.view[5], this.view[9]];
  }
  orbit(dx, dy) {
    this.yaw -= dx * .0062;
    this.pitch = clamp(this.pitch + dy * .005, .08, 1.04);
  }
  zoom(delta) {
    this.distance = clamp(this.distance * (1 + delta * .00088), 6.7, 13.6);
  }
  ray(nx, ny) {
    return rayFromNdc(this.invViewProj, nx, ny);
  }
}

function mergeBuilders(builders) {
  let count = 0, indices = 0;
  for (const b of builders) { count += b.count; indices += b.idx.length; }
  const verts = new Float32Array(count * 13);
  const idx = new Uint32Array(indices);
  let fo = 0, vo = 0, io = 0;
  for (const b of builders) {
    const n = b.count;
    for (let i = 0; i < n; i++) {
      const o = fo + i * 13;
      verts[o] = b.pos[i * 3];
      verts[o + 1] = b.pos[i * 3 + 1];
      verts[o + 2] = b.pos[i * 3 + 2];
      verts[o + 3] = b.nrm[i * 3];
      verts[o + 4] = b.nrm[i * 3 + 1];
      verts[o + 5] = b.nrm[i * 3 + 2];
      verts[o + 6] = b.col[i * 3];
      verts[o + 7] = b.col[i * 3 + 1];
      verts[o + 8] = b.col[i * 3 + 2];
      verts[o + 9] = b.uvs[i * 2];
      verts[o + 10] = b.uvs[i * 2 + 1];
      verts[o + 11] = b.mats[i];
      verts[o + 12] = b.objs[i];
    }
    for (let i = 0; i < b.idx.length; i++) idx[io + i] = b.idx[i] + vo;
    fo += n * 13;
    vo += n;
    io += b.idx.length;
  }
  return { verts, idx, vertexCount: count, indexCount: indices };
}

function gpuBuffer(device, data, usage, label) {
  const bytes = data.byteLength;
  const size = Math.max(4, Math.ceil(bytes / 4) * 4);
  const buffer = device.createBuffer({ size, usage: usage | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC, label: label || 'buffer' });
  if (data instanceof Float32Array) device.queue.writeBuffer(buffer, 0, data, 0, Math.ceil(bytes / 4));
  else if (data instanceof Uint32Array) device.queue.writeBuffer(buffer, 0, data, 0, bytes / 4);
  else if (data instanceof Uint16Array) device.queue.writeBuffer(buffer, 0, data, 0, bytes / 2);
  else if (data) device.queue.writeBuffer(buffer, 0, data, 0, bytes);
  return buffer;
}

function bufferFromFloatData(device, data, usage, label) {
  const size = Math.ceil(data.byteLength / 4) * 4;
  const buffer = device.createBuffer({ size, usage: usage | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC, label: label || 'buffer' });
  device.queue.writeBuffer(buffer, 0, data, 0, data.length);
  return buffer;
}

const PROP_LAYOUT = {
  arrayStride: 52,
  attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x3' },
    { shaderLocation: 1, offset: 12, format: 'float32x3' },
    { shaderLocation: 2, offset: 24, format: 'float32x3' },
    { shaderLocation: 3, offset: 36, format: 'float32x2' },
    { shaderLocation: 4, offset: 44, format: 'float32' },
    { shaderLocation: 5, offset: 48, format: 'float32' }
  ]
};
const CONTAINER_MESH_LAYOUT = {
  arrayStride: 32,
  attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x3' },
    { shaderLocation: 1, offset: 12, format: 'float32x3' },
    { shaderLocation: 2, offset: 24, format: 'float32x2' }
  ]
};
const INSTANCE_LAYOUT = {
  arrayStride: 80,
  stepMode: 'instance',
  attributes: [
    { shaderLocation: 3, offset: 0, format: 'float32x4' },
    { shaderLocation: 4, offset: 16, format: 'float32x4' },
    { shaderLocation: 5, offset: 32, format: 'float32x4' },
    { shaderLocation: 6, offset: 48, format: 'float32x4' },
    { shaderLocation: 7, offset: 64, format: 'float32x4' }
  ]
};
const LIFE_INSTANCE_LAYOUT = {
  arrayStride: 96,
  stepMode: 'instance',
  attributes: [
    { shaderLocation: 4, offset: 0, format: 'float32x4' },
    { shaderLocation: 5, offset: 16, format: 'float32x4' },
    { shaderLocation: 6, offset: 32, format: 'float32x4' },
    { shaderLocation: 7, offset: 48, format: 'float32x4' },
    { shaderLocation: 8, offset: 64, format: 'float32x4' },
    { shaderLocation: 9, offset: 80, format: 'float32x4' }
  ]
};
const PARTICLE_INSTANCE_LAYOUT = {
  arrayStride: 48,
  stepMode: 'instance',
  attributes: [
    { shaderLocation: 3, offset: 0, format: 'float32x4' },
    { shaderLocation: 4, offset: 16, format: 'float32x4' },
    { shaderLocation: 5, offset: 32, format: 'float32x4' }
  ]
};
const LINE_LAYOUT = {
  arrayStride: 24,
  attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x3' },
    { shaderLocation: 1, offset: 12, format: 'float32x3' }
  ]
};
const WATER_LAYOUT = {
  arrayStride: 32,
  attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x3' },
    { shaderLocation: 1, offset: 12, format: 'float32x3' },
    { shaderLocation: 2, offset: 24, format: 'float32x2' }
  ]
};

function updateObjectTransforms(sim, water, tide, time, lifeRing) {
  const out = [];
  for (let i = 0; i < 24; i++) out.push(M4.identity());
  const waterY = HarborCore.WATER_Y + tide;
  const shipBob = water.heightAt(sim.ship.x, sim.ship.z) * .55;
  const shipY = waterY + shipBob + sim.ship.heave;
  const shipQ = Q.fromEuler(sim.ship.pitch, sim.ship.yaw, sim.ship.roll);
  const shipM = M4.fromQuatPosScale(shipQ, [sim.ship.x, shipY, sim.ship.z], [1, 1, 1]);
  out[OBJ.ship] = shipM;

  const tugBob = water.heightAt(sim.tug.x, sim.tug.z) * .7;
  const tugY = waterY + tugBob + Math.sin(time * 1.4) * .009;
  const tugM = M4.fromQuatPosScale(Q.fromEuler(Math.sin(time * 1.1) * .025, sim.tug.yaw, Math.sin(time * .9) * .035), [sim.tug.x, tugY, sim.tug.z], [1, 1, 1]);
  out[OBJ.tug] = tugM;

  const sailState = [
    { obj: OBJ.sailA, boat: HarborCore.LAYOUT.sailboats[0], phase: .3 },
    { obj: OBJ.sailB, boat: HarborCore.LAYOUT.sailboats[1], phase: 1.9 }
  ];
  for (const s of sailState) {
    const p = s.boat;
    const bob = water.heightAt(p.x, p.z);
    const y = waterY + bob + Math.sin(time * 1.25 + s.phase) * .012;
    const swing = Math.sin(time * .55 + s.phase) * .035;
    const m = M4.fromQuatPosScale(Q.fromEuler(Math.sin(time * .9 + s.phase) * .055, p.yaw + swing, Math.sin(time * 1.1 + s.phase) * .09), [p.x, y, p.z], [1, 1, 1]);
    out[s.obj] = m;
  }
  const buoyObjs = [OBJ.buoyY1, OBJ.buoyY2, OBJ.buoyG];
  HarborCore.LAYOUT.buoys.forEach((b, i) => {
    const bob = water.heightAt(b.x, b.z);
    const y = waterY + bob + Math.sin(time * 1.7 + i * 2.3) * .012;
    const q = Q.fromEuler(Math.sin(time * 1.2 + i) * .14, time * .1 + i, Math.sin(time * 1.4 + i) * .15);
    out[buoyObjs[i]] = M4.fromQuatPosScale(q, [b.x, y, b.z], [1, 1, 1]);
  });
  // fishing boats alongside the stone quay
  const fishing = [
    { obj: OBJ.fishing0, x: HarborCore.LAYOUT.fishingBoats[0].x, z: HarborCore.LAYOUT.fishingBoats[0].z, yaw: HarborCore.LAYOUT.fishingBoats[0].yaw, phase: .2 },
    { obj: OBJ.fishing1, x: HarborCore.LAYOUT.fishingBoats[1].x, z: HarborCore.LAYOUT.fishingBoats[1].z, yaw: HarborCore.LAYOUT.fishingBoats[1].yaw, phase: 1.7 }
  ];
  for (const f of fishing) {
    const y = waterY + water.heightAt(f.x, f.z) + Math.sin(time * 1.35 + f.phase) * .011;
    out[f.obj] = M4.fromQuatPosScale(Q.fromEuler(Math.sin(time * 1.1 + f.phase) * .04, f.yaw + Math.sin(time * .37 + f.phase) * .035, Math.sin(time * .92 + f.phase) * .055), [f.x, y, f.z], [1, 1, 1]);
  }
  // crane comps
  for (let i = 0; i < 2; i++) {
    const c = sim.cranes[i];
    const baseObj = i === 0 ? OBJ.crane0Base : OBJ.crane1Base;
    const boomObj = i === 0 ? OBJ.crane0Boom : OBJ.crane1Boom;
    const trolleyObj = i === 0 ? OBJ.crane0Trolley : OBJ.crane1Trolley;
    const spreaderObj = i === 0 ? OBJ.crane0Spreader : OBJ.crane1Spreader;
    const base = M4.translation([HarborCore.CRANE.railX, HarborCore.CRANE.baseY, c.gantryZ]);
    out[baseObj] = base;
    const hinge = [HarborCore.CRANE.railX, HarborCore.CRANE.hingeY, c.gantryZ];
    const boomQ = Q.axisAngle([0, 0, 1], c.boomAngle);
    out[boomObj] = M4.fromQuatPosScale(boomQ, hinge, [1, 1, 1]);
    const ca = Math.cos(c.boomAngle), sa = Math.sin(c.boomAngle);
    const tx = hinge[0] + c.trolley * ca;
    const ty = hinge[1] + c.trolley * sa;
    out[trolleyObj] = M4.translation([tx, ty, c.gantryZ]);
    const sway = c.carrying ? Math.sin(time * 2.4 + i * 1.8) * .006 : 0;
    out[spreaderObj] = M4.fromQuatPosScale(Q.fromEuler(sway, 0, -sway * .8), [tx + sway, c.spreaderY, c.gantryZ], [1, 1, 1]);
  }
  // life ring
  const r = lifeRing;
  if (r) {
    const waterLevel = waterY + water.heightAt(r.x, r.z);
    if (r.state === 'held') {
      out[OBJ.lifeRing] = M4.fromQuatPosScale(Q.fromEuler(r.tilt || 0, r.yaw || 0, 0), [r.x, r.y, r.z], [1, 1, 1]);
    } else {
      const y = r.state === 'air' ? r.y : waterLevel + .035 + Math.sin(time * 2.2 + r.phase) * .006;
      out[OBJ.lifeRing] = M4.fromQuatPosScale(Q.fromEuler(Math.sin(time * 1.7 + r.phase) * (r.state === 'air' ? .15 : .09), r.yaw || 0, Math.sin(time * 1.9 + r.phase) * (r.state === 'air' ? .24 : .055)), [r.x, y, r.z], [1, 1, 1]);
    }
  }
  // lighthouse lens, slowly sweeping
  out[OBJ.lens] = M4.fromQuatPosScale(Q.axisAngle([0, 1, 0], time * .24), [LIGHTHOUSE.x, LIGHTHOUSE.lensY, LIGHTHOUSE.z], [1, 1, 1]);
  // ship radar
  const radarLocal = M4.mul(M4.translation([0, .535, -.55]), M4.fromQuatPosScale(Q.axisAngle([0, 1, 0], time * 1.35), [0, 0, 0], [1, 1, 1]));
  out[OBJ.shipRadar] = M4.mul(shipM, radarLocal);
  // propeller
  const propLocal = M4.mul(M4.translation([0, -.062, -.774]), M4.fromQuatPosScale(Q.axisAngle([0, 0, 1], time * 6.5), [0, 0, 0], [1, 1, 1]));
  out[OBJ.shipProp] = M4.mul(shipM, propLocal);
  return out;
}

function containerMatrix(x, y, z, rotY, scale) {
  const t = M4.translation([x, y, z]);
  const r = M4.fromQuatPosScale(Q.axisAngle([0, 1, 0], rotY || 0), [0, 0, 0], [1, 1, 1]);
  const s = M4.scale(scale);
  return M4.mul(M4.mul(t, r), s);
}

function shipSlotLocal(slot) {
  const c = HarborCore.CONTAINER;
  return [
    -.111 + slot.row * .074,
    .108 + c.h * .5 + slot.tier * c.h,
    -.63 + slot.bay * .214
  ];
}

function buildContainerInstances(sim, objects, plan, out, maxCount) {
  let count = 0;
  const c = HarborCore.CONTAINER;
  const scale = [c.w, c.h, c.l];
  const shipMat = objects[OBJ.ship];
  const pushMat = (m, color, seed) => {
    if (count >= maxCount) return;
    const o = count * 20;
    for (let i = 0; i < 16; i++) out[o + i] = m[i];
    const col = C(color);
    out[o + 16] = col[0]; out[o + 17] = col[1]; out[o + 18] = col[2]; out[o + 19] = seed;
    count++;
  };
  // yard stacks
  for (const yc of plan.yard) {
    pushMat(containerMatrix(yc.x, yc.y, yc.z, yc.rot, scale), yc.color, hash(yc.x * 13, yc.y * 71, yc.z * 29));
  }
  // static ship cargo
  for (const sc of plan.shipStatic) {
    const local = shipSlotLocal(sc);
    const m = M4.mul(M4.mul(shipMat, M4.translation(local)), M4.mul(M4.fromQuatPosScale(Q.identity(), [0, 0, 0], [1, 1, 1]), M4.scale(scale)));
    pushMat(m, sc.color, hash(sc.bay * 5, sc.row * 11, sc.tier * 3));
  }
  // transfer cargo
  for (const item of sim.cargo) {
    if (item.state === 'ship') {
      const local = shipSlotLocal(item.shipSlot);
      const m = M4.mul(M4.mul(shipMat, M4.translation(local)), M4.scale(scale));
      pushMat(m, item.color, hash(item.shipSlot.bay + 1, item.shipSlot.row + 3, item.shipSlot.tier + 7));
    } else if (item.state === 'yard') {
      const p = item.world || { x: item.yardSlot.x, y: item.yardSlot.y + c.h * .5, z: item.yardSlot.z, yaw: 0 };
      pushMat(containerMatrix(p.x, p.y, p.z, p.yaw || 0, scale), item.color, hash(p.x, p.z, 2));
    } else if (item.state === 'carrying' && item.world) {
      const p = item.world;
      pushMat(containerMatrix(p.x, p.y, p.z, p.yaw || 0, scale), item.color, hash(p.x, p.z, 5));
    }
  }
  return count;
}

function buildCableLines(sim, objects, out, maxFloats) {
  let count = 0;
  const push = (a, b, color, alpha) => {
    if ((count + 2) * 6 > maxFloats) return;
    for (let i = 0; i < 2; i++) {
      const p = i === 0 ? a : b;
      const o = count * 6;
      out[o] = p[0]; out[o + 1] = p[1]; out[o + 2] = p[2];
      out[o + 3] = color[0]; out[o + 4] = color[1]; out[o + 5] = color[2];
      count++;
    }
  };
  const tr = (m, p) => M4.transformPoint(m, p);
  const cable = C('#d8cdae');
  for (let i = 0; i < 2; i++) {
    const baseObj = i === 0 ? OBJ.crane0Base : OBJ.crane1Base;
    const boomObj = i === 0 ? OBJ.crane0Boom : OBJ.crane1Boom;
    const trolleyObj = i === 0 ? OBJ.crane0Trolley : OBJ.crane1Trolley;
    const spreaderObj = i === 0 ? OBJ.crane0Spreader : OBJ.crane1Spreader;
    const base = objects[baseObj], boom = objects[boomObj], trolley = objects[trolleyObj], spreader = objects[spreaderObj];
    const apex = tr(base, [.02, 1.54, 0]);
    const tip = tr(boom, [1.46, 0, 0]);
    push(apex, tip, cable);
    push(tr(base, [.02, 1.54, -.07]), tr(boom, [.98, .11, -.07]), cable);
    push(tr(base, [.02, 1.54, .07]), tr(boom, [.98, .11, .07]), cable);
    for (const sx of [-.06, .06]) for (const sz of [-.08, .08]) {
      const a = tr(trolley, [sx, -.035, sz]);
      const b = tr(spreader, [sx * 2.25, .016, sz * 1.1]);
      push(a, b, C('#4e5550'));
    }
  }
  if (sim.tug.lineAttached) {
    const shipM = objects[OBJ.ship], tugM = objects[OBJ.tug];
    const bow = tr(shipM, [0, .17, .72]);
    const stern = tr(tugM, [0, .10, -.27]);
    push(bow, stern, C('#d9c9a5'));
    // a slight parcel of slack
    const mid = [(bow[0] + stern[0]) / 2, Math.min(bow[1], stern[1]) - .02, (bow[2] + stern[2]) / 2];
    push(bow, mid, C('#d9c9a5'));
    push(mid, stern, C('#d9c9a5'));
  }
  return count;
}

function lifeInstanceWrite(out, offset, matrix, color, extra) {
  for (let i = 0; i < 16; i++) out[offset + i] = matrix[i];
  out[offset + 16] = color[0]; out[offset + 17] = color[1]; out[offset + 18] = color[2]; out[offset + 19] = color[3];
  out[offset + 20] = extra[0]; out[offset + 21] = extra[1]; out[offset + 22] = extra[2]; out[offset + 23] = extra[3];
}