/* ============================================================
   WGSL — jelly water, caustic pass, final post
   ============================================================ */
const WATER_FLOATS = 132;
WGSL.fullVert = `struct VOut { @builtin(position) clip: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VOut {
  var p = array<vec2<f32>, 3>(vec2<f32>(-1.0, -3.0), vec2<f32>(3.0, 1.0), vec2<f32>(-1.0, 1.0));
  let xy = p[vi];
  var out: VOut;
  out.clip = vec4<f32>(xy, 0.0, 1.0);
  out.uv = vec2<f32>(xy.x * .5 + .5, .5 - xy.y * .5);
  return out;
}`;
WGSL.caustic = WGSL.fullVert + WGSL.commonLite + `@fragment
fn fs(in: VOut) -> @location(0) vec4<f32> {
  var p = in.uv * 8.0;
  let t = scene.timeTide.x * .32;
  var v = 0.0;
  for (var i = 0; i < 4; i = i + 1) {
    let k = 1.0 + f32(i) * .66;
    let a = sin(p.x * k + sin(p.y * (k * .72) + t * (1.0 + f32(i) * .1)));
    let b = cos(p.y * (k * .86) + sin(p.x * (k * .58) - t * .8));
    v += (a + b) * .5;
  }
  v = v * .25;
  let lines = pow(abs(sin(p.x * 1.4 + sin(p.y * 2.3 + t)) * cos(p.y * 1.2 + sin(p.x * 1.7 - t * .7))), .6);
  let caus = pow(max(0.0, lines * .9 + v * .35 + .1), 2.0);
  let col = vec3<f32>(caus * 1.05, caus * 1.25, caus * 1.15) + vec3<f32>(.012, .02, .022);
  return vec4<f32>(col, 1.0);
}`;
WGSL.post = WGSL.fullVert + `struct PostU { params: vec4<f32> };
@group(0) @binding(0) var sceneTex: texture_2d<f32>;
@group(0) @binding(1) var waterTex: texture_2d<f32>;
@group(0) @binding(2) var postSampler: sampler;
@group(0) @binding(3) var<uniform> post: PostU;

fn aces(x: vec3<f32>) -> vec3<f32> {
  let a = 2.51; let b = .03; let c = 2.43; let d = .59; let e = .14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}
fn hash12(p: vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
@fragment
fn fs(in: VOut) -> @location(0) vec4<f32> {
  let s = textureSampleLevel(sceneTex, postSampler, in.uv, 0.0);
  let w = textureSampleLevel(waterTex, postSampler, in.uv, 0.0);
  let a = clamp(w.a, 0.0, 1.0);
  var col = s.rgb * (1.0 - a) + w.rgb * a;
  let t = post.params.x;
  let q = in.uv - vec2<f32>(.5);
  let vig = 1.0 - dot(q, q) * .3;
  col *= vig * post.params.z;
  col = aces(col);
  col = pow(col, vec3<f32>(.92, .94, .95));
  col = col * vec3<f32>(1.012, 1.0, .965) + vec3<f32>(.006, .004, .002);
  let luma = dot(col, vec3<f32>(.299, .587, .114));
  col = mix(vec3<f32>(luma), col, 1.07);
  col *= mix(vec3<f32>(.985, 1.0, 1.015), vec3<f32>(1.02, 1.0, .97), smoothstep(.2, .85, luma));
  col = pow(max(col, vec3<f32>(0.0)), vec3<f32>(1.0 / 2.2));
  let grain = hash12(in.clip.xy * 1.37 + vec2<f32>(t * 7.0, t * 3.0)) - .5;
  col += grain / 255.0;
  return vec4<f32>(col, 1.0);
}`;
WGSL.waterVert = WGSL.common + `struct WVOut {
  @builtin(position) clip: vec4<f32>,
  @location(0) wpos: vec3<f32>,
  @location(1) nrm: vec3<f32>,
  @location(2) uv: vec2<f32>,
};
@vertex
fn vs(@location(0) pos: vec3<f32>, @location(1) nrm: vec3<f32>, @location(2) uv: vec2<f32>) -> WVOut {
  var out: WVOut;
  let wp = jellyDeform(pos);
  let q = normalize(scene.jellyTilt + vec4<f32>(0.0, 0.0, 0.0, 0.0001));
  let n = quatRot(q, nrm);
  out.clip = scene.viewProj * vec4<f32>(wp, 1.0);
  out.wpos = wp;
  out.nrm = n;
  out.uv = uv;
  return out;
}`;
WGSL.waterFrag = WGSL.common + `struct WaterU {
  sources: array<vec4<f32>, 16>,
  dirs: array<vec4<f32>, 16>,
  info: vec4<f32>,
};
@group(1) @binding(0) var sceneColor: texture_2d<f32>;
@group(1) @binding(1) var distanceTex: texture_2d<f32>;
@group(1) @binding(2) var<uniform> water: WaterU;
@group(1) @binding(3) var waterSampler: sampler;

const SEA_FLOOR: f32 = -1.32;

struct WVOut {
  @builtin(position) clip: vec4<f32>,
  @location(0) wpos: vec3<f32>,
  @location(1) nrm: vec3<f32>,
  @location(2) uv: vec2<f32>,
};

fn sceneDistanceAt(pix: vec2<i32>, size: vec2<i32>) -> f32 {
  return textureLoad(distanceTex, clamp(pix, vec2<i32>(0, 0), size - vec2<i32>(1, 1)), 0).r;
}

@fragment
fn fs(in: WVOut) -> @location(0) vec4<f32> {
  let dims = textureDimensions(distanceTex);
  let size = vec2<i32>(dims);
  let pix = vec2<i32>(floor(in.clip.xy));
  let sceneDist = sceneDistanceAt(pix, size);
  let V = normalize(scene.cameraPos.xyz - in.wpos);
  let waterDist = length(in.wpos - scene.cameraPos.xyz);
  if (sceneDist < waterDist - .035) { discard; }
  let isSide = abs(in.nrm.y) < .42;
  if (isSide && dot(normalize(in.nrm), V) <= .01) { discard; }
  if (!isSide && (abs(in.wpos.x) > 2.602 || abs(in.wpos.z) > 2.602)) { discard; }
  let waterY = scene.timeTide.y;
  let t = scene.timeTide.x;
  let uv = in.clip.xy / vec2<f32>(f32(dims.x), f32(dims.y));
  let thickness = clamp(sceneDist - waterDist, .02, 2.4);
  var N = normalize(in.nrm);

  if (isSide) {
    let ly = in.wpos.y;
    let sideHit = dot(normalize(in.nrm), V);
    let edgeFade = clamp(sideHit * 2.0, 0.0, 1.0);
    var col = vec3<f32>(0.0);
    var alpha = 0.0;
    if (ly < SEA_FLOOR + .015) {
      let depth = clamp((SEA_FLOOR - ly) * 7.0, 0.0, 8.0);
      let band = floor(depth * 1.15 + noise3(vec3<f32>(in.wpos.x * 2.0, ly * 7.0, in.wpos.z * 2.0)) * .45);
      let bandMod = band - floor(band / 3.0) * 3.0;
      var soil = vec3<f32>(.76, .49, .38);
      if (bandMod < .5) { soil = vec3<f32>(.88, .67, .51); }
      else if (bandMod < 1.5) { soil = vec3<f32>(.67, .43, .35); }
      else { soil = vec3<f32>(.92, .79, .62); }
      soil = mix(soil, vec3<f32>(.94, .89, .76), smoothstep(SEA_FLOOR - .32, SEA_FLOOR - .08, ly) * .6);
      let fleck = noise3(vec3<f32>(in.wpos.x * 24.0, ly * 31.0, in.wpos.z * 20.0));
      soil *= .86 + fleck * .3;
      soil = mix(soil, soil * .62 + scene.palette.rgb * .42, .28);
      let sceneS = textureSampleLevel(sceneColor, waterSampler, uv + vec2<f32>(.006, 0.0), 0.0);
      col = mix(sceneS.rgb, soil, .86);
      col += vec3<f32>(.06, .02, .015) * fleck;
      alpha = .6 * edgeFade;
      col = mix(col, vec3<f32>(.9, .8, .7), smoothstep(-2.09, -2.02, ly) * .25);
    } else {
      let under = 1.0 - smoothstep(waterY - .05, waterY + .03, ly);
      let sceneS = textureSampleLevel(sceneColor, waterSampler, uv + N.xz * .012, 0.0);
      let shallow = scene.palette.rgb;
      let deep = scene.palette2.rgb;
      let depth = clamp(waterY - ly, 0.0, 1.5);
      let absorb = exp(-depth * vec3<f32>(.46, .15, .13) * (.6 + scene.palette.w));
      let body = mix(shallow, deep, smoothstep(.0, 1.1, depth));
      let c = causticAt(in.wpos);
      col = sceneS.rgb * absorb * .66 + body * (.28 + depth * .2);
      col += vec3<f32>(.57, .9, .82) * c * .07;
      alpha = mix(.04, .22, under);
      let men = exp(-abs(ly - waterY) * 150.0);
      col = mix(col, vec3<f32>(.9, 1.0, .93), men);
      alpha = max(alpha, men * .72);
      let lip = exp(-abs(ly - (waterY + .012)) * 450.0);
      alpha = max(alpha, lip * .5);
    }
    col = mix(col, col * 1.12 + vec3<f32>(.03, .05, .045), .2);
    return vec4<f32>(col, clamp(alpha * edgeFade, 0.0, .86));
  }

  let micro = vec3<f32>(sin(in.wpos.x * 15.0 + t * 1.9) * .018 + sin(in.wpos.z * 19.0 - t * 1.3) * .011, 0.0, cos(in.wpos.z * 17.0 + t * 1.6) * .018 + cos(in.wpos.x * 11.0 - t * 1.1) * .009);
  N = normalize(N + micro);
  let fres = .035 + .965 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
  let refrUV = clamp(uv + N.xz * (.028 / (1.0 + waterDist * .08)), vec2<f32>(.002), vec2<f32>(.998));
  let behind = textureSampleLevel(sceneColor, waterSampler, refrUV, 0.0).rgb;
  let shallow = scene.palette.rgb;
  let deep = scene.palette2.rgb;
  let absorb = exp(-thickness * vec3<f32>(.7, .22, .18) * (.6 + scene.palette.w));
  let body = mix(shallow, deep, smoothstep(.05, 1.7, thickness));
  let caustic = causticAt(in.wpos);
  var refracted = behind * absorb * .84 + body * (.3 + .34 * (1.0 - exp(-thickness * 1.7)));
  refracted += caustic * caustic * mix(vec3<f32>(.36, .52, .45), shallow, .55) * .6;
  refracted += vec3<f32>(.02, .07, .06) * caustic;
  let R = reflect(-V, N);
  let warm = vec3<f32>(.93, .85, .73);
  let softbox = pow(max(dot(R, normalize(vec3<f32>(-.42, .66, .48))), 0.0), 18.0);
  let skyRef = mix(warm * .53, warm * 1.12, smoothstep(-.1, .8, R.y));
  let reflection = skyRef + vec3<f32>(1.0, .94, .81) * softbox * .9;
  var col = mix(refracted, reflection, clamp(fres * .72, 0.0, .82));
  let H = normalize(scene.sunDir.xyz + V);
  let glint = pow(max(dot(N, H), 0.0), 170.0);
  col += vec3<f32>(1.4, 1.22, .9) * glint * 2.2;
  let broad = pow(max(dot(N, H), 0.0), 24.0) * .16;
  col += vec3<f32>(.9, .92, .82) * broad;
  col += vec3<f32>(.9, 1.0, .93) * fres * .1;

  let crest = smoothstep(.09, .4, length(N.xz)) * .22;
  var shore = 0.0;
  for (var i = -2; i <= 2; i = i + 1) {
    for (var j = -2; j <= 2; j = j + 1) {
      if (abs(i) + abs(j) == 0) { continue; }
      let nd = sceneDistanceAt(pix + vec2<i32>(i, j), size);
      let close = 1.0 - smoothstep(.0, .16, nd - waterDist);
      shore = max(shore, close);
    }
  }
  let edge = 1.0 - smoothstep(.02, .085, 2.6 - max(abs(in.wpos.x), abs(in.wpos.z)));
  var foam = 0.0;
  for (var i = 0; i < 16; i = i + 1) {
    let s = water.sources[i];
    if (s.w <= .003) { continue; }
    let rel = in.wpos.xz - s.xy;
    let d = length(rel);
    let dir = water.dirs[i].xy;
    let along = dot(rel, dir);
    let across = dot(rel, vec2<f32>(-dir.y, dir.x));
    let ring = exp(-pow((d - s.z) / max(s.z, .04), 2.0) * 2.0) * s.w;
    var trail = 0.0;
    if (along < 0.0) {
      let wakeLen = clamp(-along, 0.0, 1.5);
      let width = .012 + wakeLen * .09;
      trail = exp(-wakeLen * 2.7) * exp(-across * across / (width * width)) * water.dirs[i].z * s.w;
    }
    foam = max(foam, ring * .72 + trail * .6);
  }
  foam = clamp(foam + shore * .75 + edge * .55 + crest, 0.0, 1.0);
  let lace = smoothstep(.22, .72, shore + edge * .4) * (.65 + .35 * sin(in.wpos.x * 55.0 + in.wpos.z * 47.0 + t * 2.0));
  foam = max(foam, lace * .55);
  col = mix(col, vec3<f32>(.94, .99, .94), foam * .62);
  let alpha = clamp(.48 + thickness * .14 + fres * .32 + foam * .2, .44, .94);
  return vec4<f32>(col, alpha);
}`;