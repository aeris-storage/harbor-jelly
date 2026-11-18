/* ============================================================
   WebGPU renderer
   ============================================================ */
const QUAD_LAYOUT = {
  arrayStride: 20,
  attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x3' },
    { shaderLocation: 1, offset: 12, format: 'float32x2' }
  ]
};
const MESH_LAYOUT = {
  arrayStride: 32,
  attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x3' },
    { shaderLocation: 1, offset: 12, format: 'float32x3' },
    { shaderLocation: 2, offset: 24, format: 'float32x2' }
  ]
};
const LIFE_MESH_LAYOUT = {
  arrayStride: 36,
  attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x3' },
    { shaderLocation: 1, offset: 12, format: 'float32x3' },
    { shaderLocation: 2, offset: 24, format: 'float32x2' },
    { shaderLocation: 3, offset: 32, format: 'float32' }
  ]
};

function u32Align4(n) { return Math.ceil(n / 4) * 4; }

class HarborRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ready = false;
    this.plan = null;
    this.perches = [];
    this.camera = new OrbitCamera();
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.sunDir = V3.norm([-.32, .92, .4]);
    this.sceneData = new Float32Array(SCENE_FLOATS);
    this.waterData = new Float32Array(WATER_FLOATS);
    this.postData = new Float32Array(4);
    this.containerScratch = new Float32Array(800 * 20);
    this.fishScratch = new Float32Array(96 * 24);
    this.gullScratch = new Float32Array(24 * 24);
    this.jellyScratch = new Float32Array(14 * 24);
    this.particleScratch = new Float32Array(600 * 12);
    this.lineScratch = new Float32Array(4096 * 6);
    this.containerCount = 0;
    this.fishCount = 0;
    this.gullCount = 0;
    this.jellyCount = 0;
    this.particleCount = 0;
    this.lineVertexCount = 0;
    this.validationError = null;
    this.objects = null;
    this.lastFrame = null;
    this.frame = 0;
  }

  async init(mesh, plan, perches, waterSim) {
        if (!navigator.gpu) throw new Error('WebGPU is not available');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('No WebGPU adapter');
    const device = await adapter.requestDevice();
    this.device = device;
    this.adapter = adapter;
    this.water = waterSim;
    this.plan = plan;
    this.perches = perches;
    const ctx = this.canvas.getContext('webgpu');
    if (!ctx) throw new Error('Canvas does not expose a WebGPU context');
    this.context = ctx;
    this.format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format: this.format, alphaMode: 'opaque' });

    device.pushErrorScope('validation');

    this.createShaders();

    this.createLayouts();

    this.createShadowResources();
    this.createCausticResources();
    this.createBuffers(mesh);
    this.resize(true);
    this.createPipelines();
    this.ready = true;
    device.addEventListener('uncapturederror', (event) => {
      this.validationError = event.error && event.error.message ? event.error.message : String(event.error);
    });
    device.lost.then((info) => {
      this.deviceLost = info.message;
      if (this.onDeviceLost) this.onDeviceLost(info);
    });
  }

  createShaders() {
    const d = this.device;
    const mod = (code, label) => d.createShaderModule({ code, label });
    this.modules = {
      prop: mod(WGSL.propVert, 'studio props'),
      container: mod(WGSL.containerVert, 'containers'),
      shadow: mod(WGSL.shadowVert, 'prop shadows'),
      containerShadow: mod(WGSL.containerShadowVert, 'container shadows'),
      fish: mod(WGSL.fishVert, 'fish'),
      gull: mod(WGSL.gullVert, 'gulls'),
      jelly: mod(WGSL.jellyVert, 'jellyfish'),
      line: mod(WGSL.lineVert, 'cables'),
      particle: mod(WGSL.particleVert, 'particles'),
      caustic: mod(WGSL.caustic, 'caustics'),
      waterVert: mod(WGSL.waterVert, 'water vertex'),
      waterFrag: mod(WGSL.waterFrag, 'water fragment'),
      post: mod(WGSL.post, 'tone map')
    };
  }

  createLayouts() {
    const d = this.device;
    this.sceneBGL = d.createBindGroupLayout({
      label: 'scene resources',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth', viewDimension: '2d' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
        { binding: 4, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }
      ]
    });
    this.sceneLiteBGL = d.createBindGroupLayout({
      label: 'scene uniform only',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }
      ]
    });
    this.waterBGL = d.createBindGroupLayout({
      label: 'water resources',
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'unfilterable-float', viewDimension: '2d' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }
      ]
    });
    this.postBGL = d.createBindGroupLayout({
      label: 'post resources',
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }
      ]
    });
    this.scenePipelineLayout = d.createPipelineLayout({ bindGroupLayouts: [this.sceneBGL] });
    this.sceneLitePipelineLayout = d.createPipelineLayout({ bindGroupLayouts: [this.sceneLiteBGL] });
    this.waterPipelineLayout = d.createPipelineLayout({ bindGroupLayouts: [this.sceneBGL, this.waterBGL] });
    this.postPipelineLayout = d.createPipelineLayout({ bindGroupLayouts: [this.postBGL] });

    this.sceneBuffer = d.createBuffer({ size: SCENE_FLOATS * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, label: 'scene uniforms' });
    this.waterBuffer = d.createBuffer({ size: WATER_FLOATS * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, label: 'water uniforms' });
    this.postBuffer = d.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, label: 'post uniforms' });
    this.sceneLiteBG = d.createBindGroup({ layout: this.sceneLiteBGL, entries: [{ binding: 0, resource: { buffer: this.sceneBuffer } }] });

    this.shadowSampler = d.createSampler({ label: 'shadow compare', compare: 'less-equal', magFilter: 'linear', minFilter: 'linear' });
    this.repeatSampler = d.createSampler({ label: 'caustic repeat', addressModeU: 'repeat', addressModeV: 'repeat', magFilter: 'linear', minFilter: 'linear' });
    this.clampSampler = d.createSampler({ label: 'screen clamp', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', magFilter: 'linear', minFilter: 'linear' });
  }

  createShadowResources() {
    const d = this.device;
    this.shadowSize = 2048;
    this.shadowTex = d.createTexture({
      size: [this.shadowSize, this.shadowSize], format: 'depth32float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING, label: 'sun shadow'
    });
    this.shadowView = this.shadowTex.createView({ aspect: 'depth-only' });
  }

  createCausticResources() {
    const d = this.device;
    this.causticSize = 512;
    this.causticTex = d.createTexture({
      size: [this.causticSize, this.causticSize], format: 'rgba16float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING, label: 'caustic tile'
    });
    this.causticView = this.causticTex.createView();
  }

  createBuffers(mesh) {
    const d = this.device;
    this.propVB = bufferFromFloatData(d, mesh.verts, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, 'port vertices');
    this.propIB = d.createBuffer({ size: Math.max(4, mesh.idx.byteLength), usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST, label: 'port indices' });
    d.queue.writeBuffer(this.propIB, 0, mesh.idx, 0, mesh.idx.length);
    this.propIndexCount = mesh.idx.length;
    this.propVertexCount = mesh.vertexCount;

    const cMesh = containerUnitMesh();
    this.cMeshVB = bufferFromFloatData(d, cMesh.positions, GPUBufferUsage.VERTEX, 'container mesh positions');
    // Use one interleaved mesh buffer.
    const inter = new Float32Array(cMesh.positions.length + cMesh.normals.length + cMesh.uvs.length);
    const vCount = cMesh.positions.length / 3;
    for (let i = 0; i < vCount; i++) {
      inter[i * 8] = cMesh.positions[i * 3];
      inter[i * 8 + 1] = cMesh.positions[i * 3 + 1];
      inter[i * 8 + 2] = cMesh.positions[i * 3 + 2];
      inter[i * 8 + 3] = cMesh.normals[i * 3];
      inter[i * 8 + 4] = cMesh.normals[i * 3 + 1];
      inter[i * 8 + 5] = cMesh.normals[i * 3 + 2];
      inter[i * 8 + 6] = cMesh.uvs[i * 2];
      inter[i * 8 + 7] = cMesh.uvs[i * 2 + 1];
    }
    this.cMeshVB = bufferFromFloatData(d, inter, GPUBufferUsage.VERTEX, 'container mesh');
    this.cMeshIB = d.createBuffer({ size: cMesh.indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC, label: 'container mesh indices' });
    d.queue.writeBuffer(this.cMeshIB, 0, cMesh.indices, 0, cMesh.indices.length);
    this.cMeshIndexCount = cMesh.indices.length;
    this.containerInstances = d.createBuffer({ size: 800 * 20 * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, label: 'container instances' });

    this.createLifeMeshes();
    this.createWaterMesh();
    this.lineBuffer = d.createBuffer({ size: 4096 * 6 * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, label: 'cable lines' });
  }

  createLifeMeshes() {
    const d = this.device;
    const fish = buildFishMesh();
    const gull = buildGullMesh();
    const jelly = buildJellyMesh();
    const make = (data, label) => {
      const vb = bufferFromFloatData(d, data.vertices, GPUBufferUsage.VERTEX, label + ' vertices');
      const ib = d.createBuffer({ size: Math.max(4, data.indices.byteLength), usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST, label: label + ' indices' });
      d.queue.writeBuffer(ib, 0, data.indices, 0, data.indices.length);
      return { vb, ib, indexCount: data.indices.length };
    };
    this.fishMesh = make(fish, 'fish');
    this.gullMesh = make(gull, 'gull');
    this.jellyMesh = make(jelly, 'jellyfish');
    this.fishBuffer = d.createBuffer({ size: 96 * 24 * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, label: 'fish instances' });
    this.gullBuffer = d.createBuffer({ size: 24 * 24 * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, label: 'gull instances' });
    this.jellyBuffer = d.createBuffer({ size: 14 * 24 * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, label: 'jelly instances' });
    this.particleBuffer = d.createBuffer({ size: 600 * 12 * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, label: 'particles' });
    const quad = new Float32Array([
      -.5, -.5, 0, 0, 0,
      .5, -.5, 0, 1, 0,
      .5, .5, 0, 1, 1,
      -.5, .5, 0, 0, 1
    ]);
    const qIdx = new Uint32Array([0, 1, 2, 0, 2, 3]);
    this.quadVB = bufferFromFloatData(d, quad, GPUBufferUsage.VERTEX, 'particle quad');
    this.quadIB = d.createBuffer({ size: qIdx.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST, label: 'particle quad indices' });
    d.queue.writeBuffer(this.quadIB, 0, qIdx, 0, qIdx.length);
  }

  createWaterMesh() {
    const d = this.device;
    const n = this.water.n;
    const surfaceVertexCount = (n + 1) * (n + 1);
    const sideVertexCount = 16;
    const stride = 8;
    const verts = new Float32Array((surfaceVertexCount + sideVertexCount) * stride);
    this.water.updateSurface(verts, stride, HarborCore.WATER_Y);
    const sideStart = surfaceVertexCount;
    const y0 = -2.06, y1 = .24;
    const sides = [
      { pts: [[-2.6, y0, 2.6], [2.6, y0, 2.6], [2.6, y1, 2.6], [-2.6, y1, 2.6]], n: [0, 0, 1] },
      { pts: [[2.6, y0, -2.6], [-2.6, y0, -2.6], [-2.6, y1, -2.6], [2.6, y1, -2.6]], n: [0, 0, -1] },
      { pts: [[2.6, y0, 2.6], [2.6, y0, -2.6], [2.6, y1, -2.6], [2.6, y1, 2.6]], n: [1, 0, 0] },
      { pts: [[-2.6, y0, -2.6], [-2.6, y0, 2.6], [-2.6, y1, 2.6], [-2.6, y1, -2.6]], n: [-1, 0, 0] }
    ];
    const sideIndices = [];
    sides.forEach((s, si) => {
      for (let i = 0; i < 4; i++) {
        const p = s.pts[i];
        const o = (sideStart + si * 4 + i) * stride;
        verts[o] = p[0]; verts[o + 1] = p[1]; verts[o + 2] = p[2];
        verts[o + 3] = s.n[0]; verts[o + 4] = s.n[1]; verts[o + 5] = s.n[2];
        verts[o + 6] = i === 1 || i === 2 ? 1 : 0; verts[o + 7] = i >= 2 ? 1 : 0;
      }
      const b = sideStart + si * 4;
      sideIndices.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    const surfaceIndices = [];
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const a = iz * (n + 1) + ix;
        const b = a + 1, c = a + n + 1, d = c + 1;
        surfaceIndices.push(a, c, b, b, c, d);
      }
    }
    const indices = new Uint32Array([...sideIndices, ...surfaceIndices]);
    this.waterVB = bufferFromFloatData(d, verts, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, 'jelly water');
    this.waterIB = d.createBuffer({ size: indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST, label: 'water indices' });
    d.queue.writeBuffer(this.waterIB, 0, indices, 0, indices.length);
    this.waterSurfaceVertexCount = surfaceVertexCount;
    this.waterStride = stride;
    this.waterSideIndexCount = sideIndices.length;
    this.waterSurfaceIndexCount = surfaceIndices.length;
    this.waterIndexTotal = indices.length;
  }

  createPipelines() {
    const d = this.device;
    const colorTargets = [
      { format: 'rgba16float' },
      { format: 'r32float' }
    ];
    const blendTargets = [
      { format: 'rgba16float', blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } } },
      { format: 'r32float' }
    ];
    const sceneDepth = { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' };
    const pipelineBase = (module, buffers, targets, options = {}) => d.createRenderPipeline({
      label: options.label || 'scene pipeline',
      layout: options.layout || this.scenePipelineLayout,
      vertex: { module, entryPoint: 'vs', buffers },
      fragment: { module, entryPoint: 'fs', targets },
      primitive: { topology: options.topology || 'triangle-list', cullMode: options.cullMode || 'none', frontFace: 'ccw' },
      depthStencil: options.noDepth ? undefined : { ...sceneDepth, depthWriteEnabled: options.depthWrite !== false, ...(options.depthCompare ? { depthCompare: options.depthCompare } : {}) }
    });
    this.propPipeline = pipelineBase(this.modules.prop, [PROP_LAYOUT], colorTargets, { label: 'studio props' });
    this.containerPipeline = pipelineBase(this.modules.container, [MESH_LAYOUT, INSTANCE_LAYOUT], colorTargets, { label: 'containers' });
    this.fishPipeline = pipelineBase(this.modules.fish, [LIFE_MESH_LAYOUT, LIFE_INSTANCE_LAYOUT], colorTargets, { label: 'fish' });
    this.gullPipeline = pipelineBase(this.modules.gull, [LIFE_MESH_LAYOUT, LIFE_INSTANCE_LAYOUT], colorTargets, { label: 'gulls' });
    this.jellyPipeline = pipelineBase(this.modules.jelly, [LIFE_MESH_LAYOUT, LIFE_INSTANCE_LAYOUT], blendTargets, { label: 'jellyfish', depthWrite: false });
    this.particlePipeline = pipelineBase(this.modules.particle, [QUAD_LAYOUT, PARTICLE_INSTANCE_LAYOUT], blendTargets, { label: 'particles', depthWrite: false });
    this.linePipeline = pipelineBase(this.modules.line, [LINE_LAYOUT], blendTargets, { label: 'cables', topology: 'line-list', depthWrite: false });
    // shadow pipelines
    this.shadowPipeline = d.createRenderPipeline({
      label: 'prop shadow', layout: this.sceneLitePipelineLayout,
      vertex: { module: this.modules.shadow, entryPoint: 'vs', buffers: [PROP_LAYOUT] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' }
    });
    this.containerShadowPipeline = d.createRenderPipeline({
      label: 'container shadow', layout: this.sceneLitePipelineLayout,
      vertex: { module: this.modules.containerShadow, entryPoint: 'vs', buffers: [MESH_LAYOUT, INSTANCE_LAYOUT] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' }
    });
    this.causticPipeline = d.createRenderPipeline({
      label: 'caustics',
      layout: this.sceneLitePipelineLayout,
      vertex: { module: this.modules.caustic, entryPoint: 'vs' },
      fragment: { module: this.modules.caustic, entryPoint: 'fs', targets: [{ format: 'rgba16float' }] },
      primitive: { topology: 'triangle-list' }
    });
    this.waterPipeline = d.createRenderPipeline({
      label: 'water',
      layout: this.waterPipelineLayout,
      vertex: { module: this.modules.waterVert, entryPoint: 'vs', buffers: [WATER_LAYOUT] },
      fragment: {
        module: this.modules.waterFrag, entryPoint: 'fs',
        targets: [{ format: 'rgba16float', blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } } }]
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' }
    });
    this.postPipeline = d.createRenderPipeline({
      label: 'post',
      layout: this.postPipelineLayout,
      vertex: { module: this.modules.post, entryPoint: 'vs' },
      fragment: { module: this.modules.post, entryPoint: 'fs', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list' }
    });
  }

  resize(force = false) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (!force && w === this.width && h === this.height) return false;
    this.width = w; this.height = h; this.dpr = dpr;
    this.canvas.width = w; this.canvas.height = h;
    const d = this.device;
    if (this.sceneColor) this.sceneColor.destroy();
    if (this.distanceTex) this.distanceTex.destroy();
    if (this.depthTex) this.depthTex.destroy();
    if (this.waterColor) this.waterColor.destroy();
    this.sceneColor = d.createTexture({ size: [w, h], format: 'rgba16float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING, label: 'scene colour' });
    this.sceneColorView = this.sceneColor.createView();
    this.distanceTex = d.createTexture({ size: [w, h], format: 'r32float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING, label: 'distance' });
    this.distanceView = this.distanceTex.createView();
    this.waterColor = d.createTexture({ size: [w, h], format: 'rgba16float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING, label: 'water colour' });
    this.waterColorView = this.waterColor.createView();
    this.depthTex = d.createTexture({ size: [w, h], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT, label: 'scene depth' });
    this.depthView = this.depthTex.createView();
    this.sceneBG = d.createBindGroup({
      layout: this.sceneBGL,
      entries: [
        { binding: 0, resource: { buffer: this.sceneBuffer } },
        { binding: 1, resource: this.shadowView },
        { binding: 2, resource: this.shadowSampler },
        { binding: 3, resource: this.causticView },
        { binding: 4, resource: this.repeatSampler }
      ]
    });
    this.waterBG = d.createBindGroup({
      layout: this.waterBGL,
      entries: [
        { binding: 0, resource: this.sceneColorView },
        { binding: 1, resource: this.distanceView },
        { binding: 2, resource: { buffer: this.waterBuffer } },
        { binding: 3, resource: this.clampSampler }
      ]
    });
    this.postBG = d.createBindGroup({
      layout: this.postBGL,
      entries: [
        { binding: 0, resource: this.sceneColorView },
        { binding: 1, resource: this.waterColorView },
        { binding: 2, resource: this.clampSampler },
        { binding: 3, resource: { buffer: this.postBuffer } }
      ]
    });
    this.camera.aspect = w / h;
    return true;
  }

  computeLightVP() {
    const center = [0, -0.2, 0];
    const eye = V3.add(center, V3.mul(this.sunDir, 9));
    const view = M4.lookAt(eye, center, [0, 1, 0]);
    const proj = M4.ortho(-5.1, 5.1, -5.1, 5.1, .1, 22);
    this.lightVP = M4.mul(proj, view);
  }

  fillSceneUniforms(state, objects) {
    const u = this.sceneData;
    const cam = this.camera;
    const sim = state.sim;
    const waterY = state.waterY;
    const pal = state.palette;
    u.set(cam.viewProj, 0);
    u.set(this.lightVP, 16);
    u.set(cam.invViewProj, 32);
    u.set([cam.eye[0], cam.eye[1], cam.eye[2], 1], 48);
    u.set([this.sunDir[0], this.sunDir[1], this.sunDir[2], 1.35], 52);
    u.set(state.tiltQuat, 56);
    u.set([state.time, waterY, state.tide, state.wobble], 60);
    u.set([pal.shallow[0], pal.shallow[1], pal.shallow[2], pal.absorb], 64);
    u.set([pal.deep[0], pal.deep[1], pal.deep[2], .8], 68);
    u.set([cam.right[0], cam.right[1], cam.right[2], 0], 72);
    u.set([cam.up[0], cam.up[1], cam.up[2], 0], 76);
    for (let i = 0; i < 24; i++) u.set(objects[i], OBJECT_OFFSET + i * 16);
    this.device.queue.writeBuffer(this.sceneBuffer, 0, u, 0, u.length);
  }

  fillWaterUniforms(state) {
    const u = this.waterData;
    u.fill(0);
    let n = 0;
    const sources = state.foamSources || [];
    for (const s of sources) {
      if (n >= 16) break;
      u[n * 4] = s.x; u[n * 4 + 1] = s.z; u[n * 4 + 2] = s.radius; u[n * 4 + 3] = s.strength;
      u[64 + n * 4] = s.dx; u[64 + n * 4 + 1] = s.dz; u[64 + n * 4 + 2] = s.speed; u[64 + n * 4 + 3] = s.type || 0;
      n++;
    }
    u[128] = state.time; u[129] = state.waterY; u[130] = 0; u[131] = 0;
    this.device.queue.writeBuffer(this.waterBuffer, 0, u, 0, u.length);
  }

  uploadWaterSurface(state) {
    const n = this.water.n;
    const count = this.water.updateSurface(this.waterScratch, this.waterStride, state.waterY);
    this.device.queue.writeBuffer(this.waterVB, 0, this.waterScratch, 0, count * this.waterStride);
  }

  render(state) {
    if (!this.ready) return;
    this.resize();
    this.frame++;
    const cam = this.camera;
    const aspect = this.width / this.height;
    const shift = this.canvas.clientWidth > 920 ? .082 : 0.0;
    cam.fov = aspect < .82 ? 62 * DEG : aspect < 1.15 ? 45 * DEG : 34 * DEG;
    cam.update(aspect, shift);
    this.computeLightVP();
    const objects = updateObjectTransforms(state.sim, this.water, state.tide, state.time, state.life.ring);
    this.objects = objects;
    this.fillSceneUniforms(state, objects);
    this.fillWaterUniforms(state);

    const cCount = buildContainerInstances(state.sim, objects, this.plan, this.containerScratch, 800);
    this.containerCount = cCount;
    if (cCount) this.device.queue.writeBuffer(this.containerInstances, 0, this.containerScratch, 0, cCount * 20);

    const lineVerts = buildCableLines(state.sim, objects, this.lineScratch, this.lineScratch.length);
    this.lineVertexCount = lineVerts;
    if (lineVerts) this.device.queue.writeBuffer(this.lineBuffer, 0, this.lineScratch, 0, lineVerts * 6);

    this.fishCount = state.life.writeFish(this.fishScratch);
    if (this.fishCount) this.device.queue.writeBuffer(this.fishBuffer, 0, this.fishScratch, 0, this.fishCount * 24);
    this.gullCount = state.life.writeGulls(this.gullScratch);
    if (this.gullCount) this.device.queue.writeBuffer(this.gullBuffer, 0, this.gullScratch, 0, this.gullCount * 24);
    this.jellyCount = state.life.writeJellies(this.jellyScratch);
    if (this.jellyCount) this.device.queue.writeBuffer(this.jellyBuffer, 0, this.jellyScratch, 0, this.jellyCount * 24);
    this.particleCount = state.life.writeParticles(this.particleScratch);
    if (this.particleCount) this.device.queue.writeBuffer(this.particleBuffer, 0, this.particleScratch, 0, this.particleCount * 12);

    this.postData[0] = state.time; this.postData[1] = 0; this.postData[2] = state.exposure || 1.0; this.postData[3] = 0;
    this.device.queue.writeBuffer(this.postBuffer, 0, this.postData);

    this.waterScratch = this.waterScratch || new Float32Array((this.waterSurfaceVertexCount + 16) * this.waterStride);
    this.uploadWaterSurface(state);

    const enc = this.device.createCommandEncoder({ label: 'harbor frame' });

    // 1. caustic tile
    let pass = enc.beginRenderPass({
      label: 'caustic pass',
      colorAttachments: [{ view: this.causticView, clearValue: { r: .0, g: .0, b: .0, a: 1 }, loadOp: 'clear', storeOp: 'store' }]
    });
    pass.setPipeline(this.causticPipeline);
    pass.setBindGroup(0, this.sceneLiteBG);
    pass.draw(3);
    pass.end();

    // 2. sun shadow map
    pass = enc.beginRenderPass({
      label: 'shadow pass',
      colorAttachments: [],
      depthStencilAttachment: { view: this.shadowView, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' }
    });
    pass.setBindGroup(0, this.sceneLiteBG);
    pass.setPipeline(this.shadowPipeline);
    pass.setVertexBuffer(0, this.propVB);
    pass.setIndexBuffer(this.propIB, 'uint32');
    pass.drawIndexed(this.propIndexCount);
    if (cCount > 0) {
      pass.setPipeline(this.containerShadowPipeline);
      pass.setVertexBuffer(0, this.cMeshVB);
      pass.setVertexBuffer(1, this.containerInstances);
      pass.setIndexBuffer(this.cMeshIB, 'uint16');
      pass.drawIndexed(this.cMeshIndexCount, cCount);
    }
    pass.end();

    // 3. opaque + transparent life in the HDR studio
    pass = enc.beginRenderPass({
      label: 'scene pass',
      colorAttachments: [
        { view: this.sceneColorView, clearValue: { r: .75, g: .69, b: .61, a: 1 }, loadOp: 'clear', storeOp: 'store' },
        { view: this.distanceView, clearValue: { r: 1000, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }
      ],
      depthStencilAttachment: { view: this.depthView, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' }
    });
    pass.setBindGroup(0, this.sceneBG);
    pass.setPipeline(this.propPipeline);
    pass.setVertexBuffer(0, this.propVB);
    pass.setIndexBuffer(this.propIB, 'uint32');
    pass.drawIndexed(this.propIndexCount);
    if (cCount > 0) {
      pass.setPipeline(this.containerPipeline);
      pass.setVertexBuffer(0, this.cMeshVB);
      pass.setVertexBuffer(1, this.containerInstances);
      pass.setIndexBuffer(this.cMeshIB, 'uint16');
      pass.drawIndexed(this.cMeshIndexCount, cCount);
    }
    if (this.fishCount > 0) {
      pass.setPipeline(this.fishPipeline);
      pass.setVertexBuffer(0, this.fishMesh.vb);
      pass.setVertexBuffer(1, this.fishBuffer);
      pass.setIndexBuffer(this.fishMesh.ib, 'uint16');
      pass.drawIndexed(this.fishMesh.indexCount, this.fishCount);
    }
    if (this.gullCount > 0) {
      pass.setPipeline(this.gullPipeline);
      pass.setVertexBuffer(0, this.gullMesh.vb);
      pass.setVertexBuffer(1, this.gullBuffer);
      pass.setIndexBuffer(this.gullMesh.ib, 'uint16');
      pass.drawIndexed(this.gullMesh.indexCount, this.gullCount);
    }
    if (this.lineVertexCount > 0) {
      pass.setPipeline(this.linePipeline);
      pass.setVertexBuffer(0, this.lineBuffer);
      pass.draw(this.lineVertexCount);
    }
    if (this.jellyCount > 0) {
      pass.setPipeline(this.jellyPipeline);
      pass.setVertexBuffer(0, this.jellyMesh.vb);
      pass.setVertexBuffer(1, this.jellyBuffer);
      pass.setIndexBuffer(this.jellyMesh.ib, 'uint16');
      pass.drawIndexed(this.jellyMesh.indexCount, this.jellyCount);
    }
    if (this.particleCount > 0) {
      pass.setPipeline(this.particlePipeline);
      pass.setVertexBuffer(0, this.quadVB);
      pass.setVertexBuffer(1, this.particleBuffer);
      pass.setIndexBuffer(this.quadIB, 'uint16');
      pass.drawIndexed(6, this.particleCount);
    }
    pass.end();

    // 4. jelly water over the scene copy
    pass = enc.beginRenderPass({
      label: 'water pass',
      colorAttachments: [{ view: this.waterColorView, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }]
    });
    pass.setPipeline(this.waterPipeline);
    pass.setBindGroup(0, this.sceneBG);
    pass.setBindGroup(1, this.waterBG);
    pass.setVertexBuffer(0, this.waterVB);
    pass.setIndexBuffer(this.waterIB, 'uint32');
    pass.drawIndexed(this.waterSideIndexCount, 1, 0, 0, 0);
    pass.drawIndexed(this.waterSurfaceIndexCount, 1, this.waterSideIndexCount, 0, 0);
    pass.end();

    // 5. final grade + dither
    const canvasView = this.context.getCurrentTexture().createView();
    pass = enc.beginRenderPass({
      label: 'post pass',
      colorAttachments: [{ view: canvasView, clearValue: { r: .9, g: .85, b: .77, a: 1 }, loadOp: 'clear', storeOp: 'store' }]
    });
    pass.setPipeline(this.postPipeline);
    pass.setBindGroup(0, this.postBG);
    pass.draw(3);
    pass.end();

    this.device.queue.submit([enc.finish()]);
    this.lastFrame = state;
  }
}