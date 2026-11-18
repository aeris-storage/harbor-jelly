/* ============================================================
   WGSL — studio scene, containers, life, cables
   ============================================================ */
const SCENE_FLOATS = 464;
const OBJECT_OFFSET = 80; // floats
const WGSL = {};


WGSL.commonLite = `
struct SceneLite {
  viewProj: mat4x4<f32>,
  lightVP: mat4x4<f32>,
  invViewProj: mat4x4<f32>,
  cameraPos: vec4<f32>,
  sunDir: vec4<f32>,
  jellyTilt: vec4<f32>,
  timeTide: vec4<f32>,
};
@group(0) @binding(0) var<uniform> scene: SceneLite;
fn quatRot(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}
fn jellyDeform(p: vec3<f32>) -> vec3<f32> {
  let pivot = vec3<f32>(0.0, -2.02, 0.0);
  var q = normalize(scene.jellyTilt + vec4<f32>(0.0, 0.0, 0.0, 0.0001));
  var v = quatRot(q, p - pivot) + pivot;
  let t = scene.timeTide.x;
  let h = clamp((v.y + 2.06) / 2.3, 0.0, 1.0);
  let amp = scene.timeTide.w;
  let sx = sin(t * 1.75 + v.y * 3.1 + v.x * 1.6) * amp;
  let sz = cos(t * 2.1 + v.y * 2.7 + v.z * 1.2) * amp * .72;
  v.x += sx * .038 * h;
  v.z += sz * .03 * h;
  v.y += sin(t * 2.6 + v.x * 2.2 + v.z * 1.8) * amp * .008 * h;
  return v;
}
`;


WGSL.commonShadow = `
struct SceneS {
  viewProj: mat4x4<f32>,
  lightVP: mat4x4<f32>,
  invViewProj: mat4x4<f32>,
  cameraPos: vec4<f32>,
  sunDir: vec4<f32>,
  jellyTilt: vec4<f32>,
  timeTide: vec4<f32>,
  palette: vec4<f32>,
  palette2: vec4<f32>,
  cameraRight: vec4<f32>,
  cameraUp: vec4<f32>,
  objects: array<mat4x4<f32>, 24>,
};
@group(0) @binding(0) var<uniform> scene: SceneS;
fn quatRot(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}
fn jellyDeform(p: vec3<f32>) -> vec3<f32> {
  let pivot = vec3<f32>(0.0, -2.02, 0.0);
  var q = normalize(scene.jellyTilt + vec4<f32>(0.0, 0.0, 0.0, 0.0001));
  var v = quatRot(q, p - pivot) + pivot;
  let t = scene.timeTide.x;
  let h = clamp((v.y + 2.06) / 2.3, 0.0, 1.0);
  let amp = scene.timeTide.w;
  let sx = sin(t * 1.75 + v.y * 3.1 + v.x * 1.6) * amp;
  let sz = cos(t * 2.1 + v.y * 2.7 + v.z * 1.2) * amp * .72;
  v.x += sx * .038 * h;
  v.z += sz * .03 * h;
  v.y += sin(t * 2.6 + v.x * 2.2 + v.z * 1.8) * amp * .008 * h;
  return v;
}
`;

