/* ============================================================
   Scene construction — materials, static port and town
   ============================================================ */
const SEA_FLOOR = HarborCore.SEA_FLOOR;
const LIGHTHOUSE = { x: 2.03, z: 2.38, lensY: 1.4, perchY: 1.58 };
const WATER_Y = HarborCore.WATER_Y;
const MAT = {
  paint: 0, glass: 1, metal: 2, tile: 3, wood: 4, corrugated: 5,
  stone: 6, rubber: 7, rock: 8, emissive: 9, weed: 10, hull: 11,
  concrete: 12, asphalt: 13, grass: 14, paper: 15, cobble: 16,
  sand: 17, trim: 18, copper: 19, window: 20, rust: 21, mussel: 22, rope: 23
};
const OBJ = {
  root: 0, ship: 1, tug: 2, sailA: 3, sailB: 4,
  buoyY1: 5, buoyY2: 6, buoyG: 7,
  crane0Base: 8, crane1Base: 9,
  crane0Boom: 10, crane1Boom: 11,
  crane0Trolley: 12, crane1Trolley: 13,
  crane0Spreader: 14, crane1Spreader: 15,
  lifeRing: 16, lens: 17, fishing0: 18, fishing1: 19,
  shipProp: 20, shipRadar: 21, beam: 22
};
const M = {
  navy: C('#263f4c'), navyDeep: C('#1b303b'), hullBlue: C('#243d4d'),
  red: C('#a5463b'), redDeep: C('#85372f'), orange: C('#d9704f'),
  white: C('#f2ecdf'), cream: C('#f6f0e3'), bone: C('#dfd2bd'),
  ink: C('#253a34'), slate: C('#56625f'), charcoal: C('#343f3b'),
  concrete: C('#a9a798'), concreteDark: C('#85887e'), asphalt: C('#6d746d'),
  wood: C('#8f6546'), woodDark: C('#654630'), woodLight: C('#b88e63'),
  steel: C('#85908b'), steelDark: C('#59645f'), rust: C('#9a5c3c'), stone: C('#aca894'),
  brass: C('#c6a35c'), copper: C('#6f9b83'), copperDark: C('#557d69'),
  green: C('#4d7968'), mint: C('#9fc7b6'), yellow: C('#e2b64c'),
  glass: C('#8db3b7'), rubber: C('#2d3432'), window: C('#334f53'),
  soil: C('#c89275'), sand: C('#d9c49e'), weed: C('#577c54'), mussel: C('#39504c'),
  roofRed: C('#984c3f'), roofSlate: C('#5b6367'), chrome: C('#9ba6a3'), rope: C('#a68a6a')
};
const HOUSE_COLORS = ['#9a4438', '#d2a445', '#eee6d6', '#9cbac2', '#a5c3aa', '#d3a09d', '#f0e7d8', '#b3b5a8'];
const ROOF_COLORS = ['#7b4438', '#5a6062', '#987b57', '#4e5b55', '#8c5141'];
const CONTAINER_PAINTS = ['#b64b3f', '#3d6d8f', '#d7a53f', '#4b8069', '#d67345', '#7d5e8c', '#c8b9a5', '#2f4d62', '#9d6c46', '#9bb5a3'];

function planeXZ(b, y, x0, x1, z0, z1, color, mat, obj = 0, uvScale = 2) {
  b.face([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], [0, 1, 0], color, mat, obj, uvScale);
}

function addCrate(b, x, y, z, s, color, obj = 0, rot = 0) {
  b.box(x, y + s / 2, z, s, s, s, color, MAT.wood, obj, rot);
  b.box(x, y + s / 2, z - s / 2 - .001, s * .86, s * .08, .005, M.woodDark, MAT.wood, obj, rot);
  b.box(x, y + s * .72, z, s * .86, .007, s * .88, M.woodDark, MAT.wood, obj, rot);
}

function addBollard(b, x, y, z, obj = 0, color = M.charcoal) {
  b.cylinder(x, y + .05, z, .026, .1, color, MAT.rubber, obj, 8);
  b.cylinder(x, y + .105, z, .038, .028, color, MAT.rubber, obj, 8);
  b.cylinder(x, y + .025, z, .04, .015, color, MAT.metal, obj, 8);
}

function addLampPost(b, x, y, z, height, obj = 0, perches = null) {
  b.cylinder(x, y + height / 2, z, .014, height, M.charcoal, MAT.metal, obj, 7);
  b.box(x, y + height + .008, z, .09, .018, .018, M.charcoal, MAT.metal, obj);
  b.box(x, y + height, z, .035, .045, .035, M.charcoal, MAT.metal, obj);
  b.sphere(x, y + height - .026, z, .022, .026, .022, C('#ffd894'), MAT.emissive, obj, 8, 5);
  if (perches) perches.push({ pos: [x, y + height + .03, z], yaw: 0 });
}