WGSL.common = `
struct SceneU {
  viewProj: mat4x4<f32>,
  lightVP: mat4x4<f32>,
  invViewProj: mat4x4<f32>,
  cameraPos: vec4<f32>,
  sunDir: vec4<f32>,
  jellyTilt: vec4<f32>,
  timeTide: vec4<f32>,
  palette: vec4<f32>,
  palette2: vec4<f32>,
  cameraRight: vec4<f32>,
  cameraUp: vec4<f32>,
  objects: array<mat4x4<f32>, 24>,
};

@group(0) @binding(0) var<uniform> scene: SceneU;
@group(0) @binding(1) var shadowMap: texture_depth_2d;
@group(0) @binding(2) var shadowSampler: sampler_comparison;
@group(0) @binding(3) var causticTex: texture_2d<f32>;
@group(0) @binding(4) var linearSampler: sampler;

const C_WEED_LIGHT: vec3<f32> = vec3<f32>(.22, .36, .16);
const C_GRASS_LIGHT: vec3<f32> = vec3<f32>(.27, .41, .21);
const C_COPPER_LIGHT: vec3<f32> = vec3<f32>(.25, .5, .39);
const C_RUST_LIGHT: vec3<f32> = vec3<f32>(.43, .19, .1);

fn hash12(p: vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
fn hash13(p: vec3<f32>) -> f32 {
  var p3 = fract(p * .1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
fn noise3(p: vec3<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = hash13(i + vec3<f32>(0.0, 0.0, 0.0));
  let b = hash13(i + vec3<f32>(1.0, 0.0, 0.0));
  let c = hash13(i + vec3<f32>(0.0, 1.0, 0.0));
  let d = hash13(i + vec3<f32>(1.0, 1.0, 0.0));
  let e = hash13(i + vec3<f32>(0.0, 0.0, 1.0));
  let f1 = hash13(i + vec3<f32>(1.0, 0.0, 1.0));
  let g = hash13(i + vec3<f32>(0.0, 1.0, 1.0));
  let h = hash13(i + vec3<f32>(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, f1, u.x), mix(g, h, u.x), u.y), u.z);
}
fn quatRot(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}
fn jellyDeform(p: vec3<f32>) -> vec3<f32> {
  let pivot = vec3<f32>(0.0, -2.02, 0.0);
  var q = normalize(scene.jellyTilt + vec4<f32>(0.0, 0.0, 0.0, 0.0001));
  var v = quatRot(q, p - pivot) + pivot;
  let t = scene.timeTide.x;
  let h = clamp((v.y + 2.06) / 2.3, 0.0, 1.0);
  let amp = scene.timeTide.w;
  let sx = sin(t * 1.75 + v.y * 3.1 + v.x * 1.6) * amp;
  let sz = cos(t * 2.1 + v.y * 2.7 + v.z * 1.2) * amp * .72;
  v.x += sx * .038 * h;
  v.z += sz * .03 * h;
  v.y += sin(t * 2.6 + v.x * 2.2 + v.z * 1.8) * amp * .008 * h;
  return v;
}
fn shadowFactor(worldPos: vec3<f32>, normal: vec3<f32>) -> f32 {
  let offsetPos = worldPos + normalize(normal) * .022 + normalize(scene.sunDir.xyz) * .008;
  let lp = scene.lightVP * vec4<f32>(offsetPos, 1.0);
  let ndc = lp.xyz / max(lp.w, 0.0001);
  let inside = ndc.z >= 0.0 && ndc.z <= 1.0 && ndc.x > -1.1 && ndc.x < 1.1 && ndc.y > -1.1 && ndc.y < 1.1;
  let uv = clamp(vec2<f32>(ndc.x * .5 + .5, .5 - ndc.y * .5), vec2<f32>(.001), vec2<f32>(.999));
  let z = clamp(ndc.z, 0.0, 1.0);
  let texel = 1.45 / 2048.0;
  var shade = 0.0;
  for (var y = -1; y <= 1; y = y + 1) {
    for (var x = -1; x <= 1; x = x + 1) {
      shade += textureSampleCompare(shadowMap, shadowSampler, uv + vec2<f32>(f32(x), f32(y)) * texel, z - 0.0022);
    }
  }
  let edgeFade = smoothstep(1.0, .78, max(abs(ndc.x), abs(ndc.y)));
  return select(1.0, mix(1.0, shade / 9.0, edgeFade), inside);
}
fn causticAt(p: vec3<f32>) -> f32 {
  let s = textureSampleLevel(causticTex, linearSampler, p.xz * .27 + vec2<f32>(scene.timeTide.x * .003, 0.0), 0.0);
  return s.r;
}
`;

WGSL.propVert = WGSL.common + `
struct VSOut {
  @builtin(position) clip: vec4<f32>,
  @location(0) wpos: vec3<f32>,
  @location(1) wnrm: vec3<f32>,
  @location(2) color: vec3<f32>,
  @location(3) uv: vec2<f32>,
  @location(4) @interpolate(flat) matId: u32,
  @location(5) localPos: vec3<f32>,
};

@vertex
fn vs(@location(0) pos: vec3<f32>, @location(1) nrm: vec3<f32>, @location(2) col: vec3<f32>, @location(3) uv: vec2<f32>, @location(4) mat: f32, @location(5) obj: f32) -> VSOut {
  var out: VSOut;
  let oi = u32(clamp(obj + .5, 0.0, 23.0));
  let model = scene.objects[oi];
  let local = pos;
  var wp = (model * vec4<f32>(pos, 1.0)).xyz;
  var n = normalize((model * vec4<f32>(nrm, 0.0)).xyz);
  let matId = u32(mat + .5);
  if (matId == 10u) {
    let sway = sin(scene.timeTide.x * 1.35 + wp.x * 4.2 + wp.z * 3.1 + wp.y * 2.4);
    wp.x += sway * .018 * clamp((wp.y + 1.32) * 1.7, 0.0, 1.0);
    wp.z += cos(scene.timeTide.x * 1.1 + wp.x * 3.4) * .012 * clamp((wp.y + 1.32) * 1.7, 0.0, 1.0);
  }
  wp = jellyDeform(wp);
  out.clip = scene.viewProj * vec4<f32>(wp, 1.0);
  out.wpos = wp;
  out.wnrm = n;
  out.color = col;
  out.uv = uv;
  out.matId = matId;
  out.localPos = local;
  return out;
}

struct FragOut {
  @location(0) color: vec4<f32>,
  @location(1) distance: f32,
};

struct Mat {
  albedo: vec3<f32>,
  rough: f32,
  metal: f32,
  spec: f32,
  emissive: vec3<f32>,
};

fn makeMat(base: vec3<f32>) -> Mat {
  var m: Mat;
  m.albedo = base; m.rough = .56; m.metal = .05; m.spec = .22; m.emissive = vec3<f32>(0.0);
  return m;
}

fn shadeMaterial(matId: u32, base: vec3<f32>, wpos: vec3<f32>, uv: vec2<f32>, localPos: vec3<f32>) -> Mat {
  var m = makeMat(base);
  let waterY = scene.timeTide.y;
  if (matId == 3u) {
    m.albedo = base * (.82 + .18 * smoothstep(.35, .55, fract(uv.y * 13.0)));
    m.rough = .72;
    m.spec = .12;
  } else if (matId == 4u) {
    let grain = sin(uv.x * 58.0 + uv.y * 9.0 + wpos.y * 31.0) * .5 + .5;
    m.albedo = base * (.84 + grain * .2);
    m.rough = .64;
  } else if (matId == 5u) {
    let rib = sin((localPos.y + wpos.y) * 210.0 + wpos.x * 80.0) * .5 + .5;
    m.albedo = base * (.8 + rib * .26);
    m.rough = .36; m.metal = .45; m.spec = .5;
  } else if (matId == 6u) {
    let course = floor(wpos.y * 12.0 + wpos.x * .7);
    let jointY = smoothstep(.88, 1.0, fract(wpos.y * 12.0));
    let jointX = smoothstep(.9, 1.0, fract((wpos.x + wpos.z) * 5.0 + course * .37));
    let joint = max(jointY, jointX);
    m.albedo = base * (.72 + .28 * (1.0 - joint)) * (.92 + .08 * f32(floor(wpos.y * 4.0)));
    m.rough = .9;
    m.spec = .05;
  } else if (matId == 8u) {
    let n = noise3(wpos * 9.0);
    m.albedo = base * (.72 + n * .5);
    m.rough = .92;
  } else if (matId == 9u) {
    m.emissive = base * 3.2;
    m.albedo = base * .18;
    m.rough = .3;
  } else if (matId == 10u) {
    let n = sin(wpos.x * 7.0 + wpos.z * 8.0 + wpos.y * 5.0) * .5 + .5;
    m.albedo = mix(base * .62, C_WEED_LIGHT, n * .38);
    m.rough = .68;
    m.spec = .08;
  } else if (matId == 11u) {
    let below = 1.0 - smoothstep(waterY - .035, waterY + .025, wpos.y);
    let grime = noise3(vec3<f32>(wpos.x * 21.0, wpos.y * 18.0, wpos.z * 13.0));
    let antiFoul = mix(vec3<f32>(.19, .07, .055), vec3<f32>(.36, .12, .075), grime);
    m.albedo = mix(base, antiFoul, below * .9);
    m.albedo *= .9 + .18 * grime;
    m.rough = mix(.4, .8, below);
    m.metal = mix(.25, .05, below);
  } else if (matId == 12u) {
    let n = noise3(wpos * 17.0);
    m.albedo = base * (.82 + n * .28);
    m.rough = .88;
    m.spec = .07;
  } else if (matId == 13u) {
    let n = noise3(vec3<f32>(wpos.x * 44.0, 1.0, wpos.z * 44.0));
    m.albedo = base * (.8 + n * .3);
    m.rough = .95;
    m.spec = .04;
  } else if (matId == 14u) {
    let n = noise3(wpos * 15.0);
    m.albedo = mix(base * .58, C_GRASS_LIGHT, n * .48);
    m.rough = .88;
    m.spec = .06;
  } else if (matId == 15u) {
    let n = noise3(vec3<f32>(wpos.x * 28.0, wpos.z * 28.0, 3.0));
    m.albedo = base * (.96 + n * .07);
    m.rough = .93;
    m.spec = .03;
  } else if (matId == 16u) {
    let n = noise3(wpos * 42.0);
    m.albedo = base * (.76 + n * .36);
    m.rough = .82;
    m.spec = .1;
  } else if (matId == 17u) {
    let ripple = sin(wpos.x * 38.0 + wpos.z * 5.0) * .5 + .5;
    m.albedo = base * (.86 + ripple * .12 + noise3(wpos * 24.0) * .08);
    m.rough = .92;
    m.spec = .04;
  } else if (matId == 19u) {
    let n = noise3(wpos * 16.0);
    m.albedo = mix(base, C_COPPER_LIGHT, n * .5);
    m.rough = .7; m.metal = .25;
  } else if (matId == 20u) {
    m.albedo = base * .62;
    m.rough = .1; m.metal = .25; m.spec = .95;
    m.emissive = base * .11;
  } else if (matId == 21u) {
    let n = noise3(wpos * 13.0);
    m.albedo = mix(base * .6, C_RUST_LIGHT, n * .6);
    m.rough = .82;
  } else if (matId == 22u) {
    m.albedo = mix(base * .65, vec3<f32>(.07, .1, .09), noise3(wpos * 33.0));
    m.rough = .35; m.metal = .2; m.spec = .6;
  } else if (matId == 1u) {
    m.albedo = base;
    m.rough = .12; m.metal = .1; m.spec = .9;
    m.emissive = base * .07;
  } else if (matId == 2u) {
    m.rough = .26; m.metal = .8; m.spec = .8;
  } else if (matId == 7u) {
    m.rough = .85; m.spec = .06; m.metal = 0.0;
  }
  return m;
}

@fragment
fn fs(in: VSOut, @builtin(front_facing) front: bool) -> FragOut {
  var out: FragOut;
  let matId = in.matId;
  let source = shadeMaterial(matId, in.color, in.wpos, in.uv, in.localPos);
  var albedo = source.albedo;
  var N = normalize(in.wnrm);
  if (!front) { N = -N; }
  // Fine relief on corrugated steel and roof iron.
  if (matId == 5u) {
    let tangent = normalize(cross(N, vec3<f32>(0.0, 1.0, 0.0)) + vec3<f32>(.0001, 0.0, 0.0));
    N = normalize(N + tangent * sin(in.localPos.y * 170.0 + in.localPos.x * 90.0) * .22);
  }
  let V = normalize(scene.cameraPos.xyz - in.wpos);
  let L = normalize(scene.sunDir.xyz);
  let H = normalize(L + V);
  let shadow = shadowFactor(in.wpos, N);
  let ndl = max(dot(N, L), 0.0);
  let sky = mix(vec3<f32>(.32, .34, .31), vec3<f32>(.63, .66, .59), N.y * .5 + .5);
  let warmFill = vec3<f32>(.34, .28, .2);
  let sunCol = vec3<f32>(1.22, 1.06, .83);
  let fillDir = normalize(vec3<f32>(.52, .38, .58));
  let fill = max(dot(N, fillDir), 0.0) * .24;
  var lit = albedo * (sky * .33 + warmFill * .16 + sunCol * ndl * shadow * 1.42 + vec3<f32>(.4, .34, .25) * fill * .8);
  let specPow = mix(110.0, 9.0, source.rough);
  let spec = pow(max(dot(N, H), 0.0), specPow) * source.spec * (0.35 + source.metal * 1.1) * shadow;
  lit += sunCol * spec;
  // a soft diagonal studio sheen, useful on varnish and glass
  let sheen = pow(max(dot(N, normalize(vec3<f32>(-.35, .72, .6))), 0.0), 7.0) * (.08 + source.metal * .2);
  lit += vec3<f32>(1.0, .94, .82) * sheen;
  // Caustic light on submerged shells, stones and keels.
  let submerged = 1.0 - smoothstep(scene.timeTide.y - .05, scene.timeTide.y + .02, in.wpos.y);
  if (submerged > .001 && matId != 15u) {
    let c = causticAt(in.wpos);
    let tint = scene.palette.rgb;
    lit += (c * 2.1 + .06) * tint * submerged * (0.3 + albedo * .6);
    lit *= 1.0 - submerged * .1;
  }
  // paper studio floor gets a quiet warm vignette and a soft table-light pool
  if (matId == 15u) {
    let d = length(in.wpos.xz - vec2<f32>(.2, .3));
    let pool = 1.0 - smoothstep(2.0, 11.0, d);
    lit *= .88 + pool * .14;
    let grain = noise3(vec3<f32>(in.wpos.x * 38.0, in.wpos.z * 38.0, 7.0));
    lit *= .965 + grain * .04;
    let edge = max(abs(in.wpos.x), abs(in.wpos.z));
    lit *= .82 + .18 * smoothstep(2.62, 3.35, edge);
  }
  // gulls and small life on top catch a touch more warmth
  lit += source.emissive;
  out.color = vec4<f32>(lit, 1.0);
  out.distance = length(in.wpos - scene.cameraPos.xyz);
  return out;
}
`;