function buildHouse(b, x, ground, z, w, h, d, wallHex, roofHex, options = {}) {
  const wall = C(wallHex), roof = C(roofHex);
  const ridgeZ = options.ridgeZ !== false;
  const bodyY = ground + h / 2;
  b.box(x, bodyY, z, w, h, d, wall, MAT.paint, OBJ.root);
  // stone plinth
  b.box(x, ground + .018, z, w + .01, .036, d + .01, M.stone, MAT.stone, OBJ.root);
  // roof
  const rh = options.roofH || h * .44;
  b.roofGable(x, ground + h, z, w, d, rh, roof, MAT.tile, OBJ.root, ridgeZ, .018);
  b.gableEnds(x, ground + h, z, w, d, rh, wall, MAT.paint, OBJ.root, ridgeZ);
  const front = z + d / 2 + .006;
  // windows, white frames + dark glass
  const wy = ground + h * .49;
  const winCount = w > .34 ? 2 : 1;
  for (let i = 0; i < winCount; i++) {
    const wx = x + (i - (winCount - 1) / 2) * w * .3;
    b.box(wx, wy, front, .066, .064, .012, M.white, MAT.trim, OBJ.root);
    b.box(wx, wy, front + .007, .044, .044, .006, M.window, MAT.window, OBJ.root);
    b.box(wx, wy, front + .011, .006, .05, .004, M.white, MAT.trim, OBJ.root);
  }
  // door
  const doorX = x + (options.doorOffset || 0);
  b.box(doorX, ground + .075, front, .062, .13, .016, options.doorColor || M.woodDark, MAT.wood, OBJ.root);
  b.box(doorX, ground + .075, front + .009, .043, .106, .004, M.cream, MAT.wood, OBJ.root);
  // roof chimney
  if (options.chimney !== false) {
    const chx = x + w * .27, chz = z - (ridgeZ ? .06 : .0);
    b.box(chx, ground + h + rh * .55, chz, .036, rh * .7, .036, M.stone, MAT.stone, OBJ.root);
  }
  // side window
  if (w > .3) {
    b.box(x + w / 2 + .006, ground + h * .45, z, .01, .052, .058, M.white, MAT.trim, OBJ.root);
    b.box(x + w / 2 + .012, ground + h * .45, z, .004, .038, .04, M.window, MAT.window, OBJ.root);
  }
  return { x, z, ground, y: ground + h + rh };
}

function buildTown(b, perches) {
  const houseSpots = [];
  const rowZ = [-1.72, -2.03, -2.34];
  const ground = [.30, .49, .68];
  const roofTint = ['#783d32', '#4e5558', '#7c674b', '#5a4f40', '#894c3e'];
  for (let row = 0; row < 3; row++) {
    // terraced grass shelf
    const zc = rowZ[row];
    const y = ground[row];
    b.box(0.0, (y - .29) / 2 + .15, zc + .02, 5.12, Math.max(.1, y - .18), .36, M.green, MAT.grass, OBJ.root);
    b.box(0.0, (y - .2) / 2 + .1, zc + .2, 5.12, Math.max(.08, y - .2), .055, M.stone, MAT.stone, OBJ.root);
    b.box(0.0, y + .012, zc + .17, 5.02, .024, .025, M.bone, MAT.cobble, OBJ.root);
    let count = row === 0 ? 9 : 8;
    for (let i = 0; i < count; i++) {
      const spacing = 5.02 / count;
      let x = -2.5 + spacing * (i + .5) + Math.sin(i * 2.1 + row) * .018;
      const w = .29 + ((i * 7 + row * 3) % 4) * .028;
      const h = .21 + ((i * 5 + row * 2) % 5) * .025;
      const d = .21 + ((i + row) % 3) * .018;
      if (x > 1.36 && x < 1.86 && row > 0) x += .25;
      if (x > 2.22) continue;
      const wall = HOUSE_COLORS[(i + row * 3) % HOUSE_COLORS.length];
      const roof = roofTint[(i + row * 2) % roofTint.length];
      const house = buildHouse(b, x, y, zc, w, h, d, wall, roof, {
        ridgeZ: (i + row) % 3 !== 1,
        roofH: .09 + ((i + row) % 3) * .018,
        doorOffset: ((i % 2) ? -.08 : .08),
        chimney: i % 3 !== 2
      });
      if (i % 3 === 0) {
        // little back garden hedge
        b.box(x + w * .18, y + .035, zc - d * .72, w * .55, .07, .045, M.green, MAT.grass, OBJ.root);
      }
      perches.push({ pos: [x, house.y + .012, zc + .01], yaw: 0, roof: true });
      houseSpots.push(house);
    }
    // cobbled lane
    b.box(0, y + .004, zc + .215, 5.02, .006, .08, C('#b9ad98'), MAT.cobble, OBJ.root);
  }
  // Church — white nave, slate roof, green copper spire.
  const cx = 1.61, cz = -2.17, gy = .55;
  b.box(cx, gy + .2, cz, .38, .4, .46, M.cream, MAT.paint, OBJ.root);
  b.roofGable(cx, gy + .4, cz, .38, .46, .13, M.roofSlate, MAT.tile, OBJ.root, true, .02);
  b.gableEnds(cx, gy + .4, cz, .38, .46, .13, M.cream, MAT.paint, OBJ.root, true);
  b.box(cx, gy + .5, cz + .26, .2, .6, .2, M.cream, MAT.paint, OBJ.root);
  b.cylinder(cx, gy + .95, cz + .26, .115, .22, M.cream, MAT.paint, OBJ.root, 8);
  b.box(cx, gy + .84, cz + .365, .08, .08, .015, M.roofSlate, MAT.tile, OBJ.root);
  b.cylinder(cx, gy + .885, cz + .373, .028, .005, M.yellow, MAT.emissive, OBJ.root, 10);
  b.cone(cx, gy + 1.06, cz + .26, .145, .34, M.copper, MAT.copper, OBJ.root, 8);
  b.box(cx, gy + 1.42, cz + .26, .012, .08, .012, M.brass, MAT.metal, OBJ.root);
  b.box(cx, gy + 1.455, cz + .26, .06, .008, .008, M.brass, MAT.metal, OBJ.root);
  // tall arched windows
  for (const dx of [-.1, .1]) {
    b.box(cx + dx, gy + .22, cz + .236, .055, .16, .012, M.window, MAT.window, OBJ.root);
    b.box(cx + dx, gy + .22, cz + .241, .02, .13, .004, M.cream, MAT.trim, OBJ.root);
  }
  perches.push({ pos: [cx, gy + 1.49, cz + .26], yaw: 0, church: true });
  // lychgate / stone wall bits
  b.box(cx + .45, gy + .05, cz + .25, .018, .1, .55, M.stone, MAT.stone, OBJ.root);
  // trees
  const treePos = [
    [-2.42, .33, -1.58], [-1.15, .34, -1.55], [.55, .34, -1.56], [2.34, .33, -1.54],
    [-1.92, .71, -2.44], [-.65, .69, -2.48], [.3, .7, -2.46], [1.08, .7, -2.45], [2.4, .7, -2.42]
  ];
  for (let i = 0; i < treePos.length; i++) {
    const [x, gy2, z] = treePos[i];
    const th = .18 + (i % 3) * .04;
    b.cylinder(x, gy2 + th / 2, z, .018, th, M.woodDark, MAT.wood, OBJ.root, 7);
    const cr = .075 + (i % 4) * .012;
    b.sphere(x, gy2 + th + cr * .62, z, cr, cr * .88, cr, i % 2 ? M.green : M.mint, MAT.grass, OBJ.root, 9, 6, .08, i + 4);
    b.sphere(x + cr * .45, gy2 + th + cr * .45, z + cr * .2, cr * .58, cr * .5, cr * .58, i % 2 ? M.mint : M.green, MAT.grass, OBJ.root, 8, 5, .06, i + 20);
  }
  // grass beyond the top row
  b.box(0, .59, -2.54, 5.16, .2, .16, M.green, MAT.grass, OBJ.root);
  return houseSpots;
}