WGSL.containerVert = WGSL.common + `
struct CVOut {
  @builtin(position) clip: vec4<f32>,
  @location(0) wpos: vec3<f32>,
  @location(1) wnrm: vec3<f32>,
  @location(2) tint: vec3<f32>,
  @location(3) localPos: vec3<f32>,
  @location(4) uv: vec2<f32>,
  @location(5) seed: f32,
};
@vertex
fn vs(
  @location(0) pos: vec3<f32>, @location(1) nrm: vec3<f32>, @location(2) uv: vec2<f32>,
  @location(3) m0: vec4<f32>, @location(4) m1: vec4<f32>, @location(5) m2: vec4<f32>, @location(6) m3: vec4<f32>,
  @location(7) tint: vec4<f32>
) -> CVOut {
  var out: CVOut;
  let model = mat4x4<f32>(m0, m1, m2, m3);
  var wp = (model * vec4<f32>(pos, 1.0)).xyz;
  let n = normalize((model * vec4<f32>(nrm, 0.0)).xyz);
  wp = jellyDeform(wp);
  out.clip = scene.viewProj * vec4<f32>(wp, 1.0);
  out.wpos = wp;
  out.wnrm = n;
  out.tint = tint.rgb;
  out.localPos = pos;
  out.uv = uv;
  out.seed = tint.a;
  return out;
}
struct FragOut {
  @location(0) color: vec4<f32>,
  @location(1) distance: f32,
};
@fragment
fn fs(in: CVOut) -> FragOut {
  var out: FragOut;
  let waterY = scene.timeTide.y;
  var albedo = in.tint;
  var N = normalize(in.wnrm);
  let lp = in.localPos;
  // Corrugation: long walls ripple in depth, end walls ripple across.
  if (abs(N.x) > .6) {
    N = normalize(N + vec3<f32>(0.0, 0.0, sin(lp.z * 150.0 + in.seed * 6.0) * .32));
  } else if (abs(N.z) > .6) {
    N = normalize(N + vec3<f32>(sin(lp.x * 125.0 + in.seed * 6.0) * .32, 0.0, 0.0));
  }
  // corner posts
  if (abs(lp.x) > .425 && abs(lp.z) > .425) {
    albedo *= .58;
    N = normalize(N);
  }
  // end doors and their vertical seams
  if (abs(lp.z) > .465) {
    albedo *= .86;
    let seam = 1.0 - smoothstep(.02, .12, abs(abs(lp.x) - .13));
    albedo *= 1.0 - seam * .42;
    let handle = (1.0 - smoothstep(.135, .17, abs(lp.x))) * (1.0 - smoothstep(.3, .33, abs(lp.y)));
    albedo = mix(albedo, vec3<f32>(.72, .7, .63), handle * .55);
  }
  // paint weathering, salt and a hint of the shipping line
  let grime = noise3(vec3<f32>(in.wpos.x * 33.0, in.wpos.y * 28.0, in.wpos.z * 24.0));
  albedo *= .84 + grime * .24;
  let bottom = 1.0 - smoothstep(-.5, -.28, lp.y);
  albedo *= 1.0 - bottom * .16;
  let door = smoothstep(.465, .48, abs(lp.z));
  albedo += vec3<f32>(.03) * door;
  let V = normalize(scene.cameraPos.xyz - in.wpos);
  let L = normalize(scene.sunDir.xyz);
  let H = normalize(L + V);
  let shadow = shadowFactor(in.wpos, N);
  let ndl = max(dot(N, L), 0.0);
  let sky = mix(vec3<f32>(.31, .33, .3), vec3<f32>(.62, .65, .58), N.y * .5 + .5);
  let fillDir = normalize(vec3<f32>(.55, .4, .55));
  let fill = max(dot(N, fillDir), 0.0) * .26;
  var lit = albedo * (sky * .34 + vec3<f32>(.3, .25, .18) * .16 + vec3<f32>(1.2, 1.02, .8) * ndl * shadow * 1.38 + vec3<f32>(.44, .34, .24) * fill * .8);
  let spec = pow(max(dot(N, H), 0.0), 36.0) * .32 * shadow;
  lit += vec3<f32>(1.2, 1.02, .8) * spec;
  let submerged = 1.0 - smoothstep(waterY - .05, waterY + .02, in.wpos.y);
  if (submerged > .001) {
    let c = causticAt(in.wpos);
    lit += (c * 1.2 + .05) * scene.palette.rgb * submerged * (0.3 + albedo * .4);
  }
  out.color = vec4<f32>(lit, 1.0);
  out.distance = length(in.wpos - scene.cameraPos.xyz);
  return out;
}
`;