function buildTerminal(b, perches) {
  const x0 = -2.55, x1 = -0.44, z0 = -1.56, z1 = .76;
  const top = .25;
  // quay block, with warm layers revealed at the cut face
  b.box((x0 + x1) / 2, (top - 1.42) / 2, (z0 + z1) / 2, x1 - x0, top + 1.42, z1 - z0, M.concreteDark, MAT.concrete, OBJ.root);
  b.box((x0 + x1) / 2, top + .016, (z0 + z1) / 2, x1 - x0, .032, z1 - z0, M.asphalt, MAT.asphalt, OBJ.root);
  // colourful quay-side strata, just below the asphalt lip
  const strata = [['#c98f70', -.1], ['#e8c9a3', -.26], ['#b77465', -.42], ['#e5b7a0', -.58]];
  for (const [col, yy] of strata) b.box(x1 - .035, yy, (z0 + z1) / 2, .07, .14, z1 - z0, C(col), MAT.stone, OBJ.root);
  // water-face wall cap and concrete edge
  b.box(x1 - .055, top - .06, (z0 + z1) / 2, .11, .16, z1 - z0, M.concrete, MAT.concrete, OBJ.root);
  b.box(x1 - .02, top + .02, (z0 + z1) / 2, .08, .05, z1 - z0, M.bone, MAT.stone, OBJ.root);
  // rail tracks on concrete strips
  for (const rx of [-1.3, -.5]) {
    b.box(rx, top + .04, (z0 + z1) / 2 - .05, .12, .04, z1 - z0 - .12, M.concrete, MAT.concrete, OBJ.root);
    b.box(rx, top + .063, (z0 + z1) / 2 - .05, .026, .016, z1 - z0 - .12, M.steelDark, MAT.metal, OBJ.root);
  }
  // yard markings
  for (let i = 0; i < 3; i++) {
    const lx = -2.55 + .42 + i * .53;
    b.box(lx, top + .037, .0, .007, .003, 1.8, C('#e7dfcb'), MAT.paint, OBJ.root);
  }
  for (let i = 0; i < 7; i++) b.box(-1.95, top + .037, -1.44 + i * .3, 1.16, .003, .006, C('#e7dfcb'), MAT.paint, OBJ.root);
  // fenders and bollards on the water face
  for (let i = 0; i < 5; i++) {
    const z = -1.3 + i * .48;
    b.box(x1 + .01, .075, z, .04, .18, .12, M.rubber, MAT.rubber, OBJ.root);
    addBollard(b, x1 - .09, top + .01, z + .16);
  }
  // steel ladder
  for (let i = 0; i < 7; i++) b.box(x1 - .055, -.63 + i * .14, .37, .018, .016, .07, M.steelDark, MAT.metal, OBJ.root);
  b.box(x1 - .055, -.63, .345, .012, .82, .012, M.steelDark, MAT.metal, OBJ.root);
  b.box(x1 - .055, -.63, .395, .012, .82, .012, M.steelDark, MAT.metal, OBJ.root);
  // mussel and seaweed bosses below the waterline
  for (let i = 0; i < 12; i++) {
    const z = -1.3 + i * .19;
    const y = -.08 - (i % 3) * .11;
    b.sphere(x1 + .015, y, z, .028, .018, .04, i % 3 ? M.mussel : M.weed, MAT.mussel, OBJ.root, 6, 4, .15, i + 10);
  }
  // light towers at the corners of the yard
  for (const [lx, lz] of [[-2.45, .58], [-2.45, -1.43]]) {
    const h = .72;
    b.cylinder(lx, top + h / 2, lz, .018, h, M.steelDark, MAT.metal, OBJ.root, 7);
    b.box(lx, top + h, lz, .18, .018, .018, M.steelDark, MAT.metal, OBJ.root);
    b.box(lx + .085, top + h - .016, lz, .06, .04, .06, M.charcoal, MAT.metal, OBJ.root);
    b.box(lx + .085, top + h - .038, lz, .05, .012, .05, C('#e7c778'), MAT.emissive, OBJ.root);
    perches.push({ pos: [lx + .085, top + h + .012, lz], yaw: 0, lamp: true });
  }
  // small dock office
  const ox = -2.33, oz = .44;
  b.box(ox, top + .13, oz, .36, .26, .42, C('#d7d0c0'), MAT.paint, OBJ.root);
  b.box(ox, top + .272, oz, .39, .03, .45, M.slate, MAT.tile, OBJ.root);
  for (let i = 0; i < 2; i++) {
    b.box(ox - .11 + i * .21, top + .15, oz + .216, .1, .08, .012, M.window, MAT.window, OBJ.root);
    b.box(ox - .11 + i * .21, top + .15, oz + .223, .012, .08, .004, M.cream, MAT.trim, OBJ.root);
  }
  b.box(ox + .13, top + .08, oz + .216, .06, .16, .012, M.woodDark, MAT.wood, OBJ.root);
  // crane buffers on the rails
  for (const z of [-1.35, .55]) b.box(-.92, top + .065, z, .34, .05, .08, M.yellow, MAT.paint, OBJ.root);
  // foreground bollard and coils
  addBollard(b, -.72, top + .01, .52);
  b.torus(-.95, top + .05, .48, .055, .012, M.rope, MAT.rope, OBJ.root, 14, 5, Q.axisAngle([1, 0, 0], 0));
  // mooring rope along the quay edge
  for (let i = 0; i < 6; i++) b.tube([x1 - .1, top + .035, .1 + i * .09], [x1 - .03, top + .035, .14 + i * .09], .006, M.rope, MAT.rope, OBJ.root, 5);
}

function buildFishQuay(b, perches) {
  const x0 = 1.58, x1 = 2.58, z0 = -1.56, z1 = .88, top = .22;
  b.box((x0 + x1) / 2, (top - 1.42) / 2, (z0 + z1) / 2, x1 - x0, top + 1.42, z1 - z0, M.stone, MAT.stone, OBJ.root);
  b.box((x0 + x1) / 2, top + .012, (z0 + z1) / 2, x1 - x0, .024, z1 - z0, C('#b8ac96'), MAT.cobble, OBJ.root);
  // stone courses on the water-facing side
  for (let row = 0; row < 9; row++) {
    const y = -.9 + row * .13;
    const depth = row % 2 ? .015 : .005;
    b.box(x0 - .02 + depth, y, (z0 + z1) / 2, .05, .115, z1 - z0 - .02, row % 2 ? M.stone : M.concrete, MAT.stone, OBJ.root);
  }
  // capstones and bollards
  b.box(x0 - .03, top + .035, (z0 + z1) / 2, .09, .055, z1 - z0, M.bone, MAT.stone, OBJ.root);
  for (const z of [-1.2, -.35, .42, .72]) {
    addBollard(b, x0 + .08, top + .01, z);
    b.box(x0 + .01, .02, z, .035, .12, .1, M.rubber, MAT.rubber, OBJ.root);
  }
  // ladder and old tire fender
  for (let i = 0; i < 6; i++) b.box(x0 - .025, -.65 + i * .14, .05, .017, .016, .06, M.rust, MAT.rust, OBJ.root);
  b.torus(x0 - .015, -.17, .03, .055, .011, M.rubber, MAT.rubber, OBJ.root, 14, 5, Q.axisAngle([1, 0, 0], 0));
  // cobble inlay patterns
  for (let i = 0; i < 6; i++) b.box(2.12, top + .027, -.6 + i * .3, .38, .006, .055, C('#a99c86'), MAT.cobble, OBJ.root);
  // lamp posts
  for (const [lx, lz] of [[1.77, .65], [2.36, -.64], [2.45, .62]]) {
    const h = .55;
    b.cylinder(lx, top + h / 2, lz, .012, h, M.charcoal, MAT.metal, OBJ.root, 7);
    b.box(lx, top + h, lz, .035, .07, .035, M.charcoal, MAT.metal, OBJ.root);
    b.sphere(lx, top + h - .01, lz, .021, .028, .021, C('#ffd88e'), MAT.emissive, OBJ.root, 8, 5);
    perches.push({ pos: [lx, top + h + .045, lz], yaw: 0, lamp: true });
  }
  // market shed — open-fronted, corrugated iron roof, timber posts
  const mx = 2.2, mz = .2;
  b.box(mx, top + .19, mz, .58, .32, .5, C('#4d635a'), MAT.wood, OBJ.root);
  b.box(mx, top + .36, mz, .62, .028, .55, M.rust, MAT.corrugated, OBJ.root);
  b.roofGable(mx, top + .37, mz, .62, .55, .09, M.rust, MAT.corrugated, OBJ.root, true, .015);
  b.box(mx, top + .12, mz + .25, .5, .11, .02, C('#3d4f48'), MAT.wood, OBJ.root);
  for (const px of [-.24, .24]) for (const pz of [-.2, .2]) b.cylinder(mx + px, top + .16, mz + pz, .018, .32, M.woodDark, MAT.wood, OBJ.root, 6);
  // awning
  b.box(mx, top + .245, mz + .34, .58, .02, .18, C('#c7b38b'), MAT.wood, OBJ.root);
  // fish crates and a barrel
  for (let i = 0; i < 4; i++) {
    const x = mx - .18 + (i % 2) * .2;
    const z = mz + .26 + Math.floor(i / 2) * .11;
    b.box(x, top + .045, z, .1, .075, .08, i % 2 ? C('#9c6e4c') : C('#c08c5e'), MAT.wood, OBJ.root);
    b.box(x, top + .083, z, .085, .01, .07, M.woodDark, MAT.wood, OBJ.root);
  }
  b.cylinder(mx + .32, top + .085, mz + .2, .055, .16, C('#8b6b4a'), MAT.wood, OBJ.root, 8);
  addCrate(b, 2.33, top + .01, -.36, .13, M.woodLight, 0, .2);
  addCrate(b, 2.23, top + .15, -.38, .1, M.wood);
  // hanging buoys and nets
  b.sphere(2.46, top + .25, .53, .025, .04, .025, M.orange, MAT.paint, OBJ.root, 7, 5);
  b.sphere(2.46, top + .17, .47, .023, .038, .023, M.yellow, MAT.paint, OBJ.root, 7, 5);
  b.box(1.94, top + .28, .51, .18, .19, .012, C('#c7c2a7'), MAT.rope, OBJ.root);
  // small wooden jetty
  const jx0 = 1.43, jx1 = 1.62, jz0 = .34, jz1 = .78;
  for (let i = 0; i < 5; i++) {
    const z = lerp(jz0, jz1, i / 4);
    b.box((jx0 + jx1) / 2, top + .07, z, jx1 - jx0, .035, .075, M.woodLight, MAT.wood, OBJ.root);
  }
  for (const px of [jx0 + .025, jx1 - .025]) for (const pz of [jz0 + .02, jz1 - .02]) {
    b.cylinder(px, -.49, pz, .025, 1.18, M.woodDark, MAT.wood, OBJ.root, 7);
  }
  for (const pz of [jz0 + .02, jz1 - .02]) b.beam([jx0 + .025, .31, pz], [jx1 - .025, .31, pz], .024, .024, M.woodDark, MAT.wood, OBJ.root);
  for (const px of [jx0 + .025, jx1 - .025]) b.beam([px, .31, jz0 + .02], [px, .31, jz1 - .02], .022, .022, M.woodDark, MAT.wood, OBJ.root);
  for (const pz of [jz0 + .02, jz1 - .02]) {
    b.beam([jx0 + .06, -.55, pz], [jx1 - .06, .3, pz], .017, .017, M.wood, MAT.wood, OBJ.root);
    b.beam([jx1 - .06, -.55, pz], [jx0 + .06, .3, pz], .017, .017, M.wood, MAT.wood, OBJ.root);
  }
  addBollard(b, jx1 - .08, top + .09, jz1 - .05);
  b.torus(1.5, top + .085, .42, .03, .012, M.rope, MAT.rope, OBJ.root, 14, 4, Q.axisAngle([1, 0, 0], 0));
  b.torus(1.48, top + .085, .43, .04, .01, M.rope, MAT.rope, OBJ.root, 14, 4, Q.axisAngle([1, 0, 0], 0));
}