WGSL.shadowVert = WGSL.commonShadow + `
@vertex
fn vs(@location(0) pos: vec3<f32>, @location(1) nrm: vec3<f32>, @location(2) col: vec3<f32>, @location(3) uv: vec2<f32>, @location(4) mat: f32, @location(5) obj: f32) -> @builtin(position) vec4<f32> {
  let oi = u32(clamp(obj + .5, 0.0, 23.0));
  let model = scene.objects[oi];
  var wp = (model * vec4<f32>(pos, 1.0)).xyz;
  wp = jellyDeform(wp);
  return scene.lightVP * vec4<f32>(wp, 1.0);
}
`;

WGSL.containerShadowVert = WGSL.commonShadow + `
@vertex
fn vs(
  @location(0) pos: vec3<f32>, @location(1) nrm: vec3<f32>, @location(2) uv: vec2<f32>,
  @location(3) m0: vec4<f32>, @location(4) m1: vec4<f32>, @location(5) m2: vec4<f32>, @location(6) m3: vec4<f32>,
  @location(7) tint: vec4<f32>
) -> @builtin(position) vec4<f32> {
  let model = mat4x4<f32>(m0, m1, m2, m3);
  var wp = (model * vec4<f32>(pos, 1.0)).xyz;
  wp = jellyDeform(wp);
  return scene.lightVP * vec4<f32>(wp, 1.0);
}
`;