function buildBreakwater(b, perches) {
  const rng = mulberry32(90210);
  const rock = (x, z, y, s) => {
    b.sphere(x, y, z, s, s * .68, s * .82, C('#707d76'), MAT.rock, OBJ.root, 7, 5, .22, Math.floor(x * 100 + z * 33));
    if (s > .14) b.sphere(x + s * .6, y - s * .1, z - s * .2, s * .55, s * .4, s * .6, C('#58665f'), MAT.rock, OBJ.root, 6, 4, .2, 44);
  };
  // front arm
  for (let i = 0; i < 34; i++) {
    const x = -.58 + (i / 33) * 3.12;
    const z = 2.35 + (rng() - .5) * .17;
    const y = .06 + rng() * .19;
    const s = .11 + rng() * .13;
    rock(x, z, y, s);
  }
  // right arm
  for (let i = 0; i < 21; i++) {
    const z = .96 + (i / 20) * 1.5;
    const x = 2.43 + (rng() - .5) * .16;
    rock(x, z, .05 + rng() * .2, .1 + rng() * .12);
  }
  // underwater boulders
  for (let i = 0; i < 16; i++) {
    const x = -.35 + rng() * 2.8;
    const z = 1.95 + rng() * .5;
    rock(x, z, -.45 - rng() * .55, .06 + rng() * .1);
  }
  // seaside concrete parapet
  for (let i = 0; i < 9; i++) {
    const x0 = -.46 + i * .35;
    b.box(x0 + .16, .37, 2.42, .31, .13, .1, M.concrete, MAT.concrete, OBJ.root);
  }
  b.box(2.38, .37, 1.6, .11, .13, 1.4, M.concrete, MAT.concrete, OBJ.root);
  // weathered stairs down to the rocks
  for (let i = 0; i < 4; i++) b.box(2.05 - i * .06, .27 - i * .055, 2.2, .16, .05, .1, M.concrete, MAT.concrete, OBJ.root);
  // lighthouse — compact, at the head of the breakwater
  const lx = LIGHTHOUSE.x, lz = LIGHTHOUSE.z, base = .31;
  b.cylinder(lx, base + .02, lz, .15, .12, M.stone, MAT.stone, OBJ.root, 10);
  let y = base + .08;
  for (let i = 0; i < 8; i++) {
    const rr = .12 - i * .006;
    b.cylinder(lx, y + .05, lz, rr, .10, i % 2 ? C('#b54338') : M.cream, MAT.paint, OBJ.root, 12);
    y += .10;
  }
  b.cylinder(lx, y + .012, lz, .15, .024, M.charcoal, MAT.metal, OBJ.root, 14);
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * TAU;
    b.cylinder(lx + Math.cos(a) * .142, y + .07, lz + Math.sin(a) * .142, .004, .11, M.charcoal, MAT.metal, OBJ.root, 4);
  }
  b.cylinder(lx, y + .135, lz, .15, .012, M.charcoal, MAT.metal, OBJ.root, 14);
  b.cylinder(lx, y + .23, lz, .075, .17, C('#dbe6d5'), MAT.glass, OBJ.root, 10);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU;
    b.box(lx + Math.cos(a) * .073, y + .23, lz + Math.sin(a) * .073, .01, .17, .01, M.charcoal, MAT.metal, OBJ.root, a);
  }
  b.cylinder(lx, y + .325, lz, .095, .016, M.redDeep, MAT.paint, OBJ.root, 12);
  b.cone(lx, y + .33, lz, .095, .11, M.redDeep, MAT.paint, OBJ.root, 12);
  b.sphere(lx, y + .36, lz, .014, .017, .014, C('#ffd365'), MAT.emissive, OBJ.root, 7, 4);
  // rotating lens object geometry (origin at lamp centre)
  b.box(0, 0, 0, .08, .022, .012, C('#ffe0a0'), MAT.emissive, OBJ.lens);
  b.box(0, 0, 0, .012, .022, .08, C('#ffe0a0'), MAT.emissive, OBJ.lens);
  b.sphere(0, 0, 0, .022, .022, .022, C('#ffe2a8'), MAT.emissive, OBJ.lens, 8, 5);
  perches.push({ pos: [lx, LIGHTHOUSE.perchY, lz], yaw: 0, lighthouse: true });
  // gull rock perches
  perches.push({ pos: [-.25, .58, 2.38], yaw: .5, rock: true });
  perches.push({ pos: [1.95, .5, 2.42], yaw: -.3, rock: true });
}

function buildSeabed(b, perches) {
  const rng = mulberry32(481);
  // rippled sand
  for (let iz = 0; iz < 18; iz++) {
    for (let ix = 0; ix < 18; ix++) {
      const x = -2.5 + ix * .285, z = -2.5 + iz * .285;
      const y = SEA_FLOOR + .012 + Math.sin(x * 7 + z * 3) * .006 + Math.sin(z * 9) * .003;
      b.face([[x, y, z], [x + .292, y, z], [x + .292, y + Math.sin(x * 8 + z) * .002, z + .292], [x, y + Math.sin(z * 7) * .002, z + .292]], [0, 1, 0], M.sand, MAT.sand, OBJ.root, 1.1);
    }
  }
  // offshore silt ridges
  for (let i = 0; i < 12; i++) {
    const x = -.2 + rng() * 1.8, z = -.9 + rng() * 2.2;
    b.box(x, SEA_FLOOR + .018, z, .25 + rng() * .2, .015, .035, C('#cbb58d'), MAT.sand, OBJ.root, rng() * 2);
  }
  // rocks and algae
  for (let i = 0; i < 14; i++) {
    const x = -1.6 + rng() * 3.5, z = -1.1 + rng() * 2.6;
    b.sphere(x, SEA_FLOOR + .05, z, .06 + rng() * .08, .035 + rng() * .04, .05 + rng() * .07, i % 2 ? C('#6e766d') : C('#647b6a'), MAT.rock, OBJ.root, 7, 5, .18, i + 3);
    if (i % 3 === 0) {
      for (let j = 0; j < 4; j++) {
        const a = j / 4 * TAU;
        b.box(x + Math.cos(a) * .035, SEA_FLOOR + .1, z + Math.sin(a) * .035, .012, .1, .006, M.weed, MAT.weed, OBJ.root, a);
      }
    }
  }
  // eelgrass patches
  const grassSpots = [[-1.65, 1.9], [-1.1, .65], [1.1, 1.7], [1.45, -.3], [-.55, 1.2], [.3, -.8], [1.7, 1.0], [-1.9, -.4]];
  for (let p = 0; p < grassSpots.length; p++) {
    const [gx, gz] = grassSpots[p];
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * TAU + p;
      const x = gx + Math.cos(a) * (.03 + rng() * .08);
      const z = gz + Math.sin(a) * (.03 + rng() * .07);
      const h = .12 + rng() * .16;
      b.face([[x - .012, SEA_FLOOR, z], [x + .012, SEA_FLOOR, z], [x + .004, SEA_FLOOR + h, z + (rng() - .5) * .035], [x - .004, SEA_FLOOR + h, z + (rng() - .5) * .02]], [0, 0, 1], M.weed, MAT.weed, OBJ.root, 1);
    }
  }
  // starfish
  const stars = [[-.4, 1.15, M.orange], [1.1, .2, C('#bd7d58')], [1.15, 1.55, C('#a95b51')], [-1.25, .3, C('#c59a61')]];
  for (const [x, z, col] of stars) b.star(x, SEA_FLOOR + .033, z, .055, .018, col, MAT.paint, OBJ.root, 5);
  // old anchor, lying on the sand
  const ax = .25, az = 1.02, ay = SEA_FLOOR + .025;
  b.torus(ax, ay + .11, az, .035, .009, M.rust, MAT.rust, OBJ.root, 12, 5, Q.axisAngle([0, 1, 0], 0));
  b.tube([ax, ay + .11, az], [ax, ay - .02, az + .35], .018, M.rust, MAT.rust, OBJ.root, 6);
  b.tube([ax - .18, ay + .05, az + .28], [ax + .18, ay + .05, az + .28], .013, M.rust, MAT.rust, OBJ.root, 6);
  b.tube([ax - .03, ay - .02, az + .34], [ax - .15, ay + .01, az + .25], .012, M.rust, MAT.rust, OBJ.root, 5);
  b.tube([ax + .03, ay - .02, az + .34], [ax + .15, ay + .01, az + .25], .012, M.rust, MAT.rust, OBJ.root, 5);
  // chain
  for (let i = 0; i < 9; i++) {
    const z = az + .33 + i * .045;
    b.torus(ax + Math.sin(i * 1.7) * .03, ay + .01, z, .014, .004, M.rust, MAT.rust, OBJ.root, 8, 4, Q.axisAngle(i % 2 ? [0, 0, 1] : [1, 0, 0], PI / 2));
  }
  // lost tire
  b.torus(-.18, SEA_FLOOR + .035, .15, .075, .025, M.rubber, MAT.rubber, OBJ.root, 16, 6, Q.axisAngle([1, 0, 0], 0));
  b.torus(-.18, SEA_FLOOR + .033, .15, .045, .01, C('#595e58'), MAT.rubber, OBJ.root, 12, 4, Q.axisAngle([1, 0, 0], 0));
  // fallen container at the edge (a quiet souvenir)
  b.box(-2.1, SEA_FLOOR + .11, 1.8, .23, .13, .4, C('#7a6a56'), MAT.corrugated, OBJ.root, .7);
}