WGSL.fishVert = WGSL.common + `
struct FishInst {
  @location(4) m0: vec4<f32>, @location(5) m1: vec4<f32>, @location(6) m2: vec4<f32>, @location(7) m3: vec4<f32>,
  @location(8) color: vec4<f32>,
  @location(9) extra: vec4<f32>,
};
struct FVOut {
  @builtin(position) clip: vec4<f32>,
  @location(0) wpos: vec3<f32>,
  @location(1) wnrm: vec3<f32>,
  @location(2) color: vec3<f32>,
  @location(3) localPos: vec3<f32>,
  @location(4) species: f32,
};
@vertex
fn vs(@location(0) pos: vec3<f32>, @location(1) nrm: vec3<f32>, @location(2) uv: vec2<f32>, @location(3) tone: f32, inst: FishInst) -> FVOut {
  var out: FVOut;
  let model = mat4x4<f32>(inst.m0, inst.m1, inst.m2, inst.m3);
  var lp = pos;
  let tail = 1.0 - smoothstep(-.16, -.02, lp.z);
  lp.x += sin(scene.timeTide.x * 9.0 + inst.extra.x + lp.z * 42.0) * tail * .028 * inst.extra.y;
  lp.y += sin(scene.timeTide.x * 8.0 + inst.extra.x + lp.z * 26.0) * tail * .004;
  var wp = (model * vec4<f32>(lp, 1.0)).xyz;
  let n = normalize((model * vec4<f32>(nrm, 0.0)).xyz);
  wp = jellyDeform(wp);
  out.clip = scene.viewProj * vec4<f32>(wp, 1.0);
  out.wpos = wp;
  out.wnrm = n;
  out.color = inst.color.rgb;
  out.localPos = pos;
  out.species = inst.extra.w;
  return out;
}
struct FragOut { @location(0) color: vec4<f32>, @location(1) distance: f32 };
@fragment
fn fs(in: FVOut) -> FragOut {
  var out: FragOut;
  var albedo = in.color;
  let N0 = normalize(in.wnrm);
  let V = normalize(scene.cameraPos.xyz - in.wpos);
  let L = normalize(scene.sunDir.xyz);
  let H = normalize(L + V);
  let shadow = shadowFactor(in.wpos, N0);
  var N = N0;
  // species markings
  if (in.species < .5) {
    let stripe = smoothstep(.42, .62, fract(in.localPos.y * 55.0 + in.localPos.z * 8.0));
    albedo = mix(albedo, albedo * .3 + vec3<f32>(.03, .07, .08), stripe * .6);
  } else if (in.species < 1.5) {
    albedo = mix(albedo, vec3<f32>(.78, .84, .84), pow(max(N.y, 0.0), 2.0) * .75);
  } else {
    albedo = mix(albedo, vec3<f32>(.85, .36, .12), smoothstep(.35, .7, noise3(in.wpos * 30.0)) * .3);
  }
  let ndl = max(dot(N, L), 0.0);
  var lit = albedo * (vec3<f32>(.38, .42, .38) * .55 + vec3<f32>(1.22, 1.05, .8) * ndl * shadow * .9);
  lit += vec3<f32>(1.0) * pow(max(dot(N, H), 0.0), 40.0) * .22;
  lit += causticAt(in.wpos) * .1 * scene.palette.rgb;
  out.color = vec4<f32>(lit, 1.0);
  out.distance = length(in.wpos - scene.cameraPos.xyz);
  return out;
}
`;

WGSL.gullVert = WGSL.common + `
struct GullInst {
  @location(4) m0: vec4<f32>, @location(5) m1: vec4<f32>, @location(6) m2: vec4<f32>, @location(7) m3: vec4<f32>,
  @location(8) color: vec4<f32>,
  @location(9) extra: vec4<f32>,
};
struct GVOut {
  @builtin(position) clip: vec4<f32>,
  @location(0) wpos: vec3<f32>,
  @location(1) wnrm: vec3<f32>,
  @location(2) tone: f32,
};
@vertex
fn vs(@location(0) pos: vec3<f32>, @location(1) nrm: vec3<f32>, @location(2) uv: vec2<f32>, @location(3) tone: f32, inst: GullInst) -> GVOut {
  var out: GVOut;
  let model = mat4x4<f32>(inst.m0, inst.m1, inst.m2, inst.m3);
  var lp = pos;
  let wing = smoothstep(.015, .2, abs(lp.x));
  let flap = inst.extra.y;
  lp.y += sin(scene.timeTide.x * 11.5 + inst.extra.x) * wing * flap * .12;
  lp.y += wing * (1.0 - flap) * .055;
  lp.x *= 1.0 - wing * (1.0 - flap) * .36;
  var wp = (model * vec4<f32>(lp, 1.0)).xyz;
  let n = normalize((model * vec4<f32>(nrm, 0.0)).xyz);
  wp = jellyDeform(wp);
  out.clip = scene.viewProj * vec4<f32>(wp, 1.0);
  out.wpos = wp;
  out.wnrm = n;
  out.tone = tone;
  return out;
}
struct FragOut { @location(0) color: vec4<f32>, @location(1) distance: f32 };
@fragment
fn fs(in: GVOut) -> FragOut {
  var out: FragOut;
  let N = normalize(in.wnrm);
  let V = normalize(scene.cameraPos.xyz - in.wpos);
  let L = normalize(scene.sunDir.xyz);
  let ndl = max(dot(N, L), 0.0);
  var albedo = vec3<f32>(.94, .93, .89);
  if (in.tone > .5 && in.tone < 1.5) { albedo = vec3<f32>(.54, .58, .6); }
  else if (in.tone > 1.5 && in.tone < 2.5) { albedo = vec3<f32>(.06, .07, .07); }
  else if (in.tone > 2.5 && in.tone < 3.5) { albedo = vec3<f32>(.94, .66, .16); }
  else if (in.tone > 3.5) { albedo = vec3<f32>(.76, .12, .08); }
  var lit = albedo * (vec3<f32>(.43, .46, .42) * .55 + vec3<f32>(1.25, 1.08, .84) * ndl * .95);
  lit += vec3<f32>(1.0, .96, .87) * pow(max(dot(N, V), 0.0), 3.0) * .13;
  out.color = vec4<f32>(lit, 1.0);
  out.distance = length(in.wpos - scene.cameraPos.xyz);
  return out;
}
`;