function buildStaticScene() {
  const b = new MeshBuilder();
  const perches = [];
  // studio paper ground
  planeXZ(b, -2.085, -16, 16, -16, 16, C('#e9dfd0'), MAT.paper, OBJ.root, 14);
  // cube rim
  for (const [x, z, sx, sz] of [[0, -2.6, 5.24, .035], [0, 2.6, 5.24, .035], [-2.6, 0, .035, 5.2], [2.6, 0, .035, 5.2]]) {
    b.box(x, .22, z, sx, .04, sz, M.cream, MAT.trim, OBJ.root);
  }
  buildSeabed(b, perches);
  buildTerminal(b, perches);
  buildFishQuay(b, perches);
  buildTown(b, perches);
  buildBreakwater(b, perches);
  // seabed edge / cube bottom rim
  for (const [x, z, sx, sz] of [[0, -2.605, 5.24, .03], [0, 2.605, 5.24, .03], [-2.605, 0, .03, 5.2], [2.605, 0, .03, 5.2]]) {
    b.box(x, -2.04, z, sx, .08, sz, M.bone, MAT.trim, OBJ.root);
  }
  return { builder: b, perches };
}

// Cranes are authored in local frames: the gantry travels in z, the boom rotates about the hinge.
function buildCraneGeometry(b, index) {
  const red = index === 0;
  const paint = red ? C('#b34b3f') : C('#355f86');
  const paintDark = red ? C('#83352f') : C('#284a6a');
  const accent = C('#e0d5c1');
  const baseObj = index === 0 ? OBJ.crane0Base : OBJ.crane1Base;
  const boomObj = index === 0 ? OBJ.crane0Boom : OBJ.crane1Boom;
  const trolleyObj = index === 0 ? OBJ.crane0Trolley : OBJ.crane1Trolley;
  const spreaderObj = index === 0 ? OBJ.crane0Spreader : OBJ.crane1Spreader;
  // gantry local origin: rail height, x = CRANE.railX, z = crane.gantryZ
  const legX = .41, legZ = .27, legH = 1.04;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.box(sx * legX, legH * .48, sz * legZ, .072, .94, .07, paint, MAT.paint, baseObj);
    b.box(sx * legX, .035, sz * legZ, .15, .07, .16, M.charcoal, MAT.rubber, baseObj);
    b.box(sx * legX, .75, sz * legZ, .088, .03, .088, accent, MAT.trim, baseObj);
  }
  // lower sill and portal top
  for (const sz of [-1, 1]) {
    b.box(0, .14, sz * legZ, .88, .07, .065, paint, MAT.paint, baseObj);
    b.box(0, .94, sz * legZ, .88, .05, .064, paint, MAT.paint, baseObj);
  }
  for (const sx of [-1, 1]) {
    b.box(sx * legX, .57, 0, .055, .82, .09, paintDark, MAT.paint, baseObj);
    b.box(sx * legX, .98, 0, .06, .08, .54, paint, MAT.paint, baseObj);
  }
  // cross bracing
  for (const sz of [-1, 1]) {
    b.beam([-legX, .16, sz * legZ], [legX, .92, sz * legZ], .025, .025, paintDark, MAT.paint, baseObj);
    b.beam([legX, .16, sz * legZ], [-legX, .92, sz * legZ], .025, .025, paintDark, MAT.paint, baseObj);
  }
  // machinery house and cable drums
  b.box(-.18, .96, 0, .33, .26, .42, C('#8b938b'), MAT.corrugated, baseObj);
  b.box(-.18, 1.095, 0, .35, .025, .44, M.charcoal, MAT.metal, baseObj);
  b.cylinder(-.18, 1.14, 0, .055, .24, M.charcoal, MAT.metal, baseObj, 8);
  b.box(-.37, .98, .14, .03, .16, .14, paint, MAT.paint, baseObj);
  // ladder
  for (let i = 0; i < 7; i++) b.box(.42, .12 + i * .13, -.22, .018, .012, .045, M.steelDark, MAT.metal, baseObj);
  b.box(.42, .53, -.25, .012, .84, .012, M.steelDark, MAT.metal, baseObj);
  // A-frame mast
  b.beam([-.26, 1.0, -.24], [.02, 1.55, -.02], .055, .055, paint, MAT.paint, baseObj);
  b.beam([-.26, 1.0, .24], [.02, 1.55, .02], .055, .055, paint, MAT.paint, baseObj);
  b.beam([-.26, 1.0, -.24], [.02, 1.55, .02], .038, .038, paint, MAT.paint, baseObj);
  b.beam([-.26, 1.0, .24], [.02, 1.55, -.02], .038, .038, paint, MAT.paint, baseObj);
  b.cylinder(.02, 1.56, 0, .04, .16, M.steelDark, MAT.metal, baseObj, 7);
  // walkway
  b.box(.25, .985, 0, .11, .035, .56, M.steelDark, MAT.metal, baseObj);
  for (let i = 0; i < 5; i++) b.box(.25, 1.03 + 0, -.25 + i * .12, .1, .06, .012, M.yellow, MAT.paint, baseObj);

  // boom local origin at hinge, extends +x
  const L = 2.28;
  b.beam([0, 0, -.07], [L, 0, -.07], .048, .048, paint, MAT.paint, boomObj);
  b.beam([0, 0, .07], [L, 0, .07], .048, .048, paint, MAT.paint, boomObj);
  b.beam([0, .115, -.07], [L, .115, -.07], .035, .035, paintDark, MAT.paint, boomObj);
  b.beam([0, .115, .07], [L, .115, .07], .035, .035, paintDark, MAT.paint, boomObj);
  for (let i = 0; i < 9; i++) {
    const x = .12 + i * .26;
    b.beam([x, 0, -.07], [x, .115, -.07], .025, .025, paintDark, MAT.paint, boomObj);
    b.beam([x, 0, .07], [x, .115, .07], .025, .025, paintDark, MAT.paint, boomObj);
    b.beam([x, 0, -.07], [x + .13, .115, -.07], .018, .018, paint, MAT.paint, boomObj);
    b.beam([x + .13, 0, .07], [x, .115, .07], .018, .018, paint, MAT.paint, boomObj);
    b.beam([x, .115, -.07], [x, .115, .07], .018, .018, paint, MAT.paint, boomObj);
  }
  // counter-jib and machinery backreach
  b.beam([-.42, 0, -.07], [0, 0, -.07], .06, .06, paintDark, MAT.paint, boomObj);
  b.beam([-.42, 0, .07], [0, 0, .07], .06, .06, paintDark, MAT.paint, boomObj);
  b.box(-.32, -.06, 0, .2, .16, .22, M.charcoal, MAT.metal, boomObj);
  b.box(-.18, -.02, 0, .07, .07, .14, M.yellow, MAT.paint, boomObj);
  // boom tip block and pulleys
  b.box(L + .02, 0, 0, .09, .13, .18, M.charcoal, MAT.metal, boomObj);
  b.cylinder(L + .02, -.005, 0, .045, .04, M.steelDark, MAT.metal, boomObj, 7);
  b.box(.07, 0, 0, .12, .15, .2, M.charcoal, MAT.metal, boomObj);
  // small warning beacon at tip
  b.sphere(L + .02, .09, 0, .018, .018, .018, C('#ff7a55'), MAT.emissive, boomObj, 6, 4);

  // trolley local origin at the boom, cab hangs below
  b.box(0, -.02, 0, .15, .055, .19, paintDark, MAT.paint, trolleyObj);
  b.box(0, -.1, 0, .12, .09, .14, C('#c6c1b1'), MAT.paint, trolleyObj);
  b.box(0, -.11, .071, .08, .05, .012, M.window, MAT.window, trolleyObj);
  b.box(0, -.11, -.071, .08, .05, .012, M.window, MAT.window, trolleyObj);
  b.box(.062, -.11, 0, .012, .05, .08, M.window, MAT.window, trolleyObj);
  b.box(-.062, -.11, 0, .012, .05, .08, M.window, MAT.window, trolleyObj);
  b.sphere(0, -.19, 0, .012, .012, .012, M.yellow, MAT.emissive, trolleyObj, 6, 4);

  // spreader: yellow frame, four twistlocks
  b.box(0, 0, 0, .33, .025, .22, M.yellow, MAT.paint, spreaderObj);
  for (const sx of [-.145, .145]) for (const sz of [-.09, .09]) {
    b.box(sx, -.018, sz, .045, .035, .045, M.charcoal, MAT.paint, spreaderObj);
    b.box(sx, .016, sz, .05, .012, .05, M.yellow, MAT.paint, spreaderObj);
  }
  b.beam([-.15, .012, -.09], [.15, .012, -.09], .012, .012, M.yellow, MAT.paint, spreaderObj);
  b.beam([-.15, .012, .09], [.15, .012, .09], .012, .012, M.yellow, MAT.paint, spreaderObj);
  return { baseObj, boomObj, trolleyObj, spreaderObj };
}

// Gulls need crane apexes and ship perches, stored as local holders.
const DYNAMIC_PERCHES = [
  { obj: OBJ.crane0Base, local: [.02, 1.62, 0], yaw: 0, name: 'crane-red' },
  { obj: OBJ.crane1Base, local: [.02, 1.62, 0], yaw: 0, name: 'crane-blue' },
  { obj: OBJ.ship, local: [0, .58, .32], yaw: 0, name: 'ship-mast' },
  { obj: OBJ.tug, local: [0, .38, -.12], yaw: 0, name: 'tug-mast' },
  { obj: OBJ.sailA, local: [0, .62, -.02], yaw: 0, name: 'sail-a' },
  { obj: OBJ.sailB, local: [0, .62, -.02], yaw: 0, name: 'sail-b' }
];


/* ============================================================