WGSL.jellyVert = WGSL.common + `
struct JInst {
  @location(4) m0: vec4<f32>, @location(5) m1: vec4<f32>, @location(6) m2: vec4<f32>, @location(7) m3: vec4<f32>,
  @location(8) color: vec4<f32>,
  @location(9) extra: vec4<f32>,
};
struct JVOut {
  @builtin(position) clip: vec4<f32>,
  @location(0) wpos: vec3<f32>,
  @location(1) wnrm: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) localPos: vec3<f32>,
  @location(4) color: vec4<f32>,
};
@vertex
fn vs(@location(0) pos: vec3<f32>, @location(1) nrm: vec3<f32>, @location(2) uv: vec2<f32>, @location(3) tone: f32, inst: JInst) -> JVOut {
  var out: JVOut;
  let model = mat4x4<f32>(inst.m0, inst.m1, inst.m2, inst.m3);
  var lp = pos;
  let pulse = 1.0 + sin(scene.timeTide.x * 2.1 + inst.extra.x) * .075;
  if (lp.y > -.012) { lp.xz *= pulse; lp.y *= 1.0 - (pulse - 1.0) * .55; }
  let tent = 1.0 - smoothstep(-.15, -.005, lp.y);
  lp.x += sin(scene.timeTide.x * 1.8 + inst.extra.x + lp.y * 18.0) * tent * .035;
  lp.z += cos(scene.timeTide.x * 1.55 + inst.extra.x * 1.3 + lp.y * 15.0) * tent * .026;
  lp.y += sin(scene.timeTide.x * 2.4 + inst.extra.x + lp.x * 5.0) * .012;
  var wp = (model * vec4<f32>(lp, 1.0)).xyz;
  let n = normalize((model * vec4<f32>(nrm, 0.0)).xyz);
  wp = jellyDeform(wp);
  out.clip = scene.viewProj * vec4<f32>(wp, 1.0);
  out.wpos = wp;
  out.wnrm = n;
  out.uv = uv;
  out.localPos = pos;
  out.color = inst.color;
  return out;
}
struct FragOut { @location(0) color: vec4<f32>, @location(1) distance: f32 };
@fragment
fn fs(in: JVOut) -> FragOut {
  var out: FragOut;
  let ring = 1.0 - smoothstep(.0, .1, abs(fract(in.uv.y * 3.0) - .5));
  let rim = pow(1.0 - max(dot(normalize(in.wnrm), normalize(scene.cameraPos.xyz - in.wpos)), 0.0), 2.2);
  var col = in.color.rgb * (.72 + ring * .22);
  col += vec3<f32>(.35, .16, .22) * ring * .35;
  col += vec3<f32>(.7, .9, .86) * rim * .5;
  let alpha = clamp(.26 + rim * .35 + ring * .08 + in.color.a * .12, 0.0, .68) * in.color.a;
  out.color = vec4<f32>(col, alpha);
  out.distance = length(in.wpos - scene.cameraPos.xyz);
  return out;
}
`;

WGSL.lineVert = WGSL.common + `
struct LVOut { @builtin(position) clip: vec4<f32>, @location(0) color: vec3<f32>, @location(1) wpos: vec3<f32> };
@vertex
fn vs(@location(0) pos: vec3<f32>, @location(1) col: vec3<f32>) -> LVOut {
  var out: LVOut;
  let wp = jellyDeform(pos);
  out.clip = scene.viewProj * vec4<f32>(wp, 1.0);
  out.color = col;
  out.wpos = wp;
  return out;
}
struct FragOut { @location(0) color: vec4<f32>, @location(1) distance: f32 };
@fragment
fn fs(in: LVOut) -> FragOut {
  var out: FragOut;
  let V = normalize(scene.cameraPos.xyz - in.wpos);
  let lit = in.color * (.55 + .4 * max(V.y, 0.0));
  out.color = vec4<f32>(lit, .92);
  out.distance = length(in.wpos - scene.cameraPos.xyz);
  return out;
}
`;

WGSL.particleVert = WGSL.common + `
struct PInst {
  @location(3) center: vec4<f32>,
  @location(4) data: vec4<f32>,
  @location(5) color: vec4<f32>,
};
struct PVOut {
  @builtin(position) clip: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) color: vec4<f32>,
  @location(2) mode: f32,
  @location(3) wpos: vec3<f32>,
};
@vertex
fn vs(@location(0) pos: vec3<f32>, @location(1) uv: vec2<f32>, inst: PInst) -> PVOut {
  var out: PVOut;
  let sz = inst.data.x;
  let rot = inst.data.y;
  let cr = cos(rot); let sr = sin(rot);
  let right = scene.cameraRight.xyz;
  let up = scene.cameraUp.xyz;
  let local = vec2<f32>(pos.x * cr - pos.y * sr, pos.x * sr + pos.y * cr) * sz;
  var wp = inst.center.xyz + right * local.x + up * local.y;
  wp = jellyDeform(wp);
  out.clip = scene.viewProj * vec4<f32>(wp, 1.0);
  out.uv = uv;
  out.color = inst.color;
  out.mode = inst.data.w;
  out.wpos = wp;
  return out;
}
struct FragOut { @location(0) color: vec4<f32>, @location(1) distance: f32 };
@fragment
fn fs(in: PVOut) -> FragOut {
  var out: FragOut;
  let d = length(in.uv - vec2<f32>(.5)) * 2.0;
  var alpha = in.color.a;
  var col = in.color.rgb;
  if (in.mode > 1.5) {
    // bubble: glassy rim
    let ring = smoothstep(.55, .86, d) * (1.0 - smoothstep(.88, 1.0, d));
    alpha *= ((1.0 - smoothstep(.88, 1.0, d)) * .24 + ring * .7);
    col += vec3<f32>(.8, .95, .92) * ring * .4;
  } else {
    alpha *= 1.0 - smoothstep(.1, 1.0, d);
  }
  if (alpha < .008) { discard; }
  out.color = vec4<f32>(col, alpha);
  out.distance = length(in.wpos - scene.cameraPos.xyz);
  return out;
}
`